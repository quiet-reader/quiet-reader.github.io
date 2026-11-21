import {confirmImagePreview} from './image-preview.js';
import {initImageBatchTools} from './image-batch-tools.js';

const $ = id => document.getElementById(id);

export function initImageTools() {
  const screen = $('screen-tools');
  const canvas = $('imageToolCanvas');
  const context = canvas?.getContext('2d');
  const outputCanvas = $('imageToolOutputCanvas');
  const outputContext = outputCanvas?.getContext('2d');
  if (!screen || !canvas || !context || !outputCanvas || !outputContext) return;

  const fileInput = $('imageToolFile');
  const quality = $('imageToolQuality');
  const qualityValue = $('imageToolQualityValue');
  const format = $('imageToolFormat');
  const resizeWidth = $('imageToolWidth');
  const resizeHeight = $('imageToolHeight');
  const keepRatio = $('imageToolKeepRatio');
  const textInput = $('imageToolText');
  const textSize = $('imageToolTextSize');
  const textColor = $('imageToolTextColor');
  const textPosition = $('imageToolTextPosition');
  const status = $('imageToolStatus');
  const originalSize = $('imageToolOriginalSize');
  const outputSize = $('imageToolOutputSize');
  const dimensions = $('imageToolDimensions');
  const savings = $('imageToolSavings');
  const copyButton = $('imageToolCopy');
  const downloadButton = $('imageToolDownload');
  const cropButton = $('imageToolCrop');
  const applyCropButton = $('imageToolApplyCrop');
  const cancelCropButton = $('imageToolCancelCrop');
  const cropHint = $('imageToolCropHint');

  let sourceImage = null, sourceUrl = null, sourceFile = null, outputBlob = null, outputUrl = null;
  let imageMetadata = { id: '', title: '', artist: '', tags: '', description: '' };
  const metadataFields = { id: $('imageToolMetaId'), title: $('imageToolMetaTitle'), artist: $('imageToolMetaArtist'), tags: $('imageToolMetaTags'), description: $('imageToolMetaDescription') };
  const readMetadata = () => Object.fromEntries(Object.entries(metadataFields).map(([key,field]) => [key, field?.value?.trim() || '']));
  const setMetadata = value => {
    imageMetadata = { id: '', title: '', artist: '', tags: '', description: '', ...(value || {}) };
    Object.entries(metadataFields).forEach(([key,field]) => { if (field) field.value = imageMetadata[key] || ''; });
  };
  const metadataPlain = value => [
    value.id && 'ID: ' + value.id, value.title && 'Title: ' + value.title,
    value.artist && 'Artist: ' + value.artist, value.tags && 'Tags: ' + value.tags,
    value.description && 'Description: ' + value.description
  ].filter(Boolean).join('\n');
  const parseMetadata = value => {
    const text = String(value || '').replace(/\r/g, '').trim();
    const read = label => text.match(new RegExp('(?:^|\n)\\s*(?:' + label + ')\\s*[:：]\\s*([^\n]+)', 'i'))?.[1]?.trim() || '';
    const description = text.match(/(?:^|\n)\s*description\s*[:：]\s*([\s\S]*)$/i)?.[1]?.trim() || text;
    return { id: read('(?:work\\s*)?id'), title: read('title|name'), artist: read('artist|author|user'), tags: read('tags?'), description };
  };
  const blobDataUrl = blob => new Promise((resolve,reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
  const readRichClipboardItem = async item => {
    const types = [...item.types];
    const plain = types.includes('text/plain') ? await (await item.getType('text/plain')).text() : '';
    const html = types.includes('text/html') ? await (await item.getType('text/html')).text() : '';
    let htmlText = '', embeddedImage = null;
    if (html) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        htmlText = (doc.body?.innerText || doc.body?.textContent || '').trim();
        const src = doc.querySelector('img[src]')?.getAttribute('src') || '';
        const match = src.match(/^data:(image\\/[^;,]+);base64,([\\s\\S]*)$/i);
        if (match) embeddedImage = new Blob([Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0))], { type: match[1] });
      } catch {}
    }
    const imageType = types.find(type => type.startsWith('image/'));
    const blob = (imageType && await item.getType(imageType)) || embeddedImage;
    if (!blob || !blob.type.startsWith('image/') || blob.type === 'image/svg+xml') return null;
    const metadata = parseMetadata(plain.trim() || htmlText);
    if (!metadata.description && htmlText) metadata.description = htmlText;
    const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[blob.type] || 'png';
    const stem = (metadata.id || metadata.title || 'pasted-image').replace(/[\\\\/:*?"<>|\\x00-\\x1f]/g, '_');
    return { file: new File([blob], stem + '.' + ext, { type: blob.type }), metadata };
  };
  let cropMode = false, cropStart = null, cropRect = null, selectionRect = null;
  let previewTimer = 0, renderGeneration = 0, aspectRatio = 1;

  $('imageToolReset').disabled = true;
  window.addEventListener('image-batch-single', event => loadFile(event.detail));
  const formatBytes = bytes => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  const setStatus = message => { status.textContent = message; };
  const mimeForFormat = () => format.value === 'jpeg' ? 'image/jpeg' : format.value === 'png' ? 'image/png' : 'image/webp';
  const activeCrop = () => selectionRect || cropRect;
  const outputDimensions = () => {
    if (!sourceImage) return { width: 0, height: 0 };
    const base = activeCrop() || { x: 0, y: 0, width: sourceImage.naturalWidth, height: sourceImage.naturalHeight };
    const width = Math.max(1, Math.min(12000, Math.round(selectionRect ? selectionRect.width : (Number(resizeWidth.value) || base.width))));
    const height = Math.max(1, Math.min(12000, Math.round(selectionRect ? selectionRect.height : (Number(resizeHeight.value) || base.height))));
    return { width, height, base };
  };
  const drawCropOverlay = () => {
    const selection = selectionRect;
    if (!selection || !sourceImage) return;
    const scaleX = canvas.width / sourceImage.naturalWidth;
    const scaleY = canvas.height / sourceImage.naturalHeight;
    const x = selection.x * scaleX, y = selection.y * scaleY;
    const w = selection.width * scaleX, h = selection.height * scaleY;
    const width = canvas.width, height = canvas.height;
    context.save();
    context.fillStyle = 'rgba(0,0,0,.50)';
    context.fillRect(0, 0, width, y);
    context.fillRect(0, y + h, width, height - y - h);
    context.fillRect(0, y, x, h);
    context.fillRect(x + w, y, width - x - w, h);
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b9f27c';
    context.lineWidth = Math.max(2, width / 700);
    context.setLineDash([10, 6]);
    context.strokeRect(x, y, w, h);
    context.restore();
  };
  const drawOriginal = () => {
    if (!sourceImage) return;
    const previewScale = Math.min(1, 2400 / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
    canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * previewScale));
    canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * previewScale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceImage, 0, 0);
    if (cropMode && selectionRect) drawCropOverlay();
    dimensions.textContent = sourceImage.naturalWidth + ' × ' + sourceImage.naturalHeight + ' px';
    canvas.classList.toggle('is-cropping', cropMode);
  };
  const drawOutput = () => {
    const { width, height, base } = outputDimensions();
    outputCanvas.width = width;
    outputCanvas.height = height;
    outputContext.clearRect(0, 0, width, height);
    if (format.value === 'jpeg') {
      outputContext.fillStyle = '#ffffff';
      outputContext.fillRect(0, 0, width, height);
    }
    outputContext.drawImage(sourceImage, base.x, base.y, base.width, base.height, 0, 0, width, height);
    const label = textInput.value.trim();
    if (label) {
      const size = Math.max(10, Math.min(240, Number(textSize.value) || 36)) * (width / Math.max(1, base.width));
      const [horizontal, vertical] = textPosition.value.split('-');
      const padding = Math.max(10, size * .55);
      outputContext.font = '700 ' + Math.max(10, size) + 'px system-ui, sans-serif';
      outputContext.textAlign = horizontal;
      outputContext.textBaseline = 'middle';
      const x = horizontal === 'left' ? padding : horizontal === 'right' ? width - padding : width / 2;
      const y = vertical === 'top' ? padding + size / 2 : vertical === 'bottom' ? height - padding - size / 2 : height / 2;
      outputContext.lineWidth = Math.max(2, size * .08);
      outputContext.strokeStyle = 'rgba(0,0,0,.62)';
      outputContext.fillStyle = textColor.value;
      outputContext.strokeText(label, x, y, Math.max(1, width - padding * 2));
      outputContext.fillText(label, x, y, Math.max(1, width - padding * 2));
    }
    $('imageToolOutputDimensions').textContent = width + ' × ' + height + ' px';
    qualityValue.textContent = format.value === 'png' ? 'Lossless' : quality.value + '%';
  };
  const makeBlob = () => new Promise(resolve => outputCanvas.toBlob(resolve, mimeForFormat(), Number(quality.value) / 100));
  const updatePreview = async () => {
    if (!sourceImage) return;
    const generation = ++renderGeneration;
    outputBlob = null;
    copyButton.disabled = true;
    downloadButton.disabled = true;
    drawOriginal();
    drawOutput();
    let blob;
    try { blob = await makeBlob(); } catch (error) {
      if (generation === renderGeneration) setStatus('Could not create output preview: ' + (error?.message || 'unsupported image dimensions'));
      return;
    }
    if (generation !== renderGeneration) return;
    if (!blob) {
      outputBlob = null; copyButton.disabled = true; downloadButton.disabled = true;
      setStatus('This format could not be exported by the browser. Try JPEG, PNG or WebP.');
      return;
    }
    outputBlob = blob;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(blob);
    $('imageToolOutputPreview').src = outputUrl;
    outputSize.textContent = formatBytes(blob.size);
    const delta = sourceFile?.size ? (1 - blob.size / sourceFile.size) * 100 : 0;
    savings.textContent = delta >= 0 ? delta.toFixed(1) + '% smaller' : Math.abs(delta).toFixed(1) + '% larger';
    savings.classList.toggle('is-negative', delta < 0);
    copyButton.disabled = false;
    downloadButton.disabled = false;
    setStatus('Output updated · ' + blob.type.replace('image/', '').toUpperCase());
  };
  const schedulePreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 120);
  };
  const loadFile = async (file, metadata = null) => {
    if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setStatus('Choose a raster image. SVG files are not opened to prevent embedded external resources from loading.');
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    sourceFile = file;
    if (metadata) setMetadata(metadata);
    outputBlob = null;
    outputUrl = null;
    $('imageToolOutputPreview').removeAttribute('src');
    copyButton.disabled = true;
    downloadButton.disabled = true;
    sourceUrl = URL.createObjectURL(file);
    sourceImage = new Image();
    sourceImage.onload = async () => {
      aspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
      cropRect = null; selectionRect = null; cropStart = null; cropMode = false;
      cropButton.disabled = false; applyCropButton.disabled = true; cancelCropButton.disabled = true;
      cropHint.textContent = 'Choose Crop, then drag over the original image to select the area to keep.';
      resizeWidth.value = sourceImage.naturalWidth;
      resizeHeight.value = sourceImage.naturalHeight;
      originalSize.textContent = formatBytes(file.size);
      $('imageToolOriginalSizeMirror').textContent = formatBytes(file.size);
      $('imageToolPreviewEmpty').classList.add('hidden');
      canvas.classList.remove('hidden');
      $('imageToolOutputEmpty').classList.add('hidden');
      $('imageToolOutputPreview').classList.remove('hidden');
      $('imageToolReset').disabled = false;
      outputSize.textContent = 'Preparing…';
      setStatus('Image loaded locally. Preparing output preview…');
      await updatePreview();
    };
    sourceImage.onerror = () => setStatus('This image could not be decoded by the browser.');
    sourceImage.src = sourceUrl;
  };
  const previewClipboardFile = async (file, metadata = null) => {
    if (!file) return false;
    if (!(await confirmImagePreview(file, { title: 'Preview image to edit', confirmLabel: 'Open in editor' }))) {
      setStatus('Paste cancelled. The editor image was not changed.');
      return false;
    }
    await loadFile(file, metadata);
    return true;
  };

  fileInput.addEventListener('change', async event => {
    await loadFile(event.target.files?.[0]);
    event.target.value = '';
  });
  $('imageToolEmptyChoose').addEventListener('click', () => fileInput.click());
  $('imageToolDropzone').addEventListener('dragover', event => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); });
  $('imageToolDropzone').addEventListener('dragleave', event => event.currentTarget.classList.remove('drag-over'));
  $('imageToolDropzone').addEventListener('drop', async event => {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    await loadFile(event.dataTransfer?.files?.[0]);
  });
  $('imageToolPaste').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard image reading is not supported here. Use Choose image instead.');
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const payload = await readRichClipboardItem(item);
        if (payload) { await previewClipboardFile(payload.file, payload.metadata); return; }
      }
      throw new Error('No image found on the clipboard. Text or external image links alone are not enough.');
    } catch (error) { setStatus(error.message || 'Could not read clipboard image.'); }
  });

  quality.addEventListener('input', () => { qualityValue.textContent = quality.value + '%'; schedulePreview(); });
  document.querySelectorAll('[data-image-quality]').forEach(button => button.addEventListener('click', () => {
    quality.value = button.dataset.imageQuality;
    qualityValue.textContent = quality.value + '%';
    document.querySelectorAll('[data-image-quality]').forEach(item => item.classList.toggle('active', item === button));
    schedulePreview();
  }));
  [format, textInput, textSize, textColor, textPosition].forEach(input => {
    input.addEventListener('input', schedulePreview);
    input.addEventListener('change', schedulePreview);
  });
  resizeWidth.addEventListener('change', () => {
    const width = Math.max(1, Number(resizeWidth.value) || 1);
    if (keepRatio.checked) resizeHeight.value = Math.max(1, Math.round(width / aspectRatio));
    schedulePreview();
  });
  resizeHeight.addEventListener('change', () => {
    const height = Math.max(1, Number(resizeHeight.value) || 1);
    if (keepRatio.checked) resizeWidth.value = Math.max(1, Math.round(height * aspectRatio));
    schedulePreview();
  });
  keepRatio.addEventListener('change', () => {
    if (keepRatio.checked && sourceImage) resizeHeight.value = Math.max(1, Math.round(Number(resizeWidth.value) / aspectRatio));
    schedulePreview();
  });

  cropButton.addEventListener('click', () => {
    if (!sourceImage) return;
    cropMode = true; cropStart = null; selectionRect = null;
    applyCropButton.disabled = true; cancelCropButton.disabled = false;
    cropHint.textContent = 'Drag on the original image to select the crop area. The output preview below updates to that selection.';
    drawOriginal();
    setStatus('Crop selection mode');
  });
  cancelCropButton.addEventListener('click', () => {
    cropMode = false; cropStart = null; selectionRect = null;
    applyCropButton.disabled = true; cancelCropButton.disabled = true;
    schedulePreview();
    cropHint.textContent = 'Crop selection cancelled. Previous crop and compression settings are retained.';
  });
  applyCropButton.addEventListener('click', () => {
    if (!selectionRect) return;
    cropRect = { ...selectionRect };
    selectionRect = null; cropMode = false;
    resizeWidth.value = Math.round(cropRect.width);
    resizeHeight.value = Math.round(cropRect.height);
    aspectRatio = cropRect.width / cropRect.height;
    applyCropButton.disabled = true; cancelCropButton.disabled = true;
    schedulePreview();
    cropHint.textContent = 'Crop applied. The output preview below shows the cropped image.';
  });
  const pointerPoint = event => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(sourceImage.naturalWidth, (event.clientX - rect.left) * sourceImage.naturalWidth / rect.width)),
      y: Math.max(0, Math.min(sourceImage.naturalHeight, (event.clientY - rect.top) * sourceImage.naturalHeight / rect.height))
    };
  };
  canvas.addEventListener('pointerdown', event => {
    if (!cropMode || !sourceImage) return;
    event.preventDefault();
    cropStart = pointerPoint(event);
    selectionRect = { x: cropStart.x, y: cropStart.y, width: 1, height: 1 };
    canvas.setPointerCapture(event.pointerId);
    drawOriginal();
  });
  canvas.addEventListener('pointermove', event => {
    if (!cropMode || !cropStart || !sourceImage) return;
    const point = pointerPoint(event);
    selectionRect = { x: Math.min(cropStart.x, point.x), y: Math.min(cropStart.y, point.y),
      width: Math.max(1, Math.abs(point.x - cropStart.x)), height: Math.max(1, Math.abs(point.y - cropStart.y)) };
    drawOriginal();
  });
  canvas.addEventListener('pointerup', () => {
    if (!cropMode || !selectionRect) return;
    if (selectionRect.width < 2 || selectionRect.height < 2) selectionRect = null;
    applyCropButton.disabled = !selectionRect;
    cropStart = null;
    drawOriginal();
    schedulePreview();
    if (selectionRect) setStatus('Crop selection previewed below: ' + Math.round(selectionRect.width) + ' × ' + Math.round(selectionRect.height) + ' px');
  });
  canvas.addEventListener('pointercancel', () => { cropStart = null; });

  copyButton.addEventListener('click', async () => {
    try {
      clearTimeout(previewTimer);
      await updatePreview();
      if (!outputBlob) return;
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Rich image clipboard writing is not supported. Use Download output instead.');
      const metadata = readMetadata(); imageMetadata = metadata;
      const imageUrl = await blobDataUrl(outputBlob);
      const escapeHtml = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      const plain = metadataPlain(metadata);
      const html = '<div><img src="' + imageUrl + '" alt="' + escapeHtml(metadata.title || metadata.id || sourceFile?.name || 'Image') + '"><div>' +
        ['id','title','artist','tags','description'].filter(key => metadata[key]).map(key => '<p><strong>' + key[0].toUpperCase() + key.slice(1) + ':</strong> ' + escapeHtml(metadata[key]) + '</p>').join('') + '</div></div>';
      const png = outputBlob.type === 'image/png' ? outputBlob : await new Promise(resolve => outputCanvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Could not prepare a clipboard-compatible image.');
      const htmlBlob = new Blob([html], {type:'text/html'}), textBlob = new Blob([plain], {type:'text/plain'});
      let note = '';
      try {
        await navigator.clipboard.write([new ClipboardItem({'image/png':png,'text/html':htmlBlob,'text/plain':textBlob})]);
      } catch {
        try {
          await navigator.clipboard.write([new ClipboardItem({'text/html':htmlBlob,'text/plain':textBlob})]);
          note = ' (rich HTML and metadata copied; browser did not accept the native image representation)';
        } catch {
          await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
          note = ' (browser accepted image only; rich metadata clipboard formats are unavailable)';
        }
      }
      setStatus('Processed image and metadata copied' + note + '.');
    } catch (error) { setStatus(error.message || 'Could not copy image to clipboard.'); }
  });
  downloadButton.addEventListener('click', () => {
    if (!outputBlob) return;
    const extension = outputBlob.type === 'image/jpeg' ? 'jpg' : outputBlob.type === 'image/png' ? 'png' : 'webp';
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (sourceFile?.name.replace(/\.[^.]+$/, '') || 'quiet-reader-image') + '-edited.' + extension;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Processed output image downloaded.');
  });
  $('imageToolReset').addEventListener('click', () => {
    if (!sourceImage) return;
    cropRect = null; selectionRect = null; cropMode = false; cropStart = null;
    aspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    resizeWidth.value = sourceImage.naturalWidth; resizeHeight.value = sourceImage.naturalHeight;
    quality.value = '85'; qualityValue.textContent = '85%'; format.value = 'webp'; textInput.value = '';
    document.querySelectorAll('[data-image-quality]').forEach(button => button.classList.toggle('active', button.dataset.imageQuality === '85'));
    textSize.value = '36'; textColor.value = '#ffffff'; textPosition.value = 'center-center';
    keepRatio.checked = true;
    applyCropButton.disabled = true; cancelCropButton.disabled = true;
    schedulePreview();
    cropHint.textContent = 'Choose Crop, then drag over the original image to select the area to keep.';
  });
  initImageBatchTools();
  screen.addEventListener('paste', async event => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const file = [...(clipboard.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
    if (!file) return;
    event.preventDefault();
    const plain = clipboard.getData('text/plain') || '';
    const html = clipboard.getData('text/html') || '';
    let metadata = parseMetadata(plain);
    if (!plain && html) { try { const doc = new DOMParser().parseFromString(html,'text/html'); metadata = parseMetadata(doc.body?.innerText || doc.body?.textContent || ''); } catch {} }
    await previewClipboardFile(file, metadata);
  });
  Object.values(metadataFields).forEach(field => field?.addEventListener('input', () => { imageMetadata = readMetadata(); }));
}
