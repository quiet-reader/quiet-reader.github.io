import {getAll,putMany} from './db.js';
import {applyTheme} from './themes.js';
import {$,download,toast,modal,closeModal} from './utils.js';

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
  if(/\.zip$/i.test(file.name)||file.type==='application/zip'||file.type==='application/x-zip-compressed')restored=await readZipArchive(file);
  else restored=parseLegacyBackup(JSON.parse(await file.text()));
  if(!Array.isArray(restored.items)||restored.items.some(item=>!item||!item.id||!['book','paste'].includes(item.kind)))throw new Error('The backup contains an invalid book or paste record.');
  // Validate the entire archive before writing anything; one IndexedDB transaction commits all records.
  await putMany(restored.items);
  applyPreferences(restored);
  toast('Backup restored and verified');
  location.reload();
 }catch(error){alert('Could not restore backup: '+(error?.message||error))}
}
