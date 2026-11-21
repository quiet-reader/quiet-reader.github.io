const $ = id => document.getElementById(id);

export function initImageTools() {
  const screen = $('screen-tools');
  const canvas = $('imageToolCanvas');
  const context = canvas?.getContext('2d');
  if (!screen || !canvas || !context) return;

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

  let sourceImage = null;
  let sourceUrl = null;
  let sourceFile = null;
  let outputBlob = null;
  let cropMode = false;
  let cropStart = null;
  let cropRect = null;
  let selectionRect = null;
  let previewTimer = 0;
  let renderGeneration = 0;
  let aspectRatio = 1;

  const formatBytes = bytes => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  const setStatus = message => { status.textContent = message; };
  const mimeForFormat = () => format.value === 'jpeg' ? 'image/jpeg' : format.value === 'png' ? 'image/png' : 'image/webp';
  const outputDimensions = () => {
    if (!sourceImage) return { width: 0, height: 0 };
    const base = cropRect || { x: 0, y: 0, width: sourceImage.naturalWidth, height: sourceImage.naturalHeight };
    let width = Math.max(1, Math.round(Number(resizeWidth.value) || base.width));
    let height = Math.max(1, Math.round(Number(resizeHeight.value) || base.height));
    return { width: Math.min(12000, width), height: Math.min(12000, height), base };
  };
  const drawSource = () => {
    if (!sourceImage) return;
    const { width, height, base } = outputDimensions();
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    if (format.value === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(sourceImage, base.x, base.y, base.width, base.height, 0, 0, width, height);
    const label = textInput.value.trim();
    if (label) {
      const size = Math.max(10, Math.min(240, Number(textSize.value) || 36)) * (width / Math.max(1, base.width));
      context.font = '700 ' + Math.max(10, size) + 'px Manrope, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const y = textPosition.value === 'top' ? size * 1.5 : textPosition.value === 'center' ? height / 2 : height - size * 1.5;
      context.lineWidth = Math.max(2, size * .08);
      context.strokeStyle = 'rgba(0,0,0,.62)';
      context.fillStyle = textColor.value;
      context.strokeText(label, width / 2, y, width * .9);
      context.fillText(label, width / 2, y, width * .9);
    }
    dimensions.textContent = width + ' × ' + height + ' px';
    qualityValue.textContent = format.value === 'png' ? 'Lossless' : quality.value + '%';
    canvas.classList.toggle('is-cropping', cropMode);
    if (cropMode && cropRect) drawCropOverlay();
  };
  const drawCropOverlay = () => {
    const selection = selectionRect || cropRect;
    if (!selection || !sourceImage) return;
    const { width, height, base } = outputDimensions();
    const scaleX = width / base.width, scaleY = height / base.height;
    const x = (selection.x - base.x) * scaleX, y = (selection.y - base.y) * scaleY;
    const w = selection.width * scaleX, h = selection.height * scaleY;
    context.save();
    context.fillStyle = 'rgba(0,0,0,.48)';
    context.fillRect(0, 0, width, y);
    context.fillRect(0, y + h, width, height - y - h);
    context.fillRect(0, y, x, h);
    context.fillRect(x + w, y, width - x - w, h);
    context.strokeStyle = 'var(--accent)';
    context.lineWidth = Math.max(2, width / 500);
    context.setLineDash([8, 5]);
    context.strokeRect(x, y, w, h);
    context.restore();
  };
  const makeBlob = () => new Promise(resolve => {
    canvas.toBlob(resolve, mimeForFormat(), Number(quality.value) / 100);
  });
  const updatePreview = async () => {
    if (!sourceImage) return;
    const generation = ++renderGeneration;
    drawSource();
    const blob = await makeBlob();
    if (generation !== renderGeneration || !blob) return;
    outputBlob = blob;
    outputSize.textContent = formatBytes(blob.size);
    const delta = sourceFile?.size ? (1 - blob.size / sourceFile.size) * 100 : 0;
    savings.textContent = delta >= 0 ? delta.toFixed(1) + '% smaller' : Math.abs(delta).toFixed(1) + '% larger';
    savings.classList.toggle('is-negative', delta < 0);
    copyButton.disabled = false;
    downloadButton.disabled = false;
    setStatus('Preview updated · ' + blob.type.replace('image/', '').toUpperCase());
  };
  const schedulePreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 160);
  };
  const loadFile = async file => {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Choose a supported image file.');
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
    sourceImage = new Image();
    sourceImage.onload = async () => {
      aspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
      cropRect = null;
      cropMode = false;
      cropButton.disabled = false;
      applyCropButton.disabled = true;
      cancelCropButton.disabled = true;
      cropHint.textContent = 'Choose Crop, then drag across the image to select the area to keep.';
      resizeWidth.value = sourceImage.naturalWidth;
      resizeHeight.value = sourceImage.naturalHeight;
      originalSize.textContent = formatBytes(file.size);
      dimensions.textContent = sourceImage.naturalWidth + ' × ' + sourceImage.naturalHeight + ' px';
      $('imageToolPreviewEmpty').classList.add('hidden');
      canvas.classList.remove('hidden');
      copyButton.disabled = true;
      downloadButton.disabled = true;
      $('imageToolReset').disabled = false;
      outputSize.textContent = 'Preparing…';
      setStatus('Image loaded locally. Preparing preview…');
      await updatePreview();
    };
    sourceImage.onerror = () => setStatus('This image could not be decoded by the browser.');
    sourceImage.src = sourceUrl;
  };

  fileInput.addEventListener('change', async event => {
    await loadFile(event.target.files?.[0]);
    event.target.value = '';
  });
  $('imageToolChoose').addEventListener('click', () => fileInput.click());
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
        const type = item.types.find(value => value.startsWith('image/'));
        if (type) { await loadFile(new File([await item.getType(type)], 'pasted-image.' + (type.split('/')[1] || 'png'), { type })); return; }
      }
      throw new Error('No image found on the clipboard.');
    } catch (error) { setStatus(error.message || 'Could not read clipboard. Use Choose image instead.'); }
  });

  quality.addEventListener('input', () => { qualityValue.textContent = quality.value + '%'; schedulePreview(); });
  [format, textInput, textSize, textColor, textPosition].forEach(input => input.addEventListener('input', schedulePreview));
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
  keepRatio.addEventListener('change', () => { if (keepRatio.checked && sourceImage) resizeHeight.value = Math.max(1, Math.round(Number(resizeWidth.value) / aspectRatio)); schedulePreview(); });

  cropButton.addEventListener('click', () => {
    if (!sourceImage) return;
    cropMode = true;
    cropStart = null;
    selectionRect = null;
    applyCropButton.disabled = true;
    cancelCropButton.disabled = false;
    cropHint.textContent = 'Drag on the image to select the crop area, then choose Apply crop.';
    canvas.classList.add('is-cropping');
    setStatus('Crop selection mode');
  });
  cancelCropButton.addEventListener('click', () => {
    cropMode = false; cropStart = null; selectionRect = null;
    applyCropButton.disabled = true; cancelCropButton.disabled = true;
    schedulePreview();
    cropHint.textContent = 'Choose Crop, then drag across the image to select the area to keep.';
  });
  applyCropButton.addEventListener('click', () => {
    if (!selectionRect) return;
    cropRect = selectionRect;
    selectionRect = null;
    cropMode = false;
    resizeWidth.value = Math.round(cropRect.width);
    resizeHeight.value = Math.round(cropRect.height);
    aspectRatio = cropRect.width / cropRect.height;
    applyCropButton.disabled = true; cancelCropButton.disabled = true;
    schedulePreview();
    cropHint.textContent = 'Crop applied. You can continue resizing or select Crop again.';
  });
  const pointerPoint = event => {
    const rect = canvas.getBoundingClientRect();
    const base = cropRect || { x: 0, y: 0, width: sourceImage.naturalWidth, height: sourceImage.naturalHeight };
    return { x: base.x + Math.max(0, Math.min(base.width, (event.clientX - rect.left) * base.width / rect.width)),
      y: base.y + Math.max(0, Math.min(base.height, (event.clientY - rect.top) * base.height / rect.height)) };
  };
  canvas.addEventListener('pointerdown', event => {
    if (!cropMode || !sourceImage) return;
    event.preventDefault();
    cropStart = pointerPoint(event);
    selectionRect = { x: cropStart.x, y: cropStart.y, width: 1, height: 1 };
    canvas.setPointerCapture(event.pointerId);
    drawSource();
  });
  canvas.addEventListener('pointermove', event => {
    if (!cropMode || !cropStart || !sourceImage) return;
    const point = pointerPoint(event);
    selectionRect = { x: Math.min(cropStart.x, point.x), y: Math.min(cropStart.y, point.y),
      width: Math.max(1, Math.abs(point.x - cropStart.x)), height: Math.max(1, Math.abs(point.y - cropStart.y)) };
    drawSource();
  });
  canvas.addEventListener('pointerup', () => {
    if (!cropMode || !selectionRect) return;
    if (selectionRect.width < 2 || selectionRect.height < 2) selectionRect = null;
    applyCropButton.disabled = !selectionRect;
    if (selectionRect) setStatus('Crop area selected: ' + Math.round(selectionRect.width) + ' × ' + Math.round(selectionRect.height) + ' px');
    drawSource();
  });
  copyButton.addEventListener('click', async () => {
    if (!outputBlob) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard writing is not supported in this browser. Use Download image instead.');
      await navigator.clipboard.write([new ClipboardItem({ [outputBlob.type]: outputBlob })]);
      setStatus('Image copied to clipboard.');
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
    setStatus('Edited image downloaded.');
  });
  $('imageToolReset').addEventListener('click', () => {
    if (!sourceImage) return;
    cropRect = null; selectionRect = null; cropMode = false;
    resizeWidth.value = sourceImage.naturalWidth; resizeHeight.value = sourceImage.naturalHeight;
    quality.value = '85'; format.value = 'webp'; textInput.value = '';
    textSize.value = '36'; textColor.value = '#ffffff'; textPosition.value = 'bottom';
    keepRatio.checked = true;
    schedulePreview();
    cropHint.textContent = 'Choose Crop, then drag across the image to select the area to keep.';
  });
  screen.addEventListener('paste', async event => {
    const file = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
    if (file) { event.preventDefault(); await loadFile(file); }
  });
}
