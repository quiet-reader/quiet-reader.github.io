import {modal, closeModal, download, esc} from './utils.js';

const IMAGE_EXT = /\.(?:avif|bmp|gif|jpe?g|png|webp|tiff?)$/i;
const MIME_BY_EXT = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',avif:'image/avif',tif:'image/tiff',tiff:'image/tiff'};

const bytes = value => {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(2) + ' MB';
};
const imageFile = async (entry, path) => {
  const blob = await entry.async('blob');
  const ext = path.split('.').pop().toLowerCase();
  return new File([blob], path.split('/').pop(), {type: blob.type || MIME_BY_EXT[ext] || 'application/octet-stream'});
};
const decode = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Browser could not decode this image')); };
  image.src = url;
});
const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Browser could not export this image in the selected format')), type, quality);
});
const cropFor = (width, height, ratio, anchor) => {
  if (!ratio) return {x:0,y:0,width,height};
  const current = width / height;
  let cropWidth = width, cropHeight = height;
  if (current > ratio) cropWidth = height * ratio;
  else cropHeight = width / ratio;
  const [vertical,horizontal] = anchor.split('-');
  const x = horizontal === 'left' ? 0 : horizontal === 'right' ? width - cropWidth : (width - cropWidth) / 2;
  const y = vertical === 'top' ? 0 : vertical === 'bottom' ? height - cropHeight : (height - cropHeight) / 2;
  return {x,y,width:cropWidth,height:cropHeight};
};
const outputName = (path, format, suffix = '-edited') => {
  const clean = path.replace(/\\/g,'/').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
  const base = clean.replace(/\.[^.]+$/,'');
  const safeSuffix = String(suffix ?? '').replace(/[\\/:*?\"<>|]/g,'-');
  return base + safeSuffix + '.' + (format === 'jpeg' ? 'jpg' : format);
};

export function initImageBatchTools() {
  const imagesInput = document.getElementById('imageToolBatchFiles');
  const folderInput = document.getElementById('imageToolBatchFolder');
  const zipInput = document.getElementById('imageToolBatchZip');
  const status = document.getElementById('imageToolStatus');
  if (!imagesInput || !folderInput || !zipInput) return;
  const setStatus = message => { if (status) status.textContent = message; };
  document.getElementById('imageToolChoose')?.addEventListener('click', () => {
    modal('Add images', `
      <div class="image-batch-picker">
        <p class="muted tiny">Choose what you want to edit. You can process one image or a whole collection with the same settings.</p>
        <button type="button" id="imageBatchPickSingle"><span>▧</span><span><b>Choose image</b><small>Open one image in the editor</small></span></button>
        <button type="button" id="imageBatchPickMultiple"><span>▧</span><span><b>Choose multiple images</b><small>Select individual image files</small></span></button>
        <button type="button" id="imageBatchPickFolder"><span>▣</span><span><b>Choose folder</b><small>Process supported images in a folder and its subfolders</small></span></button>
        <button type="button" id="imageBatchPickZip"><span>▤</span><span><b>Choose ZIP archive</b><small>Process images stored inside a ZIP</small></span></button>
      </div>`);
    const choose = (id,input) => document.getElementById(id)?.addEventListener('click',() => { closeModal(); input.click(); });
    choose('imageBatchPickSingle',document.getElementById('imageToolFile'));
    choose('imageBatchPickMultiple',imagesInput);
    choose('imageBatchPickFolder',folderInput);
    choose('imageBatchPickZip',zipInput);
  });

  const start = async (files, sourceLabel, suggestedArchiveName = 'quiet-reader-edited-images') => {
    if (!files.length) return;
    if (!window.JSZip) { setStatus('ZIP support is unavailable. Reload the app and try again.'); return; }
    modal('Batch image editor', `
      <div class="image-batch-setup">
        <p class="muted tiny">${files.length} image(s) selected from ${esc(sourceLabel)}. These settings will be applied to every image. Originals are never changed.</p>
        <div class="image-batch-fields">
          <label>Output format<select id="imageBatchFormat"><option value="webp">WebP · smaller files</option><option value="jpeg">JPEG</option><option value="png">PNG · lossless</option></select></label>
          <label>Quality <span id="imageBatchQualityValue">85%</span><input id="imageBatchQuality" type="range" min="5" max="100" value="85"></label>
          <label>Maximum width (px)<input id="imageBatchWidth" type="number" min="0" max="12000" placeholder="Original width"></label>
          <label>Maximum height (px)<input id="imageBatchHeight" type="number" min="0" max="12000" placeholder="Original height"></label>
          <label>Crop preset<select id="imageBatchCrop">
            <option value="none">No crop · keep full image</option>
            <option value="1">Square · 1:1</option>
            <option value="1.3333333333">Landscape · 4:3</option>
            <option value="1.7777777778">Wide · 16:9</option>
            <option value="0.8">Portrait · 4:5</option>
            <option value="0.6666666667">Portrait · 2:3</option>
          </select></label>
          <label>Crop position<select id="imageBatchAnchor"><option value="center-center">Centre</option><option value="top-center">Top</option><option value="bottom-center">Bottom</option><option value="center-left">Left</option><option value="center-right">Right</option></select></label>
          <label>Output ZIP name<input id="imageBatchArchiveName" type="text" maxlength="100" value="${esc(suggestedArchiveName)}" placeholder="quiet-reader-edited-images"></label>
          <label>Individual file name suffix<input id="imageBatchSuffix" type="text" maxlength="40" value="-edited" placeholder="Optional, e.g. -compressed"></label>
        </div>
        <p class="muted tiny">Crop presets keep the selected aspect ratio and anchor the crop to the chosen position. Maximum dimensions are applied after cropping, preserving aspect ratio. Leave dimensions blank or zero to keep the resulting size.</p>
        <div class="image-batch-actions"><button type="button" id="imageBatchCancel">Cancel</button><button type="button" class="primary" id="imageBatchStart">Process ${files.length} images</button></div>
      </div>`);
    const quality = document.getElementById('imageBatchQuality');
    quality.addEventListener('input',()=>document.getElementById('imageBatchQualityValue').textContent=quality.value+'%');
    document.getElementById('imageBatchCancel').onclick=closeModal;
    document.getElementById('imageBatchStart').onclick=async()=>{
      const settings = {
        format:document.getElementById('imageBatchFormat').value,
        quality:Number(quality.value),
        maxWidth:Math.max(0,Math.min(12000,Number(document.getElementById('imageBatchWidth').value)||0)),
        maxHeight:Math.max(0,Math.min(12000,Number(document.getElementById('imageBatchHeight').value)||0)),
        crop:document.getElementById('imageBatchCrop').value,
        anchor:document.getElementById('imageBatchAnchor').value,
        archiveName:document.getElementById('imageBatchArchiveName').value.trim(),
        suffix:document.getElementById('imageBatchSuffix').value
      };
      await process(files,settings,sourceLabel);
    };
  };

  const process = async (files, settings, sourceLabel) => {
    const host = document.getElementById('modalHost');
    const zip = new JSZip();
    const processedFiles = [];
    let inputTotal=0, outputTotal=0, completed=0, failed=0;
    host.querySelector('.modal').innerHTML = `
      <div class="image-batch-progress">
        <div class="row between"><h2>Processing images</h2><b id="imageBatchCount">0 / ${files.length}</b></div>
        <div class="image-batch-track"><span id="imageBatchBar"></span></div>
        <p id="imageBatchStage" class="muted tiny">Preparing images locally…</p>
        <div class="image-batch-total" id="imageBatchTotals">Calculating total sizes…</div>
        <div id="imageBatchRows" class="image-batch-rows"></div>
        <div class="image-batch-actions"><button type="button" id="imageBatchClose" disabled>Close</button><button type="button" id="imageBatchSaveFolder" disabled>Save images to folder</button><button type="button" id="imageBatchDownload" class="primary" disabled>Download ZIP</button></div>
      </div>`;
    const count = document.getElementById('imageBatchCount');
    const bar = document.getElementById('imageBatchBar');
    const stage = document.getElementById('imageBatchStage');
    const totals = document.getElementById('imageBatchTotals');
    const list = document.getElementById('imageBatchRows');
    const close = document.getElementById('imageBatchClose');
    const save = document.getElementById('imageBatchDownload');
    const saveFolder = document.getElementById('imageBatchSaveFolder');
    close.onclick=closeModal;
    saveFolder.disabled = typeof window.showDirectoryPicker !== 'function';
    saveFolder.title = saveFolder.disabled ? 'Folder saving requires a browser that supports the File System Access API.' : 'Choose a destination folder and save the processed image files there.';
    const updateTotals=()=>{totals.innerHTML='<b>'+bytes(inputTotal)+'</b> original <span>→</span> <b>'+bytes(outputTotal)+'</b> processed <span>·</span> '+(inputTotal ? ((1-outputTotal/inputTotal)*100).toFixed(1)+'% smaller' : '—');};
    for (let index=0;index<files.length;index++) {
      const item=files[index];
      inputTotal+=item.size ?? item.file?.size ?? 0;
      count.textContent=completed+' / '+files.length;
      stage.textContent='Processing '+item.path;
      const row=document.createElement('div');
      row.className='image-batch-row';
      row.innerHTML='<span class="image-batch-row-name">'+esc(item.path)+'</span><span class="image-batch-row-size">Processing…</span>';
      list.append(row);
      try {
        const file=item.file || await item.getFile();
        const image=await decode(file);
        const ratio=settings.crop==='none'?0:Number(settings.crop);
        const crop=cropFor(image.naturalWidth,image.naturalHeight,ratio,settings.anchor);
        let width=crop.width, height=crop.height;
        const scale=Math.min(1,settings.maxWidth?settings.maxWidth/width:1,settings.maxHeight?settings.maxHeight/height:1);
        width=Math.max(1,Math.round(width*scale)); height=Math.max(1,Math.round(height*scale));
        const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
        const context=canvas.getContext('2d');
        if(settings.format==='jpeg'){context.fillStyle='#fff';context.fillRect(0,0,width,height);}
        context.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,width,height);
        const mime=settings.format==='jpeg'?'image/jpeg':settings.format==='png'?'image/png':'image/webp';
        const blob=await toBlob(canvas,mime,settings.quality/100);
        const name=outputName(item.path,settings.format,settings.suffix);
        zip.file(name,blob,{date:new Date()});
        outputTotal+=blob.size; completed++;
        row.classList.add('is-done');
        row.querySelector('.image-batch-row-size').textContent=bytes(file.size)+' → '+bytes(blob.size)+' · '+(file.size?((1-blob.size/file.size)*100).toFixed(1)+'%':'—');
        processedFiles.push({path:name,blob});
        image.close?.();
      } catch(error) {
        failed++; row.classList.add('is-failed');
        row.querySelector('.image-batch-row-size').textContent='Failed · '+(error?.message||'Could not process');
      }
      count.textContent=(index+1)+' / '+files.length;
      bar.style.width=((index+1)/files.length*100)+'%';
      updateTotals();
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    stage.textContent='Creating ZIP archive…';
    if (completed) {
      try {
        const archive=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}},meta=>{
          stage.textContent='Creating ZIP archive · '+Math.round(meta.percent)+'%';
        });
        save.disabled=false;
        const archiveBase=(settings.archiveName || 'quiet-reader-edited-images').replace(/\\.zip$/i,'').replace(/[\\/:*?"<>|]/g,'-').trim() || 'quiet-reader-edited-images';
        save.onclick=()=>download(archive,archiveBase+'.zip');
        saveFolder.disabled = typeof window.showDirectoryPicker !== 'function';
        saveFolder.onclick=async()=>{
          if(typeof window.showDirectoryPicker!=='function'){stage.textContent='Folder saving is not supported in this browser. Use Download ZIP instead.';return;}
          try{
            const root=await window.showDirectoryPicker({mode:'readwrite'});
            for(const item of processedFiles){
              const parts=item.path.split('/').filter(Boolean);
              const fileName=parts.pop();
              let directory=root;
              for(const part of parts) directory=await directory.getDirectoryHandle(part,{create:true});
              const handle=await directory.getFileHandle(fileName,{create:true});
              const writable=await handle.createWritable();
              await writable.write(item.blob);
              await writable.close();
            }
            stage.textContent='Saved '+processedFiles.length+' processed image(s) to the selected folder. Original files were not modified.';
          }catch(error){
            if(error?.name!=='AbortError') stage.textContent='Could not save to the selected folder: '+(error?.message||'permission denied');
          }
        };
        stage.textContent='Finished · '+completed+' processed'+(failed?', '+failed+' failed':'')+'. '+sourceLabel+' originals were not modified.';
      } catch(error) {
        stage.textContent='Images processed, but ZIP creation failed: '+(error?.message||'unknown error');
      }
    } else stage.textContent='No images could be processed. Check that the selected files are supported images.';
    close.disabled=false;
    count.textContent=completed+' processed · '+failed+' failed';
    updateTotals();
  };

  const fromFiles = async (fileList, label) => {
    const selected=[...fileList];
    const accepted=selected.filter(file=>IMAGE_EXT.test(file.name) && file.type!=='image/svg+xml');
    if(!accepted.length){setStatus('No supported raster images were found in that selection.');return;}
    const entries=accepted.map(file=>({file,path:file.webkitRelativePath||file.name}));
    if(entries.length===1 && label==='individual images'){await window.dispatchEvent(new CustomEvent('image-batch-single',{detail:entries[0].file}));return;}
    const suggested=label==='selected folder' ? (entries[0].path.split('/')[0] || 'edited-images')+'-edited' : 'quiet-reader-edited-images';
    start(entries,label,suggested);
  };
  imagesInput.addEventListener('change',async()=>{await fromFiles(imagesInput.files,'individual images');imagesInput.value='';});
  folderInput.addEventListener('change',async()=>{await fromFiles(folderInput.files,'selected folder');folderInput.value='';});
  zipInput.addEventListener('change',async()=>{
    const file=zipInput.files?.[0];zipInput.value='';if(!file)return;
    if(!window.JSZip){setStatus('ZIP support is unavailable.');return;}
    setStatus('Reading ZIP image entries…');
    try{
      const archive=await JSZip.loadAsync(file);
      const entries=Object.values(archive.files).filter(entry=>!entry.dir&&IMAGE_EXT.test(entry.name)&&!entry.name.split('/').some(part=>part.startsWith('.')));
      if(!entries.length){setStatus('No supported images were found in that ZIP archive.');return;}
      const items=entries.map(entry=>({path:entry.name,size:entry._data?.uncompressedSize||0,getFile:()=>imageFile(entry,entry.name)}));
      start(items,'ZIP archive',file.name.replace(/\\.zip$/i,'')+'-edited');
    }catch(error){setStatus('Could not read ZIP archive: '+(error?.message||'invalid ZIP'));}
  });
}
