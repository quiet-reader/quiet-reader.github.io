export const $=id=>document.getElementById(id);
export const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2400)}
export function modal(title,body,setup){$('modalHost').innerHTML='<div class="modal-back" id="modalBack"><section class="modal"><div class="row between"><h2>'+esc(title)+'</h2><button id="modalClose">×</button></div>'+body+'</section></div>';$('modalClose').onclick=closeModal;if(setup)setup()}
export function closeModal(){$('modalHost').innerHTML=''}
export function dataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}
export function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export function paragraphs(text){
 const normalized=String(text||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 const blocks=normalized.split(/\n[ \t]*\n+/);
 const result=[];
 for(const block of blocks){
  const lines=block.split('\n').map(line=>line.trim()).filter(Boolean);
  result.push(...lines);
 }
 return result;
}
