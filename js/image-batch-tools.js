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
const outputName = (path, format) => {
  const clean = path.replace(/\\/g,'/').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
  const base = clean.replace(/\.[^.]+$/,'');
  return base + '-edited.' + (format === 'jpeg' ? 'jpg' : format);
};

export function initImageBatchTools() {
  const imagesInput = document.getElementById('imageToolBatchFiles');
  const folderInput = document.getElementById('imageToolBatchFolder');
  const zipInput = document.getElementById('imageToolBatchZip');
  const status = document.getElementById('imageToolStatus');
  if (!imagesInput || !folderInput || !zipInput) return;
  const setStatus = message => { if (status) status.textContent = message; };
  document.getElementById('imageToolChooseBatch')?.addEventListener('click', () => imagesInput.click());
  document.getElementById('imageToolChooseFolder')?.addEventListener('click', () => folderInput.click());
  document.getElementById('imageToolChooseZip')?.addEventListener('click', () => zipInput.click());

  const start = async (files, sourceLabel) => {
    if (!files.length) return;
    if (!window.JSZip) { setStatus('ZIP support is unavailable. Reload the app and try again.'); return; }
    const defaults = {format:'webp',quality:85,maxWidth:0,maxHeight:0,crop:'none',anchor:'center-center'};
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
        anchor:document.getElementById('imageBatchAnchor').value
      };
      await process(files,settings,sourceLabel);
    };
  };

  const process = async (files, settings, sourceLabel) => {
    const host = document.getElementById('modalHost');
    const zip = new JSZip();
    const rows = [];
    let inputTotal=0, outputTotal=0, completed=0, failed=0;
    host.querySelector('.modal').innerHTML = `
      <div class="image-batch-progress">
        <div class="row between"><h2>Processing images</h2><b id="imageBatchCount">0 / ${files.length}</b></div>
        <div class="image-batch-track"><span id="imageBatchBar"></span></div>
        <p id="imageBatchStage" class="muted tiny">Preparing images locally…</p>
        <div class="image-batch-total" id="imageBatchTotals">Calculating total sizes…</div>
        <div id="imageBatchRows" class="image-batch-rows"></div>
        <div class="image-batch-actions"><button type="button" id="imageBatchClose" disabled>Close</button><button type="button" id="imageBatchDownload" class="primary" disabled>Download edited ZIP</button></div>
      </div>`;
    const count = document.getElementById('imageBatchCount');
    const bar = document.getElementById('imageBatchBar');
    const stage = document.getElementById('imageBatchStage');
    const totals = document.getElementById('imageBatchTotals');
    const list = document.getElementById('imageBatchRows');
    const close = document.getElementById('imageBatchClose');
    const save = document.getElementById('imageBatchDownload');
    close.onclick=closeModal;
    const updateTotals=()=>{totals.innerHTML='<b>'+bytes(inputTotal)+'</b> original <span>→</span> <b>'+bytes(outputTotal)+'</b> processed <span>·</span> '+(inputTotal ? ((1-outputTotal/inputTotal)*100).toFixed(1)+'% smaller' : '—');};
    for (let index=0;index<files.length;index++) {
      const item=files[index];
      inputTotal+=item.file.size;
      count.textContent=completed+' / '+files.length;
      stage.textContent='Processing '+item.path;
      const row=document.createElement('div');
      row.className='image-batch-row';
      row.innerHTML='<span class="image-batch-row-name">'+esc(item.path)+'</span><span class="image-batch-row-size">Processing…</span>';
      list.append(row);
      try {
        const image=await decode(item.file);
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
        const name=outputName(item.path,settings.format);
        zip.file(name,blob,{date:new Date()});
        outputTotal+=blob.size; completed++;
        row.classList.add('is-done');
        row.querySelector('.image-batch-row-size').textContent=bytes(item.file.size)+' → '+bytes(blob.size)+' · '+(item.file.size?((1-blob.size/item.file.size)*100).toFixed(1)+'%':'—');
        rows.push({name,input:item.file.size,output:blob.size});
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
        save.onclick=()=>download(archive,'quiet-reader-edited-images.zip');
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
    start(entries,label);
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
      const items=[];
      for(const entry of entries){items.push({file:await imageFile(entry,entry.name),path:entry.name});}
      start(items,'ZIP archive');
    }catch(error){setStatus('Could not read ZIP archive: '+(error?.message||'invalid ZIP'));}
  });
}
