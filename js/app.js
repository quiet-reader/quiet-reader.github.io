import {$,esc,toast,modal,closeModal,dataURL} from './utils.js';import {state,setScreen} from './state.js';import {refresh,drawBook,drawLibrary,openBook,createNovel,handleLibraryClick,savePasteAsBook,savePasteOnly,setBookTab,saveBookNotes,setLibraryView,setLibrarySearch,showChapterHistory,handleCollectionAction} from './library.js';import {editChapter,saveChapter,deleteChapter,insertImage,importTextBook,importTextChapters} from './editor.js';import {openReader,drawReader,saveProgress,changeChapter,jumpChapter,addBookmark,renderChapterFormat,copySection,copyChapter,toggleSection,startAutoRead,pauseAutoRead,stopAutoRead,setAutoReadPosition,isAutoReadSpeaking,setAutoReadSpeed,setTTSSpeechSpeed,searchNovel,showMoreNovelSearchResults,openNovelSearchResult,initTTS,setTTSEnabled,setTTSVoice,setTTSEngine} from './reader.js';import {addHighlight,addParagraphHighlight,showMarks,positionSelectionToolbar,hideSelectionToolbar,bookmarkFromSelection} from './highlights.js';import {applyTheme,applyAccent,applyBackground,initTheme} from './themes.js';import {exportBackup,importBackup,importZipCollection} from './backup.js';import {importEPUB,exportEPUB} from './epub.js';import {importPDF} from './pdf.js';import {put} from './db.js';import {manageNovelLinks,manageChapterLinks,renderReaderLinks,openLinkedChapter} from './links.js';import {manageTranslationSources,openTranslatePage,restoreOriginalChapter,copyTranslatedChapter,syncTranslationControls} from './translation.js';import {renameChapters} from './chapter-tools.js';import {showUniversalHistory} from './history.js';import {createGallery,addGalleryImages,addGalleryFolder,importGalleryFiles,renderGallery,continueGallery,pasteGalleryImages} from './galleries.js';import {pasteEditorImage} from './editor.js';import {addEditEvent} from './history.js';import {confirmImagePreview} from './image-preview.js';
function enhanceSelects(root=document){
 root.querySelectorAll?.('select').forEach(select=>{
  if(select.dataset.customized==='1')return;select.dataset.customized='1';
  const wrap=document.createElement('div');wrap.className='select-popover-wrap';select.parentNode.insertBefore(wrap,select);wrap.append(select);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='select-popover-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='select-popover hidden';panel.setAttribute('role','listbox');wrap.append(trigger,panel);
  const label=()=>select.selectedOptions[0]?.textContent||'Select…';
  const render=()=>{trigger.textContent=label();trigger.disabled=select.disabled;trigger.setAttribute('aria-label',select.getAttribute('aria-label')||select.labels?.[0]?.textContent?.trim()||'Choose an option');panel.innerHTML=[...select.options].map(option=>'<button type="button" role="option" aria-selected="'+String(option.selected)+'" data-option-value="'+esc(option.value)+'" '+(option.disabled?'disabled':'')+' class="'+(option.selected?'active':'')+'">'+esc(option.textContent).replace(/★/g,'<span class="rating-option-star">★</span>')+'</button>').join('')};
  const close=()=>{panel.classList.add('hidden');trigger.setAttribute('aria-expanded','false');wrap.classList.remove('is-open')};
  trigger.onclick=()=>{document.querySelectorAll('.select-popover-wrap.is-open').forEach(other=>{if(other!==wrap){other.querySelector('.select-popover')?.classList.add('hidden');other.querySelector('.select-popover-trigger')?.setAttribute('aria-expanded','false');other.classList.remove('is-open')}});const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden',!opening);trigger.setAttribute('aria-expanded',String(opening));wrap.classList.toggle('is-open',opening);if(opening){panel.style.left='0';panel.style.right='auto';requestAnimationFrame(()=>{const rect=panel.getBoundingClientRect();if(rect.right>innerWidth-8){panel.style.left='auto';panel.style.right='0'}if(panel.getBoundingClientRect().left<8){panel.style.left='0';panel.style.right='auto'}})}};
  panel.onclick=e=>{const option=e.target.closest('[data-option-value]');if(!option||option.disabled)return;select.value=option.dataset.optionValue;select.dispatchEvent(new Event('change',{bubbles:true}));render();close()};
  select.addEventListener('change',render);select.addEventListener('input',render);new MutationObserver(render).observe(select,{childList:true,subtree:true,attributes:true});render();
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close()});
  trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();trigger.click();panel.querySelector('[role="option"]:not(:disabled)')?.focus()}});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus()}});
 });
}
const selectObserver=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1){if(node.matches?.('select'))enhanceSelects(node.parentNode);else enhanceSelects(node)}})));
selectObserver.observe(document.documentElement,{childList:true,subtree:true});
function openDrawer(){ $('drawer').classList.add('open');$('scrim').classList.remove('hidden') }function closeDrawer(){$('drawer').classList.remove('open');$('readerPanel').classList.add('hidden');$('scrim').classList.add('hidden')}
function detailsModal(){modal('Edit book details','<div class="stack"><label>Title<input id="detailEditTitle"></label><label>Author<input id="detailEditAuthor"></label><label>Tags (comma-separated)<input id="detailEditTags" placeholder="cultivation, xianxia, fantasy"></label><button id="saveBookDetails" class="primary">Save</button></div>',()=>{$('detailEditTitle').value=state.book.title;$('detailEditAuthor').value=state.book.author||'';$('detailEditTags').value=(state.book.tags||[]).join(', ');$('saveBookDetails').onclick=async()=>{state.book.title=$('detailEditTitle').value;state.book.author=$('detailEditAuthor').value;state.book.tags=[...new Set($('detailEditTags').value.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean))];await put(state.book);await refresh();drawBook();closeModal()}})}
function tagColorsModal(){const tags=[...new Set(state.books.flatMap(book=>Array.isArray(book.tags)?book.tags:[]).map(tag=>String(tag).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));if(!tags.length)return toast('Add tags to a novel first');let saved={};try{saved=JSON.parse(localStorage.getItem('qrTagColors')||'{}')}catch{}const palette=['#d7c477','#83b8e8','#8bc58b','#e7a0bd','#b9a0e8','#e5a16b','#72c5bd','#d58f8f'];const rows=tags.map((tag,i)=>'<label class="tag-color-row"><span>#'+esc(tag)+'</span><input type="color" data-tag-color="'+esc(tag)+'" value="'+(saved[tag]||palette[i%palette.length])+'"></label>').join('');modal('Tag colors','<div class="stack"><p class="muted tiny">Choose a color for each tag. These colors are used on novel cards.</p>'+rows+'<div class="row"><button id="resetTagColors">Reset defaults</button><span class="grow"></span><button id="saveTagColors" class="primary">Save colors</button></div></div>',()=>{$('saveTagColors').onclick=()=>{const colors={...saved};document.querySelectorAll('[data-tag-color]').forEach(input=>colors[input.dataset.tagColor]=input.value);localStorage.setItem('qrTagColors',JSON.stringify(colors));drawLibrary();closeModal();toast('Tag colors saved')};$('resetTagColors').onclick=()=>{localStorage.removeItem('qrTagColors');drawLibrary();closeModal();toast('Default tag colors restored')}})}
function editTagsModal(){
 if(!state.book)return;
 const current=new Set(Array.isArray(state.book.tags)?state.book.tags:[]);
 const available=[...new Set(state.books.flatMap(book=>Array.isArray(book.tags)?book.tags:[]).map(tag=>String(tag).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
 let colors={};try{colors=JSON.parse(localStorage.getItem('qrTagColors')||'{}')}catch{}
 const palette=['#d7c477','#83b8e8','#8bc58b','#e7a0bd','#b9a0e8','#e5a16b','#72c5bd','#d58f8f'];
 const colorFor=(tag,i)=>colors[tag]||palette[Math.max(0,available.indexOf(tag))%palette.length];
 const chips=available.map((tag,i)=>'<button type="button" class="tag-choice '+(current.has(tag)?'selected':'')+'" data-toggle-tag="'+esc(tag)+'" style="--tag-color:'+colorFor(tag,i)+'"><span class="tag-choice-check">'+(current.has(tag)?'✓':'＋')+'</span>#'+esc(tag)+'</button>').join('');
 modal('Edit tags','<div class="stack"><p class="muted tiny">Choose from existing tags below, or add a new tag. Tag colors match your library.</p><button type="button" id="toggleAvailableTags" class="tag-dropdown-trigger" aria-expanded="false">Choose existing tags <span>⌄</span></button><div id="availableTagChoices" class="tag-choice-list hidden">'+(chips||'<p class="muted tiny">No tags exist yet. Add the first one below.</p>')+'</div><div class="row"><input id="newBookTag" placeholder="New tag name"><button type="button" id="addBookTag">Add</button></div><div id="selectedTagPreview" class="book-tags">'+[...current].map((tag,i)=>'<span class="book-tag" style="--tag-color:'+colorFor(tag,i)+'">#'+esc(tag)+'</span>').join('')+'</div><div class="row"><span class="grow"></span><button id="saveBookTags" class="primary">Save tags</button></div></div>',()=>{
 const render=()=>{document.querySelectorAll('[data-toggle-tag]').forEach(btn=>{const on=current.has(btn.dataset.toggleTag);btn.classList.toggle('selected',on);btn.querySelector('.tag-choice-check').textContent=on?'✓':'＋'});$('selectedTagPreview').innerHTML=[...current].map((tag,i)=>'<span class="book-tag" style="--tag-color:'+colorFor(tag,i)+'">#'+esc(tag)+'</span>').join('')};
 $('toggleAvailableTags').onclick=()=>{const panel=$('availableTagChoices');panel.classList.toggle('hidden');$('toggleAvailableTags').setAttribute('aria-expanded',String(!panel.classList.contains('hidden')))};
 $('availableTagChoices').onclick=e=>{const btn=e.target.closest('[data-toggle-tag]');if(!btn)return;const tag=btn.dataset.toggleTag;current.has(tag)?current.delete(tag):current.add(tag);render()};
 $('addBookTag').onclick=()=>{const tag=$('newBookTag').value.trim().replace(/^#/,'');if(!tag)return;current.add(tag);if(!available.includes(tag)){const btn=document.createElement('button');btn.type='button';btn.className='tag-choice selected';btn.dataset.toggleTag=tag;btn.style.setProperty('--tag-color',palette[available.length%palette.length]);btn.innerHTML='<span class="tag-choice-check">✓</span>#'+esc(tag);$('availableTagChoices').append(btn);available.push(tag)}$('newBookTag').value='';render()};
 $('newBookTag').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('addBookTag').click()}};
 $('saveBookTags').onclick=async()=>{if(state.book.locked)return toast('Unlock editing first');state.book.tags=[...current];await put(state.book);await refresh();drawBook();closeModal();toast('Tags saved')};
 });
}
function libraryDisplayModal(){
 const defaults=[['all','All entries'],['epub','EPUB'],['manhwa','Manhwa'],['pdf','PDF'],['manual','Novels'],['gallery','Galleries']];
 let config={};try{config=JSON.parse(localStorage.getItem('qrLibraryEntryConfig')||'{}')||{}}catch{config={}}
 const custom=(()=>{try{return JSON.parse(localStorage.getItem('qrLibraryCategories')||'[]')}catch{return []}})();
 const entries=[...defaults,...custom.map(tag=>['tag:'+tag,tag])];
 const rows=entries.map(([key,label])=>{const item=config[key]||{};const locked=item.locked!==false;return '<div class="display-entry-row"><label class="display-entry-visible"><input type="checkbox" data-entry-visible="'+esc(key)+'" '+(item.visible===false?'':'checked')+'><span class="eye-glyph">◉</span></label><input class="display-entry-name" data-entry-label="'+esc(key)+'" value="'+esc(item.label||label)+'" aria-label="Display name for '+esc(label)+'" '+(locked?'disabled':'')+'><button type="button" class="display-entry-lock '+(locked?'locked':'')+'" data-entry-lock="'+esc(key)+'" aria-label="'+(locked?'Unlock':'Lock')+' name">'+(locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg>')+'</button></div>'}).join('');
 const tags=[...new Set(state.books.flatMap(book=>Array.isArray(book.tags)?book.tags:[]).filter(Boolean))].sort();
 const tagOptions=['<option value="all">All tags</option>',...tags.map(tag=>'<option value="'+esc(tag)+'">'+esc(tag)+'</option>')].join('');
 const body='<div class="stack library-display-modal"><section><h3>Visible entry tabs</h3><p class="muted tiny">Use the eye to show or hide tabs. Unlock a name to rename it.</p><div class="display-entry-list">'+rows+'</div></section><section class="display-options-grid"><label>Sort by<select id="displaySort"><option value="recent">Recently updated</option><option value="added">Recently added</option><option value="title">Title A–Z</option><option value="rating-desc">Highest rating</option><option value="rating-asc">Lowest rating</option><option value="characters-desc">Most characters</option><option value="characters-asc">Fewest characters</option><option value="pinned">Pinned first</option><option value="favorite">Liked first</option></select></label><label>Filter by tag<select id="displayTagFilter">'+tagOptions+'</select></label></section><section><h3>Library layout</h3><div class="display-view-options"><label><input type="radio" name="displayView" value="expanded"> Expanded cards</label><label><input type="radio" name="displayView" value="compact"> Compact cards</label></div><label class="display-columns-label">Cards per row<select id="displayColumns"><option value="1">1 column</option><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option><option value="5">5 columns</option><option value="6">6 columns</option></select></label><label class="display-detail-toggle"><input id="displayCollapsedDetail" type="checkbox"> Minimize novel and gallery details by default</label><label class="display-detail-toggle"><input id="displayHiddenDetail" type="checkbox"> Hide novel and gallery detail header completely</label></section><div class="row"><button id="resetEntryTabs" type="button">Reset tab settings</button><span class="grow"></span><button id="saveLibraryDisplay" class="primary">Apply</button></div></div>';
 modal('Library display',body,()=>{
  $('modalHost').querySelector('.modal-back')?.classList.add('library-display-overlay');$('modalHost').querySelector('.modal')?.classList.add('library-display-fullscreen');$('displaySort').value=localStorage.getItem('qrLibrarySort')||'recent';$('displayTagFilter').value=state.tagFilter||'all';$('displayColumns').value=localStorage.getItem('qrLibraryColumns')||'3';$('displayCollapsedDetail').checked=localStorage.getItem('qrBookDetailCollapsed')!=='0';$('displayHiddenDetail').checked=localStorage.getItem('qrBookDetailHidden')==='1';document.querySelector('[name="displayView"][value="'+(localStorage.getItem('qrLibraryView')||'expanded')+'"]').checked=true;
  $('modalHost').onclick=e=>{const lock=e.target.closest('[data-entry-lock]');if(!lock)return;const key=lock.dataset.entryLock;config[key]=config[key]||{};config[key].locked=config[key].locked===false?true:false;const input=document.querySelector('[data-entry-label="'+CSS.escape(key)+'"]');if(input)input.disabled=config[key].locked;lock.classList.toggle('locked',config[key].locked);lock.innerHTML=config[key].locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg>';lock.setAttribute('aria-label',config[key].locked?'Unlock name':'Lock name')};
  $('resetEntryTabs').onclick=()=>{localStorage.removeItem('qrLibraryEntryConfig');closeModal();drawLibrary();libraryDisplayModal()};
  $('saveLibraryDisplay').onclick=()=>{document.querySelectorAll('[data-entry-visible]').forEach(input=>{const key=input.dataset.entryVisible;config[key]=config[key]||{};config[key].visible=input.checked;const label=document.querySelector('[data-entry-label="'+CSS.escape(key)+'"]');if(label&&!config[key].locked)config[key].label=label.value.trim()||key.replace(/^tag:/,'')});localStorage.setItem('qrLibraryEntryConfig',JSON.stringify(config));localStorage.setItem('qrLibrarySort',$('displaySort').value);$('librarySort').value=$('displaySort').value;state.tagFilter=$('displayTagFilter').value;$('tagFilter').value=state.tagFilter;localStorage.setItem('qrLibraryView',document.querySelector('[name="displayView"]:checked')?.value||'expanded');localStorage.setItem('qrLibraryColumns',$('displayColumns').value);localStorage.setItem('qrBookDetailCollapsed',$('displayCollapsedDetail').checked?'1':'0');localStorage.setItem('qrBookDetailHidden',$('displayHiddenDetail').checked?'1':'0');document.body.classList.toggle('detail-header-hidden',$('displayHiddenDetail').checked);document.querySelector('.book-detail')?.classList.toggle('detail-collapsed',$('displayCollapsedDetail').checked);if($('toggleBookDetail'))$('toggleBookDetail').textContent=$('displayCollapsedDetail').checked?'⌄':'⌃';closeModal();drawLibrary();toast('Library display updated')};
 });
}
function addToLibraryModal(){modal('Add to library','<div class="add-library-options"><button type="button" data-add-kind="novel"><span>＋</span><b>New novel</b><small>Create an empty novel</small></button><button type="button" data-add-kind="epub"><span>▤</span><b>EPUB</b><small>Import an EPUB book</small></button><button type="button" data-add-kind="txt"><span>≡</span><b>TXT / Folder</b><small>Import text or a chapter folder</small></button><button type="button" data-add-kind="pdf"><span>▧</span><b>PDF</b><small>Import a PDF document</small></button><button type="button" data-add-kind="zip"><span>▣</span><b>ZIP archive</b><small>Import books from a ZIP</small></button></div>',()=>{$('modalHost').onclick=e=>{const button=e.target.closest('[data-add-kind]');if(!button)return;const kind=button.dataset.addKind;closeModal();if(kind==='novel')createNovel();else if(kind==='epub')$('importBook').click();else if(kind==='txt')$('importTextBook').click();else if(kind==='pdf')$('importPdfBook').click();else $('headerImportZipFile').click()}})}
function appearanceModal(){
 const themes=[['default','Quiet grey','Neutral slate'],['dark','Deep dark','Charcoal'],['midnight','Midnight','Blue-black'],['ocean','Ocean','Deep teal'],['forest','Forest','Green-black'],['plum','Plum','Dark violet'],['sepia','Sepia','Warm paper'],['light','Light','Bright neutral']];
 const current=localStorage.getItem('qbtheme')||'default';
 const themeBackgrounds={default:'#171d26',dark:'#10141b',midnight:'#090e18',ocean:'#0b1820',forest:'#101b17',plum:'#19131f',sepia:'#eee2ce',light:'#f4f6f8'};
 const activeAccent=localStorage.getItem('qrAccent')||getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#b9f27c';
 const activeBackground=localStorage.getItem('qrBackground')||themeBackgrounds[current]||'#171d26';
 const rows=themes.map(([id,name,detail])=>'<button type="button" class="appearance-option '+(id===current?'active':'')+'" data-appearance-theme="'+id+'"><span class="appearance-swatch appearance-swatch-'+id+'"></span><span class="appearance-option-copy"><b>'+name+'</b><small>'+detail+'</small></span><span class="appearance-option-check">'+(id===current?'✓':'')+'</span></button>').join('');
 const accents=['#b9f27c','#8be9fd','#63d8c5','#a3e6a0','#d6a5f5','#f0a6b8','#f2c66d','#ffffff'];
 const chips=accents.map(color=>'<button type="button" class="accent-chip" data-accent="'+color+'" style="--chip:'+color+'" aria-label="Accent '+color+'" title="'+color+'"></button>').join('');
 const body='<div class="appearance-tabs" role="tablist"><button type="button" class="active" data-appearance-tab="themes">Themes</button><button type="button" data-appearance-tab="accents">Accents</button><button type="button" data-appearance-tab="background">Background</button></div><section class="appearance-pane" data-appearance-pane="themes"><div class="appearance-options">'+rows+'</div></section><section class="appearance-pane hidden" data-appearance-pane="accents"><p class="muted tiny">Choose a preset or pick any accent colour. This updates highlights, controls, the brand mark and favicon.</p><div class="accent-presets">'+chips+'</div><label class="appearance-color-field">Custom accent<input id="customAccentColor" type="color" value="'+activeAccent+'"></label></section><section class="appearance-pane hidden" data-appearance-pane="background"><p class="muted tiny">Choose an independent page background. Panels adapt automatically.</p><label class="appearance-color-field">Background colour<input id="customBackgroundColor" type="color" value="'+activeBackground+'"></label><button type="button" id="resetBackgroundColor">Reset to theme background</button></section>';
 modal('Appearance',body,()=>{
  const host=$('modalHost');
  host.onclick=e=>{
   const tab=e.target.closest('[data-appearance-tab]');if(tab){host.querySelectorAll('[data-appearance-tab]').forEach(x=>x.classList.toggle('active',x===tab));host.querySelectorAll('[data-appearance-pane]').forEach(x=>x.classList.toggle('hidden',x.dataset.appearancePane!==tab.dataset.appearanceTab));return}
   const option=e.target.closest('[data-appearance-theme]');if(option){applyTheme(option.dataset.appearanceTheme);host.querySelectorAll('[data-appearance-theme]').forEach(x=>{x.classList.toggle('active',x===option);x.querySelector('.appearance-option-check').textContent=x===option?'✓':''})}
   const chip=e.target.closest('[data-accent]');if(chip){applyAccent(chip.dataset.accent);$('customAccentColor').value=chip.dataset.accent}
   if(e.target.closest('#resetBackgroundColor')){applyBackground(null);$('customBackgroundColor').value=themeBackgrounds[localStorage.getItem('qbtheme')||'default']}
  };
  $('customAccentColor').oninput=e=>applyAccent(e.target.value);
  $('customBackgroundColor').oninput=e=>applyBackground(e.target.value);
 });
}

function installCompactActionIcons(){
 const icons={
  editDetails:['Edit details','<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>'],
  manageNovelLinks:['Novel links','<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>'],
  editTags:['Edit tags','<path d="m20 13-7 7-10-10V3h7Z"/><circle cx="7.5" cy="7.5" r="1"/>'],
  changeCover:['Change cover','<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>'],
  pasteCover:['Paste cover','<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 13h6m-6 4h6"/>'],
  exportEpub:['Export EPUB','<path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 19v2h14v-2"/>'],
  addChapter:['Add chapter','<path d="M12 5v14M5 12h14"/>'],
  addTxtChapter:['Add TXT chapter','<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>'],
  addTxtChapters:['Bulk add TXT','<path d="M8 4h12v16H8z"/><path d="M4 8v13h12M11 9h6m-6 4h6"/>'],
  renameChapters:['Rename chapters','<path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'],
  addGalleryImages:['Add images','<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'],
  addGalleryFolder:['Add image folder','<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9H3z"/><path d="M12 10v6m-3-3h6"/>']
 };
 for(const [id,[label,path]] of Object.entries(icons)){const button=$(id);if(!button)continue;button.dataset.iconOnly='true';button.title=label;button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</g></svg>'}
}
installCompactActionIcons();
$('menuBtn').onclick=openDrawer;$('closeMenu').onclick=closeDrawer;$('scrim').onclick=closeDrawer;$('libraryDisplayBtn').onclick=()=>{closeDrawer();libraryDisplayModal()};$('manageCategoriesDrawer').onclick=()=>{closeDrawer();manageLibraryCategories()};$('homeBtn').onclick=e=>{e.preventDefault();stopAutoRead(false);refresh().then(()=>setScreen('library'))};
document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>{stopAutoRead(false);if(b.dataset.screen==='marks'){closeDrawer();showMarks();return}setScreen(b.dataset.screen);if(b.dataset.screen==='library')refresh()});
$('openAddMenu').onclick=addToLibraryModal;
function galleryAddMenu(){modal('Add gallery item','<div class="stack"><button type="button" id="galleryMenuNew" class="primary">＋ Create gallery</button><button type="button" id="galleryMenuImages">▧ Add images</button><button type="button" id="galleryMenuFolder">▤ Add folder</button><button type="button" id="galleryMenuZip">ZIP import</button></div>',()=>{$('galleryMenuNew').onclick=()=>{closeModal();createGallery()};$('galleryMenuImages').onclick=()=>{closeModal();createGallery('images')};$('galleryMenuFolder').onclick=()=>{closeModal();createGallery('folder')};$('galleryMenuZip').onclick=()=>{closeModal();$('headerGalleryZipFile').click()}})}
function collectionAddMenu(){if(state.collectionId){modal('Add collection item','<div class="stack"><button type="button" id="collectionMenuBrowse" class="primary">＋ Choose library items</button><button type="button" id="collectionMenuImages">▧ Add images</button></div>',()=>{$('collectionMenuBrowse').onclick=()=>{closeModal();document.querySelector('[data-collection-browse]')?.click()};$('collectionMenuImages').onclick=()=>{closeModal();$('collectionImageFiles')?.click()}});return}modal('Collections','<div class="stack"><button type="button" id="collectionMenuNew" class="primary">＋ New collection</button></div>',()=>{$('collectionMenuNew').onclick=()=>{closeModal();$('createCollectionButton')?.click()}})}
$('openGalleryAddMenu').onclick=galleryAddMenu;$('openCollectionAddMenu').onclick=collectionAddMenu;

$('headerImportZip').onclick=()=>$('headerImportZipFile').click();
$('headerGalleryZipFile').onchange=async e=>{const file=e.target.files[0];if(file)try{await importZipCollection(file,'gallery')}catch(error){alert('Could not import gallery ZIP: '+(error?.message||error))}e.target.value=''};
$('headerImportZipFile').onchange=async e=>{const file=e.target.files[0];if(file)try{await importZipCollection(file,'library')}catch(error){alert('Could not import ZIP: '+(error?.message||error))}e.target.value=''};$('globalHistoryBtn').onclick=()=>showUniversalHistory(state.books,(book,index)=>{state.book=book;openReader(index);syncTranslationControls();renderReaderLinks()});$('bookGrid').onclick=async e=>{if(handleCollectionAction(e)){if(state.screen==='book'&&state.book?.source==='gallery')renderGallery();if(state.screen==='reader'){syncTranslationControls();renderReaderLinks()}return}const link=e.target.closest('[data-manage-novel-links]');if(link){const book=state.books.find(b=>b.id===link.dataset.manageNovelLinks);if(book)manageNovelLinks(book);return}const continuation=e.target.closest('[data-continue]');if(continuation){const book=state.books.find(item=>item.id===continuation.dataset.continue);if(book?.source==='gallery'){await continueGallery(book);return}}await handleLibraryClick(e);if(state.screen==='book'&&state.book?.source==='gallery')renderGallery();if(state.screen==='reader')renderReaderLinks()};$('pasteList').onclick=handleLibraryClick;$('toggleBookDetail').onclick=()=>{const collapsed=document.querySelector('.book-detail')?.classList.toggle('detail-collapsed');localStorage.setItem('qrBookDetailCollapsed',collapsed?'1':'0');$('toggleBookDetail').textContent=collapsed?'⌄':'⌃';$('toggleBookDetail').title=collapsed?'Expand details':'Collapse details'};if(localStorage.getItem('qrBookDetailCollapsed')!=='0'){document.querySelector('.book-detail')?.classList.add('detail-collapsed');$('toggleBookDetail').textContent='⌄'}document.body.classList.toggle('detail-header-hidden',localStorage.getItem('qrBookDetailHidden')==='1');
$('bookTabs').onclick=async e=>{const tab=e.target.closest('[data-book-tab]');if(tab){if(state.book&&tab.dataset.bookTab!=='notes'&&state.book.notesLocked===false){clearTimeout(window.__qrNotesSaveTimer);await saveBookNotes({lock:true,silent:true})}setBookTab(tab.dataset.bookTab);if(tab.dataset.bookTab==='gallery')renderGallery()}};$('bookHistoryContent').onclick=e=>{const row=e.target.closest('[data-open-reading-history]');if(!row)return;const book=state.books.find(item=>item.id===row.dataset.openReadingHistory);if(book){state.book=book;openReader(Number(row.dataset.historyChapter));syncTranslationControls();renderReaderLinks()}};$('bookNotes').addEventListener('input',()=>{if(!state.book)return;state.book.notesLocked=false;$('noteLockToggle').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> Lock notes';$('noteLockToggle').setAttribute('aria-pressed','true');$('notesSaveStatus').textContent='Saving…';clearTimeout(window.__qrNotesSaveTimer);window.__qrNotesSaveTimer=setTimeout(()=>saveBookNotes({silent:true}),650)});$('noteLockToggle').onclick=async()=>{if(!state.book)return;if(state.book.notesLocked!==false){state.book.notesLocked=false;await put(state.book);drawBook();$('bookNotes').focus();toast('Notes unlocked')}else await saveBookNotes({lock:true})};$('manageNovelLinks').onclick=()=>manageNovelLinks(state.book);
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.tagFilter='all';if($('tagFilter'))$('tagFilter').value='all';document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));syncHeaderActions(state.filter==='gallery'?'gallery':'library');drawLibrary()});$('tagFilter').onchange=e=>{state.tagFilter=e.target.value;drawLibrary()};$('librarySort').value=localStorage.getItem('qrLibrarySort')||'recent';$('librarySort').onchange=e=>{localStorage.setItem('qrLibrarySort',e.target.value);drawLibrary()};$('bookRating').onchange=async e=>{if(!state.book)return;if(state.book.locked){e.target.value=String(Number(state.book.rating)||0);return toast('Unlock editing first')}state.book.rating=Number(e.target.value)||0;state.book.updated=Date.now();await put(state.book);await refresh();drawBook()};document.querySelectorAll('[data-library-view]').forEach(button=>button.onclick=()=>setLibraryView(button.dataset.libraryView));
$('savePaste').onclick=savePasteOnly;$('readPaste').onclick=()=>savePasteAsBook(true);$('pasteText').oninput=e=>$('charCount').textContent=[...e.target.value].length+' characters';
$('backLibrary').onclick=()=>{refresh();setScreen('library')};$('lockBook').onclick=async()=>{state.book.locked=!state.book.locked;await put(state.book);drawBook();if(state.book.source==='gallery')renderGallery();toast(state.book.locked?(state.book.source==='gallery'?'Gallery locked':'Editing locked'):(state.book.source==='gallery'?'Gallery unlocked':'Editing unlocked'))};$('editDetails').onclick=detailsModal;$('editTags').onclick=editTagsModal;
$('changeCover').onclick=()=>$('coverFile').click();$('coverFile').onchange=async e=>{if(e.target.files[0]){state.book.cover=await dataURL(e.target.files[0]);addEditEvent(state.book,'Cover changed','Book cover updated from file');await put(state.book);drawBook()}};
async function pasteCoverFromClipboard(){if(!state.book||state.book.locked)return toast('Unlock editing first');if(!navigator.clipboard?.read)return toast('Clipboard image access is unavailable in this browser');try{const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(!type)continue;const blob=await item.getType(type);const file=new File([blob],'pasted-cover.'+(type.split('/')[1]||'png'),{type});if(!(await confirmImagePreview(file,{title:'Preview book cover',confirmLabel:'Use as cover'})))return;state.book.cover=await dataURL(file);state.book.updated=Date.now();addEditEvent(state.book,'Cover pasted','Book cover updated from clipboard');await put(state.book);await refresh();drawBook();toast('Cover pasted');return}toast('No image found in clipboard')}catch(error){toast('Could not read clipboard image. Check browser clipboard permission.')}}
$('pasteCover').onclick=pasteCoverFromClipboard;
$('addChapter').onclick=()=>editChapter(null);$('renameChapters').onclick=renameChapters;$('pasteEditorImage').onclick=pasteEditorImage;$('editChapterText').addEventListener('paste',event=>{const file=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();import('./editor.js').then(module=>module.insertImage(file))}});$('addGalleryImages').onclick=addGalleryImages;$('addGalleryFolder').onclick=addGalleryFolder;$('galleryImageFiles').onchange=async e=>{if(e.target.files.length)await importGalleryFiles(e.target.files);e.target.value=''};$('galleryFolderFiles').onchange=async e=>{if(e.target.files.length)await importGalleryFiles(e.target.files);e.target.value=''};$('addTxtChapter').onclick=()=>$('singleChapterTxt').click();$('addTxtChapters').onclick=()=>$('multipleChapterTxt').click();$('singleChapterTxt').onchange=async e=>{if(e.target.files.length)await importTextChapters(e.target.files);e.target.value=''};$('multipleChapterTxt').onchange=async e=>{if(e.target.files.length)await importTextChapters(e.target.files);e.target.value=''};$('chapterList').onclick=async e=>{if(handleCollectionAction(e)){if(state.screen==='reader'){syncTranslationControls();renderReaderLinks()}return}const move=e.target.closest('[data-chapter-move]');if(move){const index=Number(move.dataset.chapterMove),delta=Number(move.dataset.delta);if(state.book.locked)return toast('Unlock editing first');const target=index+delta;if(target<0||target>=state.book.chapters.length)return;const swap=(a,b)=>a===index?target:a===target?index:a;[state.book.chapters[index],state.book.chapters[target]]=[state.book.chapters[target],state.book.chapters[index]];for(const book of state.books){let changed=false;for(const chapter of book.chapters||[])for(const link of chapter.links||[])if(link.targetBookId===state.book.id&&Number.isInteger(Number(link.targetChapterIndex))){const n=swap(Number(link.targetChapterIndex));if(n!==Number(link.targetChapterIndex)){link.targetChapterIndex=n;changed=true}}if(book.id===state.book.id){for(const mark of book.bookmarks||[])mark.chapter=swap(Number(mark.chapter));if(book.progress)book.progress.chapter=swap(Number(book.progress.chapter));for(const item of book.readingHistory||[])item.chapterIndex=swap(Number(item.chapterIndex));changed=true}if(changed){addEditEvent(book===state.book?book:null,'Chapter order changed','Moved '+(state.book.chapters[target].title||'chapter')+' to position '+(target+1));await put(book)}}await refresh();drawBook();return}const history=e.target.closest('[data-history]'),edit=e.target.closest('[data-edit]'),links=e.target.closest('[data-manage-chapter-links]'),read=e.target.closest('[data-read],[data-read-button]');if(links){if(state.book?.locked)return toast('Unlock editing first');manageChapterLinks(state.book,Number(links.dataset.manageChapterLinks));}else if(history)showChapterHistory(Number(history.dataset.history));else if(edit)editChapter(Number(edit.dataset.edit));else if(read){openReader(Number(read.dataset.read??read.dataset.readButton));syncTranslationControls();renderReaderLinks()}};
$('editorBack').onclick=()=>{drawBook();setScreen('book')};$('saveChapter').onclick=saveChapter;$('deleteChapter').onclick=deleteChapter;$('insertImage').onclick=()=>$('imageFile').click();$('imageFile').onchange=async e=>{await insertImage(e.target.files[0]);e.target.value=''};
$('importBook').onclick=()=>$('epubFile').click();$('importPdfBook').onclick=()=>$('pdfFile').click();$('pdfFile').onchange=async e=>{if(e.target.files[0])await importPDF(e.target.files[0]);e.target.value=''};$('importTextBook').onclick=()=>modal('Import a TXT novel','<div class="stack"><p class="muted">Choose one TXT file to create a one-chapter novel, or choose a folder to import its TXT files as ordered chapters.</p><button id="chooseSingleTxt" class="primary">Choose TXT file</button><button id="chooseTxtFolder">Choose folder of TXT files</button></div>',()=>{$('chooseSingleTxt').onclick=()=>{closeModal();$('singleTxtFile').click()};$('chooseTxtFolder').onclick=()=>{closeModal();$('txtFolderFiles').click()}});$('singleTxtFile').onchange=async e=>{if(e.target.files.length)await importTextBook(e.target.files);e.target.value=''};$('txtFolderFiles').onchange=async e=>{if(e.target.files.length)await importTextBook(e.target.files);e.target.value=''};$('epubFile').onchange=async e=>{if(e.target.files[0])await importEPUB(e.target.files[0]);e.target.value=''};$('exportEpub').onclick=exportEPUB;
$('chapterFormatControls').addEventListener('click',e=>{const copy=e.target.closest('[data-copy-chapter]'),format=e.target.closest('[data-chapter-format]');if(copy)copyChapter();else if(e.target.closest('#translateChapter'))openTranslatePage();else if(e.target.closest('#restoreTranslation'))restoreOriginalChapter();else if(e.target.closest('#copyTranslatedChapter'))copyTranslatedChapter();else if(format)renderChapterFormat(format.dataset.chapterFormat)});$('sectionView').addEventListener('click',e=>{const chapterCopy=e.target.closest('[data-copy-chapter]'),copy=e.target.closest('[data-copy-section]'),toggle=e.target.closest('[data-toggle-section]');if(chapterCopy)copyChapter();if(copy)copySection(copy.dataset.copySection);if(toggle)toggleSection(toggle.dataset.toggleSection,toggle)});$('readerMenuBtn').onclick=()=>{$('readerPanel').classList.remove('hidden');$('scrim').classList.remove('hidden')};$('closeReaderPanel').onclick=()=>{$('readerPanel').classList.add('hidden');$('scrim').classList.add('hidden')};$('jumpChapter').onchange=async e=>{await jumpChapter(e.target.value);syncTranslationControls();renderReaderLinks()};let novelSearchTimer;$('novelSearch').oninput=e=>{clearTimeout(novelSearchTimer);const query=e.target.value;novelSearchTimer=setTimeout(()=>searchNovel(query),120)};$('novelSearchResults').onclick=e=>{if(e.target.closest('[data-search-more]')){showMoreNovelSearchResults();return}const result=e.target.closest('[data-search-result]');if(!result)return;const query=$('novelSearch').value;$('readerPanel').classList.add('hidden');$('scrim').classList.add('hidden');openNovelSearchResult(result.dataset.searchChapter,result.dataset.searchParagraph,result.dataset.searchOffset,query,result.dataset.searchTitle==='1');syncTranslationControls()};$('readerBookTitle').onclick=async()=>{stopAutoRead(false);await saveProgress();setBookTab('chapters');drawBook();setScreen('book')};$('prevChapter').onclick=async()=>{await changeChapter(-1);syncTranslationControls();renderReaderLinks()};$('nextChapter').onclick=async()=>{await changeChapter(1);syncTranslationControls();renderReaderLinks()};$('topPrevChapter').onclick=async()=>{await changeChapter(-1);syncTranslationControls();renderReaderLinks()};$('topNextChapter').onclick=async()=>{await changeChapter(1);syncTranslationControls();renderReaderLinks()};$('chapterIndex').onclick=async()=>{stopAutoRead(false);await saveProgress();setBookTab('chapters');drawBook();setScreen('book')};$('bookmarkBtn').onclick=addBookmark;$('readerScrollTop').onclick=()=>$('screen-reader').scrollTo({top:0,behavior:'smooth'});$('readerScrollBottom').onclick=()=>$('screen-reader').scrollTo({top:$('screen-reader').scrollHeight,behavior:'smooth'});$('autoReadStart').onclick=startAutoRead;$('autoReadPause').onclick=pauseAutoRead;$('autoReadStop').onclick=()=>stopAutoRead();$('autoReadSpeed').oninput=setAutoReadSpeed;$('ttsSpeechSpeed').onchange=setTTSSpeechSpeed;$('ttsEnabled').onchange=setTTSEnabled;$('ttsVoice').onchange=setTTSVoice;$('ttsEngine').onchange=setTTSEngine;$('kokoroVoice').onchange=()=>{if(state.screen==='reader'&&$('autoReadStart')&&!$('autoReadPause').disabled){stopAutoRead(false);startAutoRead()}};$('showMarks').onclick=showMarks;$('readerTheme').onchange=e=>applyTheme(e.target.value);$('textSize').oninput=e=>$('readingBody').style.fontSize=e.target.value+'px';$('autoReadHighlightColor').value=localStorage.getItem('qrAutoReadHighlight')||'#d7c477';$('autoReadHighlightColor').oninput=e=>{document.documentElement.style.setProperty('--auto-read-highlight',e.target.value);localStorage.setItem('qrAutoReadHighlight',e.target.value)};document.documentElement.style.setProperty('--auto-read-highlight',localStorage.getItem('qrAutoReadHighlight')||'#d7c477');$('readingWidth').oninput=e=>document.documentElement.style.setProperty('--reader-width',e.target.value+'px');$('exitReader').onclick=async()=>{stopAutoRead(false);await saveProgress();drawBook();setScreen('book')};$('editReadingChapter').onclick=async()=>{stopAutoRead(false);if(state.book.locked)return toast('Unlock editing first');await saveProgress();editChapter(state.chapter)};
$('appearanceBtn').onclick=()=>{closeDrawer();appearanceModal()};$('translationSourcesBtn').onclick=()=>{closeDrawer();manageTranslationSources()};$('tagColorsBtn').onclick=()=>{closeDrawer();tagColorsModal()};$('backupBtn').onclick=()=>{closeDrawer();exportBackup()};$('restoreBtn').onclick=()=>{closeDrawer();$('restoreFile').click()};
$('lnReaderRestoreBtn').onclick=()=>{closeDrawer();$('lnReaderBackupFile').click()};
$('archiveRestoreBtn').onclick=()=>{closeDrawer();$('archiveFile').click()};
$('restoreFile').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value=''};
$('lnReaderBackupFile').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value=''};
$('archiveFile').onchange=async e=>{if(e.target.files[0])try{await importZipCollection(e.target.files[0],'library')}catch(error){alert('Could not import ZIP: '+(error?.message||error))}e.target.value=''};
const readFromHere=$('readFromHere');readFromHere.classList.add('hidden');const readingBody=$('readingBody');const selectionBar=$('selectionToolbar');function canReadFromHere(){return state.screen==='reader'&&$('ttsEnabled')?.checked&&isAutoReadSpeaking()}readingBody.addEventListener('pointerover',e=>{const p=e.target.closest('p');if(!p||!readingBody.contains(p)||e.pointerType==='touch'||!canReadFromHere())return;p.classList.add('read-from-here-hover')});readingBody.addEventListener('pointerout',e=>{const p=e.target.closest('p');if(p&&!p.contains(e.relatedTarget))p.classList.remove('read-from-here-hover')});readingBody.addEventListener('click',e=>{const p=e.target.closest('p');if(!p||!readingBody.contains(p)||!canReadFromHere())return;const index=[...readingBody.querySelectorAll('p')].indexOf(p);if(index<0)return;setAutoReadPosition(index)});let selectionTimer,savedSelectionRange=null,activeParagraph=null;
function rememberSelection(){const selection=getSelection();if(selection&&!selection.isCollapsed&&selection.rangeCount){const range=selection.getRangeAt(0);if(readingBody.contains(range.commonAncestorContainer))savedSelectionRange=range.cloneRange()}}
function showParagraphToolbar(paragraph){if(!paragraph)return;activeParagraph=paragraph;const bar=$('selectionToolbar'),rect=paragraph.getBoundingClientRect();bar.classList.remove('hidden');const width=bar.offsetWidth,height=bar.offsetHeight;let left=rect.left+rect.width/2;left=Math.max(width/2+10,Math.min(innerWidth-width/2-10,left));let top=rect.top-height-10;if(top<8)top=Math.min(innerHeight-height-8,rect.bottom+10);bar.style.left=left+'px';bar.style.top=Math.max(8,top)+'px'}
document.addEventListener('selectionchange',()=>{rememberSelection();clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>{if(state.screen==='reader')positionSelectionToolbar()},180)});
$('readingBody').addEventListener('mouseup',()=>{rememberSelection();setTimeout(positionSelectionToolbar,30)});
$('readingBody').addEventListener('touchend',()=>{rememberSelection();setTimeout(positionSelectionToolbar,250)});
$('chapterLinkNav').onclick=e=>{const link=e.target.closest('[data-open-linked-book]'),manage=e.target.closest('[data-manage-current-chapter]');if(manage){manageChapterLinks(state.book,state.chapter);return}if(link){openLinkedChapter(link.dataset.openLinkedBook,link.dataset.openLinkedChapter);syncTranslationControls();renderReaderLinks()}};$('readingBody').addEventListener('click',e=>{if(getSelection()?.isCollapsed){const paragraph=e.target.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6,pre');if(paragraph&&readingBody.contains(paragraph))showParagraphToolbar(paragraph)}});
selectionBar.addEventListener('mousedown',e=>e.preventDefault());
selectionBar.addEventListener('touchstart',e=>{rememberSelection();e.preventDefault()},{passive:false});
let paragraphHighlightTarget=null;
selectionBar.addEventListener('click',e=>{
 const paragraphButton=e.target.closest('[data-highlight-paragraph]');
 if(paragraphButton){
  const node=savedSelectionRange?.commonAncestorContainer;
  const selectedParagraph=node?(node.nodeType===1?node:node.parentElement)?.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6,pre'):null;
  paragraphHighlightTarget=selectedParagraph||activeParagraph;
  if(!paragraphHighlightTarget){toast('Tap inside a paragraph first');return}
  return;
 }
 const swatch=e.target.closest('[data-highlight-color]');
 if(swatch){
  if(paragraphHighlightTarget){const target=paragraphHighlightTarget;paragraphHighlightTarget=null;addParagraphHighlight(target,swatch.dataset.highlightColor)}
  else addHighlight(swatch.dataset.highlightColor,savedSelectionRange);
 }
 if(e.target.closest('[data-highlight-bookmark]'))bookmarkFromSelection()
});document.addEventListener('pointerdown',e=>{if(!e.target.closest('#selectionToolbar')&&!e.target.closest('#readingBody'))hideSelectionToolbar()});let progressTimer;window.addEventListener('scroll',()=>{if(state.screen==='reader'){clearTimeout(progressTimer);progressTimer=setTimeout(saveProgress,450)}});
await refresh();enhanceSelects();initTheme();initTTS();setTTSEngine();let appUpdateRegistration=null;
let reloadAfterAppUpdate=false;
function refreshAppUpdateStatus(){
 const status=document.getElementById('appUpdateStatus');
 const install=document.getElementById('installAppUpdate');
 if(!status||!install)return;
 if(!navigator.onLine){status.textContent='Offline. The currently cached app remains available.';install.disabled=!appUpdateRegistration?.waiting;return}
 if(appUpdateRegistration?.waiting){status.textContent='A newer app version is downloaded and ready to install.';install.disabled=false;return}
 if(appUpdateRegistration?.installing){status.textContent='Downloading and preparing the app update…';install.disabled=true;return}
 status.textContent=navigator.serviceWorker?.controller?'Offline app shell is ready. No update is waiting.':'Preparing the first offline app cache…';
 install.disabled=true;
}
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(registration=>{
  appUpdateRegistration=registration;
  const watch=worker=>{
   if(!worker)return;
   worker.addEventListener('statechange',refreshAppUpdateStatus);
  };
  watch(registration.installing);
  registration.addEventListener('updatefound',()=>{watch(registration.installing);refreshAppUpdateStatus()});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   refreshAppUpdateStatus();
   if(reloadAfterAppUpdate)location.reload();
  });
  registration.update().catch(()=>{});
  refreshAppUpdateStatus();
 }).catch(()=>{
  const status=document.getElementById('appUpdateStatus');
  if(status)status.textContent='Offline updates are unavailable in this browser context.';
 });
}
document.getElementById('checkAppUpdate')?.addEventListener('click',async()=>{
 const status=document.getElementById('appUpdateStatus');
 if(!appUpdateRegistration){if(status)status.textContent='Service worker is not ready yet.';return}
 if(!navigator.onLine){if(status)status.textContent='Connect to the internet to check for updates.';return}
 if(status)status.textContent='Checking the published website for an update…';
 try{
  await appUpdateRegistration.update();
  refreshAppUpdateStatus();
  if(!appUpdateRegistration.waiting&&!appUpdateRegistration.installing&&status)status.textContent='You already have the latest published app version.';
 }catch{if(status)status.textContent='Could not check for updates. Your current app and local data are unchanged.'}
});
document.getElementById('installAppUpdate')?.addEventListener('click',()=>{
 if(!appUpdateRegistration?.waiting)return;
 reloadAfterAppUpdate=true;
 const status=document.getElementById('appUpdateStatus');
 if(status)status.textContent='Installing the update. The app will reload when the new version takes control.';
 appUpdateRegistration.waiting.postMessage({type:'SKIP_WAITING'});
});
window.addEventListener('online',refreshAppUpdateStatus);
window.addEventListener('offline',refreshAppUpdateStatus);setScreen('library');

// Top-level Library / Galleries navigation and user-defined library categories.
function syncHeaderActions(section){
 const gallery=section==='gallery',collections=section==='collections';
 $('galleryHeaderActions')?.classList.toggle('hidden',!gallery);
 $('collectionHeaderActions')?.classList.toggle('hidden',!collections);
 $('libraryHeaderActions')?.classList.toggle('hidden',gallery||collections);
 document.querySelectorAll('[data-main-section]').forEach(button=>{
  const active=button.dataset.mainSection===section;
  button.classList.toggle('active',active);
  button.setAttribute('aria-current',active?'page':'false');
 });
}
function setMainSection(section){
 const gallery=section==='gallery';
 state.filter=section==='collections'?'collections':gallery?'gallery':'all';
 state.collectionId=null;
 syncHeaderActions(section);
 document.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===state.filter));
 drawLibrary();
}
document.querySelectorAll('[data-main-section]').forEach(button=>{
 button.addEventListener('click',()=>setMainSection(button.dataset.mainSection));
});
syncHeaderActions(state.filter==='gallery'?'gallery':'library');
$('homeBtn')?.addEventListener('click',()=>setMainSection('library'));
let globalSearchTimer;$('globalSearchInput')?.addEventListener('input',event=>{clearTimeout(globalSearchTimer);const query=event.target.value;if(query.trim()){state.filter='all';state.collectionId=null;syncHeaderActions('library')}globalSearchTimer=setTimeout(()=>setLibrarySearch(query),90)});
$('globalSearchInput')?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.target.value='';setLibrarySearch('');event.target.blur()}if(event.key==='Enter'){state.filter='all';syncHeaderActions('library');drawLibrary()}});
$('customCategoryFilters')?.addEventListener('click',event=>{
 const button=event.target.closest('[data-category-filter]');
 if(!button)return;
 state.tagFilter=button.dataset.categoryFilter;
 state.filter='all';syncHeaderActions('library');
 document.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item.dataset.filter==='all'));
 if($('tagFilter'))$('tagFilter').value=state.tagFilter;
 drawLibrary();
});
function manageLibraryCategories(){
 let categories=(()=>{try{const value=JSON.parse(localStorage.getItem('qrLibraryCategories')||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return []}})();
 const body='<div class="stack"><p class="muted tiny">Create your own library categories. Assign a category to a novel from its details → Edit tags. Categories also appear as quick filters above your library.</p><div class="row category-create-row"><input id="newLibraryCategory" placeholder="Category name" maxlength="32"><button id="addLibraryCategory" class="primary">Add</button></div><div id="libraryCategoryList" class="category-manager-list"></div></div>';
 modal('Manage categories',body,()=>{
  const host=$('libraryCategoryList');
  const render=()=>{
   host.innerHTML=categories.length?categories.map((name,index)=>'<div class="category-manager-item"><span class="category-dot"></span><b>'+String(name).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))+'</b><span class="grow"></span><button type="button" data-remove-category="'+index+'" aria-label="Remove '+String(name).replace(/"/g,'&quot;')+'">Remove</button></div>').join(''):'<p class="muted tiny">No custom categories yet.</p>';
  };
  const save=()=>{localStorage.setItem('qrLibraryCategories',JSON.stringify(categories));drawLibrary();render()};
  $('addLibraryCategory').onclick=()=>{
   const input=$('newLibraryCategory'),name=input.value.trim();
   if(!name)return toast('Enter a category name');
   if(categories.some(item=>item.toLocaleLowerCase()===name.toLocaleLowerCase()))return toast('That category already exists');
   categories.push(name);categories.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));input.value='';save();
  };
  $('newLibraryCategory').onkeydown=event=>{if(event.key==='Enter')$('addLibraryCategory').click()};
  host.onclick=event=>{
   const button=event.target.closest('[data-remove-category]');
   if(!button)return;
   categories.splice(Number(button.dataset.removeCategory),1);
   if(state.tagFilter&&!categories.includes(state.tagFilter))state.tagFilter='all';
   save();
  };
  render();
 });
}
$('manageCategories')?.addEventListener('click',manageLibraryCategories);

document.querySelectorAll('[data-filter]').forEach(button=>{
 button.addEventListener('click',()=>{
  const gallery=button.dataset.filter==='gallery';
  document.querySelectorAll('[data-main-section]').forEach(nav=>nav.classList.toggle('active',nav.dataset.mainSection===(gallery?'gallery':'library')));
 });
});
document.querySelectorAll('[data-category-filter]').forEach(button=>{
 button.addEventListener('click',()=>{
  document.querySelectorAll('[data-main-section]').forEach(nav=>nav.classList.toggle('active',nav.dataset.mainSection==='library'));
 });
});
