import {getAll,putMany,put} from './db.js';
import {freshBook,state} from './state.js';
import {refresh,openBook} from './library.js';
import {renderGallery,importGalleryFiles} from './galleries.js';
import {importEPUB} from './epub.js';
import {importPDF} from './pdf.js';
import {importTextBook} from './editor.js';
import {applyTheme} from './themes.js';
import {$,download,toast,modal,closeModal,dataURL,uid} from './utils.js';

const ARCHIVE_FORMAT='QuietReaderArchive';
const ARCHIVE_VERSION=1;
const LEGACY_FORMAT='QuietBookBackup';
const encoder=new TextEncoder();

function clone(value){return structuredClone(value)}
function bytesToBase64(bytes){
 let binary='';
 const chunkSize=0x8000;
 for(let i=0;i<bytes.length;i+=chunkSize)binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
 return btoa(binary);
}
function base64ToBytes(value){
 const binary=atob(value),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)throw new Error('SHA-256 requires a secure browser context (HTTPS or localhost).');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function extensionFor(mime){
 return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg'})[mime]||'bin';
}
async function externalizeItem(item,archive,records,nextAsset){
 const copy=clone(item);
 const addAsset=async dataUrl=>{
  const match=/^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if(!match)throw new Error('An embedded image has an invalid data URL.');
  const mime=match[1]||'application/octet-stream';
  const bytes=match[2]?base64ToBytes(match[3]):encoder.encode(decodeURIComponent(match[3]));
  const path='assets/'+String(nextAsset.value++).padStart(6,'0')+'.'+extensionFor(mime);
  archive.file(path,bytes,{binary:true});
  records.push({path,size:bytes.byteLength,sha256:await sha256(bytes),mediaType:mime,role:'image'});
  return {__quietReaderAsset:path,mime};
 };
 if(typeof copy.cover==='string'&&copy.cover.startsWith('data:image/'))copy.cover=await addAsset(copy.cover);
 for(const chapter of copy.chapters||[]){
  for(const image of chapter.images||[]){
   if(typeof image.data==='string'&&image.data.startsWith('data:image/'))image.data=await addAsset(image.data);
  }
 }
 for(const image of copy.gallery?.images||[]){
  if(typeof image.data==='string'&&image.data.startsWith('data:image/'))image.data=await addAsset(image.data);
 }
 return copy;
}
async function writeJson(archive,records,path,value,role){
 const content=JSON.stringify(value,null,2),bytes=encoder.encode(content);
 archive.file(path,content);
 records.push({path,size:bytes.byteLength,sha256:await sha256(bytes),mediaType:'application/json',role});
}
function checksumText(entries){
 return entries.map(entry=>entry.sha256+'  '+entry.path).join('\n')+'\n';
}
async function buildArchive(selected){
 if(!window.JSZip)throw new Error('The ZIP library did not load. Check your connection and retry.');
 const items=await getAll(),books=items.filter(item=>item.kind==='book'),pastes=items.filter(item=>item.kind==='paste');
 const archive=new JSZip(),records=[],nextAsset={value:1},bookRefs=[],pasteRefs=[];
 for(let i=0;i<books.length;i++){
  const book=books[i];
  if(!selected.novels&&!selected.marks&&!selected.progress)continue;
  let copy=selected.novels?await externalizeItem(book,archive,records,nextAsset):{id:book.id,kind:'book',source:book.source,title:book.title,author:book.author};
  if(selected.novels&&!selected.marks){delete copy.bookmarks;delete copy.highlights}
  else if(selected.marks){copy.bookmarks=clone(book.bookmarks||[]);copy.highlights=clone(book.highlights||[])}
  if(selected.novels&&!selected.progress)delete copy.progress;
  else if(selected.progress&&book.progress)copy.progress=clone(book.progress);
  if(selected.progress&&book.readingHistory)copy.readingHistory=clone(book.readingHistory.slice(-10));
  const path='books/book-'+String(i+1).padStart(6,'0')+'.json';
  await writeJson(archive,records,path,copy,'book');
  bookRefs.push({id:book.id,path});
 }
 if(selected.pastes){
  for(let i=0;i<pastes.length;i++){
   const path='pastes/paste-'+String(i+1).padStart(6,'0')+'.json';
   await writeJson(archive,records,path,pastes[i],'paste');
   pasteRefs.push({id:pastes[i].id,path});
  }
 }
 const preferences=selected.appearance?{
  tagColors:localStorage.getItem('qrTagColors'),
  libraryView:localStorage.getItem('qrLibraryView'),
  librarySort:localStorage.getItem('qrLibrarySort'),
  autoReadHighlight:localStorage.getItem('qrAutoReadHighlight')
 }:undefined;
 const library={
  schemaVersion:1,
  createdAt:new Date().toISOString(),
  books:bookRefs,
  pastes:pasteRefs,
  sections:selected,
  theme:selected.appearance?(localStorage.getItem('qbtheme')||'default'):undefined,
  preferences
 };
 await writeJson(archive,records,'library.json',library,'library-index');
 const manifest={
  format:ARCHIVE_FORMAT,
  archiveVersion:ARCHIVE_VERSION,
  createdAt:library.createdAt,
  encoding:'UTF-8',
  checksumAlgorithm:'SHA-256',
  libraryIndex:'library.json',
  counts:{books:bookRefs.length,pastes:pasteRefs.length,images:records.filter(entry=>entry.role==='image').length},
  files:records
 };
 const manifestText=JSON.stringify(manifest,null,2),manifestHash=await sha256(encoder.encode(manifestText));
 archive.file('manifest.json',manifestText);
 archive.file('checksums.sha256',checksumText([...records,{path:'manifest.json',sha256:manifestHash}]));
 return archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
}
export async function exportBackup(){
 modal('Create backup','<div class="stack"><p class="muted tiny">Create a portable ZIP archive. Book data is stored as individual JSON files; covers and chapter images remain separate original image files. Every archive entry is verified with SHA-256 during restore.</p><label class="backup-option"><input type="checkbox" id="backupNovels" checked> Novels and chapters (including covers and images)</label><label class="backup-option"><input type="checkbox" id="backupMarks" checked> Bookmarks and highlights</label><label class="backup-option"><input type="checkbox" id="backupProgress" checked> Reading progress</label><label class="backup-option"><input type="checkbox" id="backupPastes" checked> Saved pasted chapters</label><label class="backup-option"><input type="checkbox" id="backupAppearance" checked> Appearance and reader preferences</label><div class="row"><span class="grow"></span><button id="cancelBackup">Cancel</button><button id="confirmBackup" class="primary">Create ZIP backup</button></div></div>',()=>{
 $('cancelBackup').onclick=closeModal;
 $('confirmBackup').onclick=async()=>{
  const button=$('confirmBackup');
  const selected={novels:$('backupNovels').checked,marks:$('backupMarks').checked,progress:$('backupProgress').checked,pastes:$('backupPastes').checked,appearance:$('backupAppearance').checked};
  if(!Object.values(selected).some(Boolean))return toast('Select at least one backup category');
  button.disabled=true;button.textContent='Preparing archive…';
  try{
   const blob=await buildArchive(selected);
   download(blob,'quiet-reader-backup.zip');
   closeModal();toast('ZIP backup created');
  }catch(error){button.disabled=false;button.textContent='Create ZIP backup';alert('Could not create backup: '+(error?.message||error))}
 };
});
}
async function readZipArchive(file){
 if(!window.JSZip)throw new Error('The ZIP library did not load. Check your connection and retry.');
 const archive=await JSZip.loadAsync(file),manifestFile=archive.file('manifest.json');
 if(!manifestFile)throw new Error('The ZIP does not contain a backup manifest.');
 const manifest=JSON.parse(await manifestFile.async('string'));
 if(manifest.format!==ARCHIVE_FORMAT||manifest.archiveVersion!==ARCHIVE_VERSION)throw new Error('Unsupported backup archive format or version.');
 if(!Array.isArray(manifest.files)||manifest.checksumAlgorithm!=='SHA-256')throw new Error('The backup manifest is incomplete.');
 const seen=new Set(),verified=new Map();
 for(const record of manifest.files){
  if(!record.path||record.path.startsWith('/')||record.path.split('/').includes('..')||seen.has(record.path))throw new Error('The manifest contains an invalid or duplicate file path.');
  seen.add(record.path);
  const entry=archive.file(record.path);
  if(!entry)throw new Error('A required backup file is missing: '+record.path);
  const bytes=await entry.async('uint8array');
  if(bytes.byteLength!==record.size)throw new Error('File size mismatch: '+record.path);
  if(await sha256(bytes)!==record.sha256)throw new Error('SHA-256 verification failed: '+record.path);
  verified.set(record.path,bytes);
 }
 const checksumFile=archive.file('checksums.sha256');
 if(!checksumFile)throw new Error('The backup checksum list is missing.');
 const checksumLines=(await checksumFile.async('string')).trim().split(/\r?\n/);
 const checksums=new Map(checksumLines.map(line=>{const match=/^([a-f0-9]{64})  (.+)$/.exec(line);return match?[match[2],match[1]]:[null,null]}).filter(pair=>pair[0]));
 const manifestBytes=encoder.encode(await manifestFile.async('string'));
 if(checksums.get('manifest.json')!==await sha256(manifestBytes))throw new Error('The manifest checksum does not match.');
 for(const record of manifest.files)if(checksums.get(record.path)!==record.sha256)throw new Error('The checksum list does not match: '+record.path);
 const indexPath=manifest.libraryIndex||'library.json',indexBytes=verified.get(indexPath);
 if(!indexBytes)throw new Error('The library index is missing from the manifest.');
 const library=JSON.parse(new TextDecoder().decode(indexBytes));
 if(library.schemaVersion!==1||!Array.isArray(library.books)||!Array.isArray(library.pastes))throw new Error('The library index is invalid.');
 const readItem=async ref=>{
  if(!ref?.path||!verified.has(ref.path))throw new Error('A referenced book or paste file is missing.');
  return JSON.parse(new TextDecoder().decode(verified.get(ref.path)));
 };
 const hydrate=async value=>{
  if(value&&typeof value==='object'&&value.__quietReaderAsset){
   const bytes=verified.get(value.__quietReaderAsset);
   if(!bytes)throw new Error('An image file is missing: '+value.__quietReaderAsset);
   return 'data:'+(value.mime||'application/octet-stream')+';base64,'+bytesToBase64(bytes);
  }
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=await hydrate(value[i]);return value}
  if(value&&typeof value==='object'){for(const key of Object.keys(value))value[key]=await hydrate(value[key]);return value}
  return value;
 };
 const restored=[];
 for(const ref of library.books){const item=await readItem(ref);if(item.kind!=='book'||item.id!==ref.id)throw new Error('A book entry does not match its library index.');restored.push(await hydrate(item))}
 for(const ref of library.pastes){const item=await readItem(ref);if(item.kind!=='paste'||item.id!==ref.id)throw new Error('A paste entry does not match its library index.');restored.push(item)}
 return {items:restored,theme:library.theme,preferences:library.preferences};
}

function zipFiles(zip){return Object.values(zip.files||{}).filter(entry=>!entry.dir)}
function findZipEntry(zip,predicate){return zipFiles(zip).find(entry=>predicate(entry.name.split(String.fromCharCode(92)).join('/')))}
function guessMime(name){
 const ext=String(name).split('.').pop().toLowerCase();
 return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',bmp:'image/bmp',epub:'application/epub+zip',pdf:'application/pdf',txt:'text/plain'})[ext]||'application/octet-stream';
}
function safeId(){return uid()}
async function decodeHtmlChapter(html,zip,pluginId,novelId,chapterId,htmlPath=''){
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,nav,header,footer,noscript').forEach(node=>node.remove());
 const images=[];
 const base=String(htmlPath).split('/').slice(0,-1).join('/');
 for(const img of [...doc.querySelectorAll('img')]){
  const src=img.getAttribute('src')||img.getAttribute('data-src')||'';
  let decoded='';try{decoded=decodeURIComponent(src.split(/[?#]/,1)[0])}catch{decoded=src.split(/[?#]/,1)[0]}
  const filename=decoded.split('/').pop()||'';
  if(!filename)continue;
  const candidates=[base+'/'+decoded.replace(/^\.\//,''),base+'/'+filename];
  const entry=findZipEntry(zip,name=>{
   const normalized=name.replace(/^\.\//,'');
   return candidates.some(path=>normalized===path||normalized.endsWith('/'+path))||
    (normalized.endsWith('/'+filename)&&normalized.toLowerCase().includes('/'+String(chapterId).toLowerCase()+'/'));
  });
  if(entry&&/^image\//i.test(guessMime(filename))){
   const bytes=await entry.async('uint8array'),mime=guessMime(filename),id=safeId();
   images.push({id,data:'data:'+mime+';base64,'+bytesToBase64(bytes),mime,name:filename});
   img.replaceWith(doc.createTextNode(String.fromCharCode(10)+'[IMAGE:'+id+']'+String.fromCharCode(10)));
  }else if(!src.startsWith('data:image/'))img.remove();
 }
 const preferred=doc.querySelector('.chapter-content,.reader-content,.content,#content,[class*="chapter-content"],[class*="reader-content"]')||doc.body;
 const blockTags=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','BR','TR']);
 const walk=node=>{
  if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const tag=node.tagName;if(tag==='BR')return String.fromCharCode(10);
  const inner=[...node.childNodes].map(walk).join('');
  return blockTags.has(tag)?String.fromCharCode(10).repeat(2)+inner+String.fromCharCode(10).repeat(2):inner;
 };
 let rawText=walk(preferred);
 if(!rawText.trim())rawText=preferred.textContent||doc.body?.textContent||'';
 const text=rawText.replace(/\r/g,'').split('\n').map(line=>line.replace(/[\\t ]+/g,' ').trim()).filter((line,index,lines)=>line||lines[index-1]).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 return {text,images};
}
function chapterHtmlEntry(zip,pluginId,novelId,chapter){
 const id=String(chapter.id??''),plugin=String(pluginId||'local'),novel=String(novelId||'');
 const all=zipFiles(zip).filter(entry=>/\/index\.html?$/i.test('/'+entry.name.replace(/\\/g,'/')));
 const exact=all.find(entry=>{const path='/'+entry.name.replace(/\\/g,'/');return path.endsWith('/'+plugin+'/'+novel+'/'+id+'/index.html')||path.endsWith('/'+novel+'/'+id+'/index.html')});
 if(exact)return exact;
 const byId=all.filter(entry=>('/'+entry.name.replace(/\\/g,'/')+'/').toLowerCase().includes('/'+id.toLowerCase()+'/'));
 if(byId.length===1)return byId[0];
 const chapterPath=String(chapter.path||'').replace(/^\/+|\/+$/g,'');
 if(chapterPath){const byPath=all.find(entry=>entry.name.replace(/\\/g,'/').toLowerCase().includes(chapterPath.toLowerCase()));if(byPath)return byPath}
 return null;
}
function normalizedZipPath(value){return String(value||'').replace(/\\/g,'/').replace(/^\.\/+/,'').replace(/\/+/g,'/').toLowerCase()}
function pathParts(value){return normalizedZipPath(value).split('/').filter(Boolean)}
function jsonString(value){if(typeof value==='string')return value;if(value==null)return '';try{return JSON.stringify(value)}catch{return String(value)}}
function chapterPayloadText(payload){
 if(typeof payload==='string')return payload;
 if(!payload||typeof payload!=='object')return '';
 for(const key of ['content','contentHtml','html','text','chapterContent','body','data','正文']){
  const value=payload[key];if(typeof value==='string'&&value.trim())return value;
 }
 return '';
}
function chapterFolderFiles(zip,pluginId,novelId,chapter,index){
 const files=zipFiles(zip),plugin=String(pluginId||'').toLowerCase(),novel=String(novelId||'').toLowerCase();
 const id=String(chapter.id??'').toLowerCase(),number=String(chapter.chapterNumber??index+1).toLowerCase();
 const matching=files.filter(entry=>{
  const parts=pathParts(entry.name);
  const novelAt=parts.findIndex(part=>part===novel);
  if(novelAt<0)return false;
  if(plugin&&novelAt>0&&!parts.slice(0,novelAt).includes(plugin))return false;
  return true;
 });
 const exact=matching.filter(entry=>{
  const parts=pathParts(entry.name),base=parts.at(-1)||'';
  return base===id+'.json'||base===number+'.json'||parts.some(part=>part===id||part===number);
 });
 return exact.length?exact:matching;
}
function findDownloadedChapterJson(zip,pluginId,novelId,chapter,index){
 const candidates=chapterFolderFiles(zip,pluginId,novelId,chapter,index).filter(entry=>/\.json$/i.test(entry.name));
 const id=String(chapter.id??'').toLowerCase(),number=String(chapter.chapterNumber??index+1).toLowerCase();
 const exact=candidates.find(entry=>{const base=pathParts(entry.name).at(-1);return base===id+'.json'||base===number+'.json'});
 if(exact)return exact;
 const byParent=candidates.find(entry=>{const parts=pathParts(entry.name);return parts.includes(id)||parts.includes(number)});
 if(byParent)return byParent;
 const ordered=candidates.sort((a,b)=>{
  const an=Number((pathParts(a.name).at(-1)||'').replace(/\.json$/,'')),bn=Number((pathParts(b.name).at(-1)||'').replace(/\.json$/,''));
  return (Number.isFinite(an)?an:Infinity)-(Number.isFinite(bn)?bn:Infinity)||a.name.localeCompare(b.name);
 });
 return ordered[index]||null;
}
async function readDownloadedChapter(downloadZip,pluginId,novelId,chapter,index){
 if(!downloadZip)return {text:'',images:[]};
 const jsonEntry=findDownloadedChapterJson(downloadZip,pluginId,novelId,chapter,index);
 if(!jsonEntry)return {text:'',images:[]};
 let payload;try{payload=JSON.parse(await jsonEntry.async('string'))}catch{return {text:'',images:[]}}
 const raw=chapterPayloadText(payload);
 if(raw&&/<(?:p|div|br|img|h[1-6]|section)\b/i.test(raw)){
  try{return await decodeHtmlChapter(raw,downloadZip,pluginId,novelId,chapter.id,jsonEntry.name)}catch{}
 }
 let text=raw;
 if(!text&&Array.isArray(payload?.content))text=payload.content.map(jsonString).join('\n');
 const folder=pathParts(jsonEntry.name).slice(0,-1).join('/');
 const imageEntries=zipFiles(downloadZip).filter(entry=>{
  const name=normalizedZipPath(entry.name);
  return name.startsWith(folder+'/')&&/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name);
 }).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
 const images=[];
 for(const entry of imageEntries){
  const bytes=await entry.async('uint8array'),mime=guessMime(entry.name),id=safeId();
  images.push({id,data:'data:'+mime+';base64,'+bytesToBase64(bytes),mime,name:entry.name.split('/').pop()||'image'});
  text=(text||'').replaceAll(entry.name.split('/').pop(), '[IMAGE:'+id+']');
 }
 return {text,images};
}
async function readLNReaderArchive(file){
 const outer=await JSZip.loadAsync(file);
 const dataEntry=findZipEntry(outer,name=>pathParts(name).at(-1)==='data.zip');
 if(!dataEntry)throw new Error('This ZIP is not a recognised LNReader backup. Expected data.zip and download.zip.');
 const dataZip=await JSZip.loadAsync(await dataEntry.async('uint8array'));
 const novelEntries=zipFiles(dataZip).filter(entry=>normalizedZipPath(entry.name).includes('novelandchapters/')&&/\.json$/i.test(entry.name));
 if(!novelEntries.length)throw new Error('The LNReader data.zip archive has no NovelAndChapters JSON records.');
 const categoryEntry=findZipEntry(dataZip,name=>pathParts(name).at(-1)==='category.json');
 let categories=[];if(categoryEntry){try{const parsed=JSON.parse(await categoryEntry.async('string'));categories=Array.isArray(parsed)?parsed:[]}catch{}}
 const categoryNames=new Map(categories.map(category=>[Number(category.id),String(category.name||'').trim()]).filter(([,name])=>name));
 const downloadEntry=findZipEntry(outer,name=>pathParts(name).at(-1)==='download.zip');
 const downloadZip=downloadEntry?await JSZip.loadAsync(await downloadEntry.async('uint8array')):null;
 const items=[];
 for(const entry of novelEntries){
  let novel;try{novel=JSON.parse(await entry.async('string'))}catch{continue}
  if(!novel||typeof novel!=='object'||!Array.isArray(novel.chapters))continue;
  const id=String(novel.id??pathParts(entry.name).at(-1)?.replace(/\.json$/i,'')??'');
  const pluginId=String(novel.pluginId||pathParts(entry.name).find((part,index,parts)=>part.toLowerCase()==='novelandchapters'?false:parts[index+1]?.toLowerCase()==='novelandchapters')||'local');
  const tags=String(novel.genres||'').split(',').map(value=>value.trim()).filter(Boolean);
  const novelCategories=categories.filter(category=>(category.novelIds||[]).map(String).includes(id)||Number(category.novelId)===Number(id)).map(category=>categoryNames.get(Number(category.id))).filter(Boolean);
  const book=freshBook('lnreader',String(novel.name||'Imported LNReader novel'));
  book.author=String(novel.author||'');book.summary=String(novel.summary||'');
  book.tags=[...new Set([...tags,...novelCategories])];
  book.lnReader={pluginId,originalId:id,path:String(novel.path||''),status:novel.status||'',artist:novel.artist||'',source:'LNReader'};
  const novelDownloadFiles=downloadZip?zipFiles(downloadZip).filter(item=>{
   const parts=pathParts(item.name),at=parts.indexOf(id.toLowerCase());
   return at>=0&&(!pluginId||parts.slice(0,at).includes(pluginId.toLowerCase())||parts.length-at>1);
  }):[];
  const cover=novelDownloadFiles.find(item=>/(^|\/)(cover|thumbnail)\.(png|jpe?g|webp|gif|avif)$/i.test(normalizedZipPath(item.name)))||
   (downloadZip&&findZipEntry(downloadZip,name=>{const p=pathParts(name);return p.includes(id.toLowerCase())&&/(^|\/)(cover|thumbnail)\.(png|jpe?g|webp|gif|avif)$/i.test(name)}));
  if(typeof novel.cover==='string'&&/^https?:\/\//i.test(novel.cover))book.cover=novel.cover;
  else if(cover){const bytes=await cover.async('uint8array');book.cover='data:'+guessMime(cover.name)+';base64,'+bytesToBase64(bytes)}
  const ordered=novel.chapters.map((chapter,index)=>({chapter,index})).sort((a,b)=>{
   const ap=Number(a.chapter.position??a.chapter.chapterNumber??a.index+1),bp=Number(b.chapter.position??b.chapter.chapterNumber??b.index+1);
   return ap-bp||a.index-b.index;
  });
  let lastReadIndex=-1,lastReadAt=0;book.readingHistory=[];
  for(let position=0;position<ordered.length;position++){
   const {chapter,index}=ordered[position];
   const decoded=await readDownloadedChapter(downloadZip,pluginId,id,chapter,position);
   let text=decoded.text,images=decoded.images;
   if(!text&&downloadZip){
    const html=chapterHtmlEntry(downloadZip,pluginId,id,chapter);
    if(html){try{const result=await decodeHtmlChapter(await html.async('string'),downloadZip,pluginId,id,chapter.id,html.name);text=result.text;images=result.images}catch(error){console.warn('LNReader chapter import failed',chapter.name,error)}}
   }
   const now=Date.now(),readAt=chapter.readTime?new Date(chapter.readTime).getTime():0,chapterIndex=book.chapters.length;
   if(readAt>lastReadAt){lastReadAt=readAt;lastReadIndex=chapterIndex}
   if(chapter.readTime)book.readingHistory.push({chapter:chapterIndex,readAt:chapter.readTime});
   book.chapters.push({
    title:String(chapter.name||chapter.title||'Chapter '+(position+1)),text,images,
    createdAt:chapter.releaseTime?new Date(chapter.releaseTime).getTime()||now:now,
    updatedAt:chapter.updatedTime?new Date(chapter.updatedTime).getTime()||now:now,
    lnReader:{id:chapter.id,path:chapter.path||'',chapterNumber:chapter.chapterNumber??position+1,page:chapter.page??'1',scanlator:chapter.scanlator||'',read:chapter.unread===false,downloaded:Boolean(chapter.isDownloaded)||Boolean(text||images.length),progress:Number(chapter.progress)||0,timeSpent:Number(chapter.timeSpent)||0}
   });
   if(chapter.bookmark)book.bookmarks.push({id:safeId(),chapter:chapterIndex,offset:0,text:String(chapter.name||'Chapter '+(position+1)),created:now});
  }
  book.progress={chapter:Math.max(0,lastReadIndex),offset:0};book.readingHistory=book.readingHistory.slice(-100);book.updated=Date.now();items.push(book);
 }
 if(!items.length)throw new Error('No readable novels were found in this LNReader backup.');
 // LNReader categories are converted into each book's normal tags. Do not inject them
 // into the app-wide custom-category registry, which has a separate lifecycle.
 return {items,theme:null,preferences:null,source:'lnreader-zip'};
}
function parseLNReaderJson(data){
 const candidates=[Array.isArray(data)?data:undefined,data?.novels,data?.library?.novels,data?.data?.novels,data?.backup?.novels,data?.items];
 const novels=candidates.find(Array.isArray);
 if(!novels)throw new Error('The JSON file is not a supported LNReader backup. Select the native LNReader backup.json export.');
 const categories=data?.categories||data?.library?.categories||[];
 const categoryNames=new Map(categories.map(category=>[Number(category.id),String(category.name||'')]));
 const items=novels.map(novel=>{
  const title=String(novel.name||novel.title||novel.novelName||'Imported LNReader novel');
  const book=freshBook('lnreader',title);
  book.author=String(novel.author||'');
  book.summary=String(novel.summary||novel.novelSummary||'');
  book.cover=String(novel.cover||novel.novelCover||'');
  const genreText=novel.genres||novel.genre||'';
  const ids=String(novel.categoryIds||'').split(',').map(value=>Number(value.trim())).filter(Number.isFinite);
  const categoryValues=Array.isArray(novel.categories)?novel.categories.map(value=>typeof value==='string'?value:categoryNames.get(Number(value?.id))||'').filter(Boolean):[];
  book.tags=[...new Set([...String(genreText).split(',').map(x=>x.trim()).filter(Boolean),...ids.map(id=>categoryNames.get(id)).filter(Boolean),...categoryValues])];
  book.chapters=(novel.chapters||[]).map((chapter,index)=>({title:String(chapter.name||chapter.title||'Chapter '+(index+1)),text:String(chapter.text||chapter.content||''),images:[],createdAt:Date.now(),updatedAt:Date.now(),lnReader:{id:chapter.id,path:chapter.path||'',read:Boolean(chapter.read||chapter.unread===false),progress:Number(chapter.progress)||0,bookmark:Boolean(chapter.bookmark)}}));
  book.progress={chapter:Math.max(0,book.chapters.findLastIndex(chapter=>chapter.lnReader?.read)),offset:0};
  book.bookmarks=book.chapters.flatMap((chapter,index)=>chapter.lnReader?.bookmark?[{id:safeId(),chapter:index,offset:0,text:chapter.title,created:Date.now()}]:[]);
  book.lnReader={legacy:!book.chapters.length,originalId:novel.novelId??novel.id??null,sourceId:novel.sourceId??null,source:novel.source||'',sourceUrl:novel.sourceUrl||'',novelUrl:novel.novelUrl||'',categoryIds:novel.categoryIds||''};
  book.updated=Date.now();
  return book;
 });
 if(!items.length)throw new Error('The LNReader JSON backup contains no novels.');
 const saved=(()=>{try{return JSON.parse(localStorage.getItem('qrLibraryCategories')||'[]')}catch{return []}})();
 localStorage.setItem('qrLibraryCategories',JSON.stringify([...new Set([...saved,...categories.map(category=>String(category.name||'').trim()).filter(Boolean)])]));
 return {items,theme:null,preferences:null,source:'lnreader-json'};
}
async function createGalleryFromZipEntries(file,entries){
 if(!entries.length)throw new Error('No supported images were found in this ZIP.');
 const title=String(file.name||'Image gallery').replace(/[.]zip$/i,'')||'Imported gallery';
 const book=freshBook('gallery',title);
 book.gallery={images:[],view:'grid',history:[],createdAt:Date.now(),lastOpenedAt:null};
 for(const entry of entries){
  const blob=await entry.async('blob');
  const name=entry.name.split('/').pop()||'Image';
  const imageFile=new File([blob],name,{type:blob.type||guessMime(name)});
  const data=await dataURL(imageFile);
  book.gallery.images.push({id:safeId(),name,data,mime:imageFile.type,size:blob.size,addedAt:Date.now(),lastOpenedAt:null,notes:'',locked:false,history:[]});
 }
 if(book.gallery.images[0])book.cover=book.gallery.images[0].data;
 await put(book);await refresh();openBook(book.id);renderGallery();
 toast('Gallery imported · '+book.gallery.images.length+' images');
}
export async function importZipCollection(file,mode='library'){
 if(!window.JSZip)throw new Error('The ZIP library did not load. Check your connection and retry.');
 const archive=await JSZip.loadAsync(file);
 const files=zipFiles(archive);
 if(archive.file('manifest.json')||findZipEntry(archive,name=>name.toLowerCase()==='data.zip'||name.toLowerCase().endsWith('/data.zip')))return importBackup(file);
 const images=files.filter(entry=>/[.](png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(entry.name));
 if(mode==='gallery'){
  if(state.screen==='book'&&state.book?.source==='gallery'){
   const selected=[];
   for(const entry of images){const blob=await entry.async('blob');const name=entry.name.split('/').pop()||'Image';selected.push(new File([blob],name,{type:blob.type||guessMime(name)}))}
   if(!selected.length)throw new Error('No supported images were found in this ZIP.');
   return importGalleryFiles(selected);
  }
  return createGalleryFromZipEntries(file,images);
 }
 const epubs=files.filter(entry=>/[.]epub$/i.test(entry.name));
 const pdfs=files.filter(entry=>/[.]pdf$/i.test(entry.name));
 const txts=files.filter(entry=>/[.]txt$/i.test(entry.name));
 if(!epubs.length&&!pdfs.length&&!txts.length)return createGalleryFromZipEntries(file,images);
 for(const entry of epubs){const blob=await entry.async('blob');await importEPUB(new File([blob],entry.name.split('/').pop(),{type:'application/epub+zip'}))}
 for(const entry of pdfs){const blob=await entry.async('blob');await importPDF(new File([blob],entry.name.split('/').pop(),{type:'application/pdf'}))}
 if(txts.length){
  const paths=txts.map(entry=>({entry,parts:entry.name.split('/').filter(Boolean)}));
  const sharedFirst=paths.length&&paths.every(item=>item.parts.length>1&&item.parts[0]===paths[0].parts[0])?paths[0].parts[0]:null;
  const secondFolders=new Set(paths.map(item=>item.parts[1]).filter(Boolean));
  const commonRoot=sharedFirst&&paths.every(item=>item.parts.length>2)&&(['books','novels','library','backup','export','archive'].includes(sharedFirst.toLowerCase())||secondFolders.size>1)?sharedFirst:null;
  const groups=new Map();
  for(const item of paths){
   const relative=commonRoot?item.parts.slice(1):item.parts;
   const key=relative.length>1?relative[0]:'__root__';
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({entry:item.entry,relative:relative.join('/')});
  }
  for(const group of groups.values()){
   const wrapped=await Promise.all(group.map(async item=>({name:item.relative.split('/').pop(),webkitRelativePath:item.relative,text:()=>item.entry.async('string')})));
   await importTextBook(wrapped);
  }
 }
 if(epubs.length||pdfs.length||txts.length)toast('ZIP import complete · '+(epubs.length+pdfs.length+txts.length)+' book files');
}

function parseLegacyBackup(data){
 if(data.format!==LEGACY_FORMAT)throw new Error('This is not a supported Quiet Reader backup.');
 if(![2,3].includes(Number(data.version)))throw new Error('Unsupported legacy JSON backup version.');
 const items=data.items||[...(data.books||[]),...(data.pastes||[])];
 if(!Array.isArray(items))throw new Error('The JSON backup does not contain a valid item list.');
 return {items,theme:data.theme,preferences:data.preferences};
}
function applyPreferences(data){
 if(data.theme)applyTheme(data.theme);
 if(data.preferences){
  for(const [key,value] of Object.entries({qrTagColors:data.preferences.tagColors,qrLibraryView:data.preferences.libraryView,qrLibrarySort:data.preferences.librarySort,qrAutoReadHighlight:data.preferences.autoReadHighlight})){
   if(value!==undefined&&value!==null)localStorage.setItem(key,value);
  }
 }
}
export async function importBackup(file){
 try{
  let restored;
  if(String(file.name||'').toLowerCase().endsWith('.zip')||file.type==='application/zip'||file.type==='application/x-zip-compressed'){
   const archive=await JSZip.loadAsync(file);
   if(archive.file('manifest.json'))restored=await readZipArchive(file);
   else restored=await readLNReaderArchive(file);
  }else{
   const parsed=JSON.parse(await file.text());
   try{restored=parseLegacyBackup(parsed)}catch{restored=parseLNReaderJson(parsed)}
  }
  if(!Array.isArray(restored.items)||restored.items.some(item=>!item||!item.id||!['book','paste'].includes(item.kind)))throw new Error('The backup contains an invalid book or paste record.');
  // Validate the complete restore before writing; putMany commits all entries together.
  await putMany(restored.items);
  applyPreferences(restored);
  if(restored.source==='lnreader-json'){
   toast('LNReader 1.x · '+restored.items.length+' novels imported; chapter files and reading progress are not in this backup');
  }else if(restored.source==='lnreader-zip'){
   const books=restored.items.filter(item=>item.kind==='book');
   const chapters=books.reduce((sum,book)=>sum+(book.chapters||[]).length,0);
   const readable=books.reduce((sum,book)=>sum+(book.chapters||[]).filter(chapter=>String(chapter.text||'').trim()).length,0);
   toast('LNReader imported · '+books.length+' novels · '+chapters+' chapters · '+readable+' with text');
  }else toast('Backup restored · '+restored.items.length+' entries imported');
  location.reload();
 }catch(error){alert('Could not restore backup: '+(error?.message||error))}
}
