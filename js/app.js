import {$,esc,toast,modal,closeModal,dataURL} from './utils.js';import {state,setScreen} from './state.js';import {refresh,drawBook,drawLibrary,openBook,createNovel,handleLibraryClick,savePasteAsBook,savePasteOnly,setBookTab,saveBookNotes,setLibraryView,setLibrarySearch,showChapterHistory,handleCollectionAction} from './library.js';import {editChapter,saveChapter,deleteChapter,insertImage,importTextBook,importTextChapters} from './editor.js';import {openReader,drawReader,saveProgress,changeChapter,jumpChapter,addBookmark,renderChapterFormat,copySection,copyChapter,toggleSection,startAutoRead,pauseAutoRead,stopAutoRead,setAutoReadPosition,isAutoReadSpeaking,isAutoReadActive,setAutoReadSpeed,setTTSSpeechSpeed,searchNovel,showMoreNovelSearchResults,openNovelSearchResult,initTTS,setTTSEnabled,setTTSVoice,setTTSEngine} from './reader.js';import {addHighlight,addParagraphHighlight,showMarks,positionSelectionToolbar,hideSelectionToolbar,bookmarkFromSelection} from './highlights.js';import {applyTheme,applyAccent,applyBackground,applyTextColor,applyHoverColor,initTheme} from './themes.js';import {exportBackup,importBackup,importZipCollection} from './backup.js';import {importEPUB,exportEPUB} from './epub.js';import {importPDF} from './pdf.js';import {put} from './db.js';import {manageNovelLinks,manageChapterLinks,renderReaderLinks,openLinkedChapter} from './links.js';import {manageTranslationSources,openTranslatePage,restoreOriginalChapter,copyTranslatedChapter,syncTranslationControls} from './translation.js';import {renameChapters} from './chapter-tools.js';import {showUniversalHistory} from './history.js';import {createGallery,addGalleryImages,addGalleryFolder,importGalleryFiles,renderGallery,continueGallery,pasteGalleryImages} from './galleries.js';import {pasteEditorImage} from './editor.js';import {addEditEvent} from './history.js';import {confirmImagePreview} from './image-preview.js';
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
 const defaults=[['all','All entries'],['epub','EPUB'],['manhwa','Manhwa'],['pdf','PDF'],['manual','Novels'],['gallery','Galleries'],['lnreader','LN Reader']];
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
  $('saveLibraryDisplay').onclick=()=>{document.querySelectorAll('[data-entry-visible]').forEach(input=>{const key=input.dataset.entryVisible;config[key]=config[key]||{};config[key].visible=input.checked;const label=document.querySelector('[data-entry-label="'+CSS.escape(key)+'"]');if(label&&!config[key].locked)config[key].label=label.value.trim()||key.replace(/^tag:/,'')});localStorage.setItem('qrLibraryEntryConfig',JSON.stringify(config));localStorage.setItem('qrLibrarySort',$('displaySort').value);$('librarySort').value=$('displaySort').value;state.tagFilter=$('displayTagFilter').value;$('tagFilter').value=state.tagFilter;localStorage.setItem('qrLibraryView',document.querySelector('[name="displayView"]:checked')?.value||'expanded');localStorage.setItem('qrLibraryColumns',$('displayColumns').value);localStorage.setItem('qrBookDetailCollapsed',$('displayCollapsedDetail').checked?'1':'0');localStorage.setItem('qrBookDetailHidden',$('displayHiddenDetail').checked?'1':'0');document.body.classList.toggle('detail-header-hidden',$('displayHiddenDetail').checked);document.querySelector('.book-detail')?.classList.toggle('detail-collapsed',$('displayCollapsedDetail').checked);if($('toggleBookDetail'))renderBookDetailToggle($('displayCollapsedDetail').checked);closeModal();drawLibrary();toast('Library display updated')};
 });
}
function addToLibraryModal(){modal('Add to library','<div class="add-library-options"><button type="button" data-add-kind="novel"><span>＋</span><b>New novel</b><small>Create an empty novel</small></button><button type="button" data-add-kind="epub"><span>▤</span><b>EPUB</b><small>Import an EPUB book</small></button><button type="button" data-add-kind="txt"><span>≡</span><b>TXT / Folder</b><small>Import text or a chapter folder</small></button><button type="button" data-add-kind="pdf"><span>▧</span><b>PDF</b><small>Import a PDF document</small></button><button type="button" data-add-kind="zip"><span>▣</span><b>ZIP archive</b><small>Import books from a ZIP</small></button></div>',()=>{$('modalHost').onclick=e=>{const button=e.target.closest('[data-add-kind]');if(!button)return;const kind=button.dataset.addKind;closeModal();if(kind==='novel')createNovel();else if(kind==='epub')$('importBook').click();else if(kind==='txt')$('importTextBook').click();else if(kind==='pdf')$('importPdfBook').click();else $('headerImportZipFile').click()}})}
function renderBookDetailToggle(collapsed){
 const button=$('toggleBookDetail');if(!button)return;
 const path=collapsed?'M6 9l6 6 6-6':'M6 15l6-6 6 6';
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
 button.setAttribute('aria-label',collapsed?'Expand details':'Collapse details');
 button.title=collapsed?'Expand details':'Collapse details';
}
function readColorHistory(key,allowAlpha=false){
 try{return JSON.parse(localStorage.getItem(key)||'[]').filter(value=>allowAlpha?/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value):/^#[0-9a-f]{6}$/i.test(value)).slice(0,10)}catch{return []}
}
function colorHistoryMarkup(key,kind){
 const colors=readColorHistory(key,kind==='background'||kind==='hover');
 return '<div class="color-history" aria-label="Recently selected colors">'+(colors.length?colors.map(color=>'<button type="button" class="color-history-chip" data-history-'+kind+'="'+color+'" style="--history-color:'+color+'" title="'+color+'" aria-label="Use '+color+'"></button>').join(''):'<span class="muted tiny">Your last 10 selected colors will appear here.</span>')+'</div>';
}
function appearanceModal(){
 const themes=[['default','Quiet grey','Soft neutral grey'],['dark','Deep dark','Charcoal'],['midnight','Midnight','Blue-black'],['ocean','Ocean','Deep teal'],['forest','Forest','Green-black'],['plum','Plum','Dark violet'],['sepia','Sepia','Warm paper'],['light','Light','Bright neutral']];
 const current=localStorage.getItem('qbtheme')||'default';
 const themeBackgrounds={default:'#47474747',dark:'#10141b',midnight:'#090e18',ocean:'#0b1820',forest:'#101b17',plum:'#19131f',sepia:'#eee2ce',light:'#f4f6f8'};
 const activeAccent=localStorage.getItem('qrAccent')||getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#b9f27c';
 const activeBackground=(localStorage.getItem('qrBackground')||themeBackgrounds[current]||'#47474747').slice(0,7);
 const activeText=localStorage.getItem('qrTextColor')||getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#eeeeee';
 const activeHover=localStorage.getItem('qrHoverColor')||'#555555';
 const rows=themes.map(([id,name,detail])=>'<button type="button" class="appearance-option '+(id===current?'active':'')+'" data-appearance-theme="'+id+'"><span class="appearance-swatch appearance-swatch-'+id+'"></span><span class="appearance-option-copy"><b>'+name+'</b><small>'+detail+'</small></span><span class="appearance-option-check">'+(id===current?'✓':'')+'</span></button>').join('');
 const accents=['#b9f27c','#8be9fd','#63d8c5','#a3e6a0','#d6a5f5','#f0a6b8','#f2c66d','#ffffff'];
 const chips=accents.map(color=>'<button type="button" class="accent-chip" data-accent="'+color+'" style="--chip:'+color+'" aria-label="Accent '+color+'" title="'+color+'"></button>').join('');
 const body='<div class="appearance-tabs" role="tablist"><button type="button" class="active" data-appearance-tab="themes">Themes</button><button type="button" data-appearance-tab="accents">Accents</button><button type="button" data-appearance-tab="background">Background</button><button type="button" data-appearance-tab="text">Text color</button><button type="button" data-appearance-tab="hover">Hover color</button></div>'+
 '<section class="appearance-pane" data-appearance-pane="themes"><div class="appearance-options">'+rows+'</div></section>'+
 '<section class="appearance-pane hidden" data-appearance-pane="accents"><p class="muted tiny">Accent color is shared by active controls, buttons, reader focus/highlight halos, TTS and scroll controls.</p><div class="accent-presets">'+chips+'</div><label class="appearance-color-field">Custom accent<input id="customAccentColor" type="color" value="'+activeAccent+'"></label><h3 class="appearance-history-heading">Recent accent colors</h3><div id="accentColorHistory">'+colorHistoryMarkup('qrAccentHistory','accent')+'</div></section>'+
 '<section class="appearance-pane hidden" data-appearance-pane="background"><p class="muted tiny">Choose an independent page background. Panels adapt automatically.</p><label class="appearance-color-field">Background color<input id="customBackgroundColor" type="color" value="'+activeBackground+'"></label><h3 class="appearance-history-heading">Recent background colors</h3><div id="backgroundColorHistory">'+colorHistoryMarkup('qrBackgroundHistory','background')+'</div><button type="button" id="resetBackgroundColor">Reset to theme background</button></section>'+
 '<section class="appearance-pane hidden" data-appearance-pane="text"><p class="muted tiny">Set the main text color across the library, settings and reader.</p><label class="appearance-color-field">Text color<input id="customTextColor" type="color" value="'+activeText+'"></label><h3 class="appearance-history-heading">Recent text colors</h3><div id="textColorHistory">'+colorHistoryMarkup('qrTextColorHistory','text')+'</div><button type="button" id="resetTextColor">Reset to theme text color</button></section>'+
 '<section class="appearance-pane hidden" data-appearance-pane="hover"><p class="muted tiny">Set the subtle hover surface used by cards, buttons and collection rows.</p><label class="appearance-color-field">Hover background<input id="customHoverColor" type="color" value="'+activeHover+'"></label><h3 class="appearance-history-heading">Recent hover colors</h3><div id="hoverColorHistory">'+colorHistoryMarkup('qrHoverColorHistory','hover')+'</div><button type="button" id="resetHoverColor">Reset to quiet theme hover</button></section>';
 modal('Appearance',body,()=>{
  const host=$('modalHost');
  const renderHistories=()=>{
   $('accentColorHistory').innerHTML=colorHistoryMarkup('qrAccentHistory','accent');
   $('backgroundColorHistory').innerHTML=colorHistoryMarkup('qrBackgroundHistory','background');
   $('textColorHistory').innerHTML=colorHistoryMarkup('qrTextColorHistory','text');
   $('hoverColorHistory').innerHTML=colorHistoryMarkup('qrHoverColorHistory','hover');
  };
  host.onclick=e=>{
   const tab=e.target.closest('[data-appearance-tab]');if(tab){host.querySelectorAll('[data-appearance-tab]').forEach(x=>x.classList.toggle('active',x===tab));host.querySelectorAll('[data-appearance-pane]').forEach(x=>x.classList.toggle('hidden',x.dataset.appearancePane!==tab.dataset.appearanceTab));return}
   const option=e.target.closest('[data-appearance-theme]');if(option){applyTheme(option.dataset.appearanceTheme);host.querySelectorAll('[data-appearance-theme]').forEach(x=>{x.classList.toggle('active',x===option);x.querySelector('.appearance-option-check').textContent=x===option?'✓':''});$('customBackgroundColor').value=(localStorage.getItem('qrBackground')||themeBackgrounds[option.dataset.appearanceTheme]).slice(0,7);$('customTextColor').value=localStorage.getItem('qrTextColor')||getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();$('customAccentColor').value=localStorage.getItem('qrAccent')||getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}
   const chip=e.target.closest('[data-accent]');if(chip){applyAccent(chip.dataset.accent);$('customAccentColor').value=chip.dataset.accent;renderHistories()}
   const accentHistory=e.target.closest('[data-history-accent]');if(accentHistory){applyAccent(accentHistory.dataset.historyAccent);$('customAccentColor').value=accentHistory.dataset.historyAccent;renderHistories()}
   const backgroundHistory=e.target.closest('[data-history-background]');if(backgroundHistory){applyBackground(backgroundHistory.dataset.historyBackground);$('customBackgroundColor').value=backgroundHistory.dataset.historyBackground.slice(0,7);renderHistories()}
   const textHistory=e.target.closest('[data-history-text]');if(textHistory){applyTextColor(textHistory.dataset.historyText);$('customTextColor').value=textHistory.dataset.historyText;renderHistories()}
   const hoverHistory=e.target.closest('[data-history-hover]');if(hoverHistory){applyHoverColor(hoverHistory.dataset.historyHover);$('customHoverColor').value=hoverHistory.dataset.historyHover;renderHistories()}
   if(e.target.closest('#resetBackgroundColor')){applyBackground(null);$('customBackgroundColor').value=themeBackgrounds[localStorage.getItem('qbtheme')||'default'].slice(0,7);renderHistories()}
   if(e.target.closest('#resetTextColor')){applyTextColor(null);$('customTextColor').value=getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();renderHistories()}
   if(e.target.closest('#resetHoverColor')){applyHoverColor(null);$('customHoverColor').value='#555555';renderHistories()}
  };
  $('customAccentColor').oninput=e=>applyAccent(e.target.value,false);
  $('customAccentColor').onchange=e=>{applyAccent(e.target.value,true);renderHistories()};
  $('customBackgroundColor').oninput=e=>applyBackground(e.target.value,false);
  $('customBackgroundColor').onchange=e=>{applyBackground(e.target.value,true);renderHistories()};
  $('customHoverColor').oninput=e=>applyHoverColor(e.target.value,false);
  $('customHoverColor').onchange=e=>{applyHoverColor(e.target.value,true);renderHistories()};
  $('customTextColor').oninput=e=>applyTextColor(e.target.value,false);
  $('customTextColor').onchange=e=>{applyTextColor(e.target.value,true);renderHistories()};
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
$('headerImportZipFile').onchange=async e=>{const file=e.target.files[0];if(file)try{await importZipCollection(file,'library')}catch(error){alert('Could not import ZIP: '+(error?.message||error))}e.target.value=''};$('globalHistoryBtn').onclick=()=>showUniversalHistory(state.books,(book,index)=>{state.book=book;openReader(index);syncTranslationControls();renderReaderLinks()});$('bookGrid').onclick=async e=>{if(handleCollectionAction(e)){if(state.screen==='book'&&state.book?.source==='gallery')renderGallery();if(state.screen==='reader'){syncTranslationControls();renderReaderLinks()}return}const link=e.target.closest('[data-manage-novel-links]');if(link){const book=state.books.find(b=>b.id===link.dataset.manageNovelLinks);if(book)manageNovelLinks(book);return}const continuation=e.target.closest('[data-continue]');if(continuation){const book=state.books.find(item=>item.id===continuation.dataset.continue);if(book?.source==='gallery'){await continueGallery(book);return}}await handleLibraryClick(e);if(state.screen==='book'&&state.book?.source==='gallery')renderGallery();if(state.screen==='reader')renderReaderLinks()};$('pasteList').onclick=handleLibraryClick;$('toggleBookDetail').onclick=()=>{const collapsed=document.querySelector('.book-detail')?.classList.toggle('detail-collapsed');localStorage.setItem('qrBookDetailCollapsed',collapsed?'1':'0');renderBookDetailToggle(Boolean(collapsed));$('toggleBookDetail').title=collapsed?'Expand details':'Collapse details'};if(localStorage.getItem('qrBookDetailCollapsed')!=='0'){document.querySelector('.book-detail')?.classList.add('detail-collapsed');renderBookDetailToggle(true)}document.body.classList.toggle('detail-header-hidden',localStorage.getItem('qrBookDetailHidden')==='1');
$('bookTabs').onclick=async e=>{const tab=e.target.closest('[data-book-tab]');if(tab){if(state.book&&tab.dataset.bookTab!=='notes'&&state.book.notesLocked===false){clearTimeout(window.__qrNotesSaveTimer);await saveBookNotes({lock:true,silent:true})}setBookTab(tab.dataset.bookTab);if(tab.dataset.bookTab==='gallery')renderGallery()}};$('bookHistoryContent').onclick=e=>{const row=e.target.closest('[data-open-reading-history]');if(!row)return;const book=state.books.find(item=>item.id===row.dataset.openReadingHistory);if(book){state.book=book;openReader(Number(row.dataset.historyChapter));syncTranslationControls();renderReaderLinks()}};$('bookNotes').addEventListener('input',()=>{if(!state.book)return;state.book.notesLocked=false;$('noteLockToggle').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> Lock notes';$('noteLockToggle').setAttribute('aria-pressed','true');$('notesSaveStatus').textContent='Saving…';clearTimeout(window.__qrNotesSaveTimer);window.__qrNotesSaveTimer=setTimeout(()=>saveBookNotes({silent:true}),650)});$('noteLockToggle').onclick=async()=>{if(!state.book)return;if(state.book.notesLocked!==false){state.book.notesLocked=false;await put(state.book);drawBook();$('bookNotes').focus();toast('Notes unlocked')}else await saveBookNotes({lock:true})};$('manageNovelLinks').onclick=()=>manageNovelLinks(state.book);
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.tagFilter='all';state.lnReaderCategory='all';if($('tagFilter'))$('tagFilter').value='all';document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));syncHeaderActions(state.filter==='gallery'?'gallery':'library');drawLibrary()});$('lnReaderCategoryFilters').onclick=e=>{const button=e.target.closest('[data-lnreader-category]');if(!button)return;state.lnReaderCategory=button.dataset.lnreaderCategory;drawLibrary()};
function formatLNReaderImportSize(bytes){const value=Number(bytes)||0;if(value<1024)return value+' B';if(value<1048576)return (value/1024).toFixed(1)+' KB';if(value<1073741824)return (value/1048576).toFixed(2)+' MB';return (value/1073741824).toFixed(2)+' GB'}
function openLNReaderImportHistory(){
 let records=[];try{const saved=JSON.parse(localStorage.getItem('qrLNReaderImportHistory')||'[]');if(Array.isArray(saved))records=saved}catch{}
 const date=value=>{const time=Number(value)||Date.parse(value)||0;return time?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(time)):'Unknown date'};
 const rows=records.map((record,index)=>'<details class="lnreader-import-report" '+(index===0?'open':'')+'><summary><span class="lnreader-report-title">'+esc(record.name||'LN Reader import')+'</span><span class="lnreader-report-date">'+esc(date(record.importedAt))+'</span><span class="lnreader-report-stats">'+(record.customImport?Number(record.selectedNovels||record.novels||0).toLocaleString()+' of '+Number(record.totalBackupNovels||0).toLocaleString()+' novels imported':Number(record.novels||0)+' novels')+' · '+Number(record.chapters||0)+' chapters</span></summary><div class="lnreader-report-body"><div class="lnreader-report-grid">'+(record.customImport?'<div><small>Selected from backup</small><b>'+Number(record.selectedNovels||record.novels||0).toLocaleString()+' of '+Number(record.totalBackupNovels||0).toLocaleString()+'</b></div>':'')+'<div><small>Imported novels</small><b>'+Number(record.novels||0).toLocaleString()+'</b></div><div><small>Total chapters</small><b>'+Number(record.chapters||0).toLocaleString()+'</b></div><div><small>Chapters with text</small><b>'+Number(record.readableChapters||0).toLocaleString()+'</b></div><div><small>Source size</small><b>'+esc(formatLNReaderImportSize(record.sizeBytes))+'</b></div><div><small>Source format</small><b>'+esc(record.format||'Unknown')+'</b></div><div><small>Imported</small><b>'+esc(date(record.importedAt))+'</b></div></div><h4>Source files</h4><ul>'+((record.files||[]).length?(record.files||[]).map(name=>'<li>'+esc(name)+'</li>').join(''):'<li>'+esc(record.name||'Source not recorded')+'</li>')+'</ul><h4>LN Reader categories</h4><p>'+((record.categories||[]).length?(record.categories||[]).map(esc).join(' · '):'No categories detected')+'</p><h4>Settings and metadata files</h4><p>'+((record.settingsFiles||[]).length?(record.settingsFiles||[]).map(esc).join(' · '):'None recorded')+'</p></div></details>').join('');
 const body='<div class="lnreader-history-content"><div class="lnreader-history-summary"><b>'+records.length.toLocaleString()+' imports recorded</b><span>Reports are stored locally in this browser. They do not contain the imported book contents. Imports made before history tracking was added cannot be itemized by original archive name, size or date; their books remain in your library.</span></div>'+(rows||'<div class="empty">No LN Reader imports have been recorded yet.</div>')+'</div>';
 modal('LN Reader import history',body,()=>{const back=$('modalBack'),panel=back?.querySelector('.modal');back?.classList.add('lnreader-history-backdrop');panel?.classList.add('lnreader-history-modal')});
}
$('lnReaderImportHistoryButton')?.addEventListener('click',openLNReaderImportHistory);$('tagFilter').onchange=e=>{state.tagFilter=e.target.value;drawLibrary()};$('librarySort').value=localStorage.getItem('qrLibrarySort')||'recent';$('librarySort').onchange=e=>{localStorage.setItem('qrLibrarySort',e.target.value);drawLibrary()};$('bookRating').onchange=async e=>{if(!state.book)return;if(state.book.locked){e.target.value=String(Number(state.book.rating)||0);return toast('Unlock editing first')}state.book.rating=Number(e.target.value)||0;state.book.updated=Date.now();await put(state.book);await refresh();drawBook()};document.querySelectorAll('[data-library-view]').forEach(button=>button.onclick=()=>setLibraryView(button.dataset.libraryView));
$('savePaste').onclick=savePasteOnly;$('readPaste').onclick=()=>savePasteAsBook(true);$('pasteText').oninput=e=>$('charCount').textContent=[...e.target.value].length+' characters';
$('backLibrary').onclick=()=>{refresh();setScreen('library')};$('lockBook').onclick=async()=>{state.book.locked=!state.book.locked;await put(state.book);drawBook();if(state.book.source==='gallery')renderGallery();toast(state.book.locked?(state.book.source==='gallery'?'Gallery locked':'Editing locked'):(state.book.source==='gallery'?'Gallery unlocked':'Editing unlocked'))};$('editDetails').onclick=detailsModal;$('editTags').onclick=editTagsModal;
$('changeCover').onclick=()=>$('coverFile').click();$('coverFile').onchange=async e=>{if(e.target.files[0]){state.book.cover=await dataURL(e.target.files[0]);addEditEvent(state.book,'Cover changed','Book cover updated from file');await put(state.book);drawBook()}};
async function pasteCoverFromClipboard(){if(!state.book||state.book.locked)return toast('Unlock editing first');if(!navigator.clipboard?.read)return toast('Clipboard image access is unavailable in this browser');try{const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(!type)continue;const blob=await item.getType(type);const file=new File([blob],'pasted-cover.'+(type.split('/')[1]||'png'),{type});if(!(await confirmImagePreview(file,{title:'Preview book cover',confirmLabel:'Use as cover'})))return;state.book.cover=await dataURL(file);state.book.updated=Date.now();addEditEvent(state.book,'Cover pasted','Book cover updated from clipboard');await put(state.book);await refresh();drawBook();toast('Cover pasted');return}toast('No image found in clipboard')}catch(error){toast('Could not read clipboard image. Check browser clipboard permission.')}}
$('pasteCover').onclick=pasteCoverFromClipboard;
$('addChapter').onclick=()=>editChapter(null);$('renameChapters').onclick=renameChapters;$('pasteEditorImage').onclick=pasteEditorImage;$('editChapterText').addEventListener('paste',event=>{const file=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();import('./editor.js').then(module=>module.insertImage(file))}});$('addGalleryImages').onclick=addGalleryImages;$('addGalleryFolder').onclick=addGalleryFolder;$('galleryImageFiles').onchange=async e=>{if(e.target.files.length)await importGalleryFiles(e.target.files);e.target.value=''};$('galleryFolderFiles').onchange=async e=>{if(e.target.files.length)await importGalleryFiles(e.target.files);e.target.value=''};$('addTxtChapter').onclick=()=>$('singleChapterTxt').click();$('addTxtChapters').onclick=()=>$('multipleChapterTxt').click();$('singleChapterTxt').onchange=async e=>{if(e.target.files.length)await importTextChapters(e.target.files);e.target.value=''};$('multipleChapterTxt').onchange=async e=>{if(e.target.files.length)await importTextChapters(e.target.files);e.target.value=''};$('chapterList').onclick=async e=>{if(handleCollectionAction(e)){if(state.screen==='reader'){syncTranslationControls();renderReaderLinks()}return}const move=e.target.closest('[data-chapter-move]');if(move){const index=Number(move.dataset.chapterMove),delta=Number(move.dataset.delta);if(state.book.locked)return toast('Unlock editing first');const target=index+delta;if(target<0||target>=state.book.chapters.length)return;const swap=(a,b)=>a===index?target:a===target?index:a;[state.book.chapters[index],state.book.chapters[target]]=[state.book.chapters[target],state.book.chapters[index]];for(const book of state.books){let changed=false;for(const chapter of book.chapters||[])for(const link of chapter.links||[])if(link.targetBookId===state.book.id&&Number.isInteger(Number(link.targetChapterIndex))){const n=swap(Number(link.targetChapterIndex));if(n!==Number(link.targetChapterIndex)){link.targetChapterIndex=n;changed=true}}if(book.id===state.book.id){for(const mark of book.bookmarks||[])mark.chapter=swap(Number(mark.chapter));if(book.progress)book.progress.chapter=swap(Number(book.progress.chapter));for(const item of book.readingHistory||[])item.chapterIndex=swap(Number(item.chapterIndex));changed=true}if(changed){addEditEvent(book===state.book?book:null,'Chapter order changed','Moved '+(state.book.chapters[target].title||'chapter')+' to position '+(target+1));await put(book)}}await refresh();drawBook();return}const history=e.target.closest('[data-history]'),edit=e.target.closest('[data-edit]'),links=e.target.closest('[data-manage-chapter-links]'),read=e.target.closest('[data-read],[data-read-button]');if(links){if(state.book?.locked)return toast('Unlock editing first');manageChapterLinks(state.book,Number(links.dataset.manageChapterLinks));}else if(history)showChapterHistory(Number(history.dataset.history));else if(edit)editChapter(Number(edit.dataset.edit));else if(read){openReader(Number(read.dataset.read??read.dataset.readButton));syncTranslationControls();renderReaderLinks()}};
$('editorBack').onclick=()=>{drawBook();setScreen('book')};$('saveChapter').onclick=saveChapter;$('deleteChapter').onclick=deleteChapter;$('insertImage').onclick=()=>$('imageFile').click();$('imageFile').onchange=async e=>{await insertImage(e.target.files[0]);e.target.value=''};
$('importBook').onclick=()=>$('epubFile').click();$('importPdfBook').onclick=()=>$('pdfFile').click();$('pdfFile').onchange=async e=>{if(e.target.files[0])await importPDF(e.target.files[0]);e.target.value=''};$('importTextBook').onclick=()=>modal('Import a TXT novel','<div class="stack"><p class="muted">Choose one TXT file to create a one-chapter novel, or choose a folder to import its TXT files as ordered chapters.</p><button id="chooseSingleTxt" class="primary">Choose TXT file</button><button id="chooseTxtFolder">Choose folder of TXT files</button></div>',()=>{$('chooseSingleTxt').onclick=()=>{closeModal();$('singleTxtFile').click()};$('chooseTxtFolder').onclick=()=>{closeModal();$('txtFolderFiles').click()}});$('singleTxtFile').onchange=async e=>{if(e.target.files.length)await importTextBook(e.target.files);e.target.value=''};$('txtFolderFiles').onchange=async e=>{if(e.target.files.length)await importTextBook(e.target.files);e.target.value=''};$('epubFile').onchange=async e=>{if(e.target.files[0])await importEPUB(e.target.files[0]);e.target.value=''};$('exportEpub').onclick=exportEPUB;
$('chapterFormatControls').addEventListener('click',e=>{const copy=e.target.closest('[data-copy-chapter]'),format=e.target.closest('[data-chapter-format]');if(copy)copyChapter();else if(e.target.closest('#translateChapter'))openTranslatePage();else if(e.target.closest('#restoreTranslation'))restoreOriginalChapter();else if(e.target.closest('#copyTranslatedChapter'))copyTranslatedChapter();else if(format)renderChapterFormat(format.dataset.chapterFormat)});$('sectionView').addEventListener('click',e=>{const chapterCopy=e.target.closest('[data-copy-chapter]'),copy=e.target.closest('[data-copy-section]'),toggle=e.target.closest('[data-toggle-section]');if(chapterCopy)copyChapter();if(copy)copySection(copy.dataset.copySection);if(toggle)toggleSection(toggle.dataset.toggleSection,toggle)});$('readerMenuBtn').onclick=()=>{$('readerPanel').classList.remove('hidden');$('scrim').classList.remove('hidden')};$('closeReaderPanel').onclick=()=>{$('readerPanel').classList.add('hidden');$('scrim').classList.add('hidden')};$('jumpChapter').onchange=async e=>{await jumpChapter(e.target.value);syncTranslationControls();renderReaderLinks()};let novelSearchTimer;$('novelSearch').oninput=e=>{clearTimeout(novelSearchTimer);const query=e.target.value;novelSearchTimer=setTimeout(()=>searchNovel(query),120)};$('novelSearchResults').onclick=e=>{if(e.target.closest('[data-search-more]')){showMoreNovelSearchResults();return}const result=e.target.closest('[data-search-result]');if(!result)return;const query=$('novelSearch').value;$('readerPanel').classList.add('hidden');$('scrim').classList.add('hidden');openNovelSearchResult(result.dataset.searchChapter,result.dataset.searchParagraph,result.dataset.searchOffset,query,result.dataset.searchTitle==='1');syncTranslationControls()};$('readerBookTitle').onclick=async()=>{stopAutoRead(false);await saveProgress();setBookTab('chapters');drawBook();setScreen('book')};$('prevChapter').onclick=async()=>{await changeChapter(-1);syncTranslationControls();renderReaderLinks()};$('nextChapter').onclick=async()=>{await changeChapter(1);syncTranslationControls();renderReaderLinks()};$('topPrevChapter').onclick=async()=>{await changeChapter(-1);syncTranslationControls();renderReaderLinks()};$('topNextChapter').onclick=async()=>{await changeChapter(1);syncTranslationControls();renderReaderLinks()};$('chapterIndex').onclick=async()=>{stopAutoRead(false);await saveProgress();setBookTab('chapters');drawBook();setScreen('book')};$('bookmarkBtn').onclick=addBookmark;$('readerScrollTop').onclick=()=>$('screen-reader').scrollTo({top:0,behavior:'smooth'});$('readerScrollBottom').onclick=()=>$('screen-reader').scrollTo({top:$('screen-reader').scrollHeight,behavior:'smooth'});$('autoReadStart').onclick=startAutoRead;$('autoReadPause').onclick=pauseAutoRead;$('autoReadStop').onclick=()=>stopAutoRead();$('autoReadSpeed').oninput=setAutoReadSpeed;$('ttsSpeechSpeed').onchange=setTTSSpeechSpeed;$('ttsEnabled').onchange=setTTSEnabled;$('ttsVoice').onchange=setTTSVoice;$('ttsEngine').onchange=setTTSEngine;$('kokoroVoice').onchange=()=>{if(state.screen==='reader'&&$('autoReadStart')&&!$('autoReadPause').disabled){stopAutoRead(false);startAutoRead()}};$('showMarks').onclick=showMarks;$('readerTheme').onchange=e=>applyTheme(e.target.value);$('readerBackgroundColor').value=localStorage.getItem('qrReaderBackground')||getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#474747';$('readerTextColor').value=localStorage.getItem('qrReaderText')||getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#eeeeee';const applyReaderColor=(key,value)=>{if(!/^#[0-9a-f]{6}$/i.test(value))return;localStorage.setItem(key,value);document.documentElement.style.setProperty(key==='qrReaderBackground'?'--reader-bg':'--reader-fg',value)};applyReaderColor('qrReaderBackground',$('readerBackgroundColor').value);applyReaderColor('qrReaderText',$('readerTextColor').value);$('readerBackgroundColor').oninput=e=>applyReaderColor('qrReaderBackground',e.target.value);$('readerTextColor').oninput=e=>applyReaderColor('qrReaderText',e.target.value);const readerToolbarSticky=$('readerToolbarSticky');readerToolbarSticky.checked=localStorage.getItem('qrReaderToolbarSticky')==='true';$('readerToolbar').classList.toggle('reader-toolbar-sticky',readerToolbarSticky.checked);readerToolbarSticky.onchange=e=>{localStorage.setItem('qrReaderToolbarSticky',String(e.target.checked));$('readerToolbar').classList.toggle('reader-toolbar-sticky',e.target.checked)};$('textSize').oninput=e=>$('readingBody').style.fontSize=e.target.value+'px';const autoReadHighlightCustom=localStorage.getItem('qrAutoReadHighlightCustom')==='true';const accentHighlight=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#b9f27c';const savedAutoReadHighlight=autoReadHighlightCustom?localStorage.getItem('qrAutoReadHighlight'):accentHighlight;$('autoReadHighlightColor').value=savedAutoReadHighlight||accentHighlight;document.documentElement.style.setProperty('--auto-read-highlight',savedAutoReadHighlight||accentHighlight);$('autoReadHighlightColor').oninput=e=>{document.documentElement.style.setProperty('--auto-read-highlight',e.target.value);localStorage.setItem('qrAutoReadHighlight',e.target.value);localStorage.setItem('qrAutoReadHighlightCustom','true')};$('readingWidth').oninput=e=>document.documentElement.style.setProperty('--reader-width',e.target.value+'px');$('exitReader').onclick=async()=>{stopAutoRead(false);await saveProgress();drawBook();setScreen('book')};$('editReadingChapter').onclick=async()=>{stopAutoRead(false);if(state.book.locked)return toast('Unlock editing first');await saveProgress();editChapter(state.chapter)};
$('appearanceBtn').onclick=()=>{closeDrawer();appearanceModal()};$('translationSourcesBtn').onclick=()=>{closeDrawer();manageTranslationSources()};$('tagColorsBtn').onclick=()=>{closeDrawer();tagColorsModal()};$('backupBtn').onclick=()=>{closeDrawer();exportBackup()};$('restoreBtn').onclick=()=>{closeDrawer();$('restoreFile').click()};
$('lnReaderRestoreBtn').onclick=()=>{closeDrawer();modal('Import LN Reader backup','<div class="stack"><p class="muted tiny">Choose the backup layout. Quiet Reader will inspect metadata and chapter indexes before importing anything.</p><button type="button" id="lnReaderChooseZip" class="primary">One ZIP or multiple ZIP files</button><button type="button" id="lnReaderChooseFolder">Extracted backup folder</button></div>',()=>{$('lnReaderChooseZip').onclick=()=>{closeModal();$('lnReaderBackupFile').click()};$('lnReaderChooseFolder').onclick=()=>{closeModal();$('lnReaderFolderFiles').click()}})};
$('archiveRestoreBtn').onclick=()=>{closeDrawer();$('archiveFile').click()};
$('restoreFile').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value=''};
$('lnReaderBackupFile').onchange=async e=>{if(e.target.files.length)await importBackup([...e.target.files]);e.target.value=''};$('lnReaderFolderFiles').onchange=async e=>{if(e.target.files.length)await importBackup([...e.target.files]);e.target.value=''};
$('archiveFile').onchange=async e=>{if(e.target.files[0])try{await importZipCollection(e.target.files[0],'library')}catch(error){alert('Could not import ZIP: '+(error?.message||error))}e.target.value=''};
const readFromHere=$('readFromHere');readFromHere.classList.add('hidden');const readingBody=$('readingBody');const selectionBar=$('selectionToolbar');function canReadFromHere(){return state.screen==='reader'&&isAutoReadActive()}readingBody.addEventListener('pointerover',e=>{const p=e.target.closest('p');if(!p||!readingBody.contains(p)||e.pointerType==='touch'||!canReadFromHere())return;p.classList.add('read-from-here-hover')});readingBody.addEventListener('pointerout',e=>{const p=e.target.closest('p');if(p&&!p.contains(e.relatedTarget))p.classList.remove('read-from-here-hover')});readingBody.addEventListener('click',e=>{const p=e.target.closest('p');if(!p||!readingBody.contains(p)||!canReadFromHere())return;const index=[...readingBody.querySelectorAll('p')].indexOf(p);if(index<0)return;setAutoReadPosition(index)});let selectionTimer,savedSelectionRange=null,activeParagraph=null;
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
await refresh();enhanceSelects();initTheme();initTTS();setTTSEngine();const APP_BUILD_VERSION=import.meta.env?.VITE_APP_VERSION||'dev';
const APP_BUILD_COMMIT=import.meta.env?.VITE_APP_COMMIT||'development';
const APP_BUILD_SHELL=import.meta.env?.VITE_APP_SHELL||'unknown';
let appUpdateRegistration=null;
let appUpdateCheckPromise=null;
let reloadAfterAppUpdate=false;
const updateStatusNodes=()=>[...document.querySelectorAll('#appUpdateStatus,[data-app-update-status]')];
const updateInstallNodes=()=>[...document.querySelectorAll('#installAppUpdate,[data-app-update-install]')];
const appVersionNodes=()=>[...document.querySelectorAll('[data-app-version]')];
const publishedVersionNodes=()=>[...document.querySelectorAll('[data-published-version]')];
function setAppUpdateStatus(message){updateStatusNodes().forEach(node=>{node.textContent=message})}
function renderInstalledAppVersion(){const shell=String(APP_BUILD_SHELL).replace(/^quiet-reader-shell-v/,'');const message='Installed app · v'+APP_BUILD_VERSION+' · commit '+APP_BUILD_COMMIT+' · offline shell '+shell;appVersionNodes().forEach(node=>{node.textContent=message})}
function renderPublishedAppVersion(version){const message='Latest GitHub build · v'+version.version+' · commit '+version.commit+' · offline shell '+String(version.shell||'unknown').replace(/^quiet-reader-shell-v/,'');publishedVersionNodes().forEach(node=>{node.textContent=message})}
renderInstalledAppVersion();
function refreshAppUpdateStatus(){
 const installs=updateInstallNodes();
 if(!navigator.onLine){setAppUpdateStatus('Offline. The installed version shown above remains available.');installs.forEach(button=>button.disabled=!appUpdateRegistration?.waiting);return}
 if(appUpdateRegistration?.waiting){setAppUpdateStatus('A newer published app version is downloaded and ready to install.');installs.forEach(button=>button.disabled=false);return}
 if(appUpdateRegistration?.installing){setAppUpdateStatus('Downloading and preparing the published app update…');installs.forEach(button=>button.disabled=true);return}
 setAppUpdateStatus(navigator.serviceWorker?.controller?'Offline app shell is ready. Check the published build to compare versions.':'Preparing the first offline app cache…');
 installs.forEach(button=>button.disabled=true);
}
async function checkForAppUpdate(){
 if(appUpdateCheckPromise)return appUpdateCheckPromise;
 appUpdateCheckPromise=(async()=>{
  if(!navigator.onLine){setAppUpdateStatus('Connect to the internet to check the published GitHub version.');return}
  setAppUpdateStatus('Reading the latest published GitHub build…');
  let published;
  try{
   const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('Published version metadata returned HTTP '+response.status);
   published=await response.json();
   if(!published.version||!published.commit)throw new Error('Published version metadata is incomplete.');
  }catch(error){
   setAppUpdateStatus('Could not read the published GitHub version. Installed v'+APP_BUILD_VERSION+' remains unchanged. '+(error?.message||''));
   return;
  }
  renderPublishedAppVersion(published);
  const sameBuild=published.commit===APP_BUILD_COMMIT,registration=appUpdateRegistration;
  if(!registration){setAppUpdateStatus((sameBuild?'Up to date':'Update available')+' · GitHub v'+published.version+' ('+published.commit+'). '+(sameBuild?'Installed v'+APP_BUILD_VERSION+' matches the published build.':'Keep the app online; the browser will prepare the offline update when its service worker is ready.'));return}
  if(registration.waiting){setAppUpdateStatus('Update downloaded · GitHub v'+published.version+' is ready to install.');return}
  if(registration.installing){setAppUpdateStatus('Version verified · GitHub v'+published.version+'. The offline update is already installing.');return}
  if(!registration.active||registration.active.state!=='activated'){setAppUpdateStatus((sameBuild?'Up to date':'Update available')+' · GitHub version verified. The offline app worker is still starting; check again after it becomes active.');return}
  if(sameBuild){setAppUpdateStatus('Up to date · installed v'+APP_BUILD_VERSION+' matches GitHub v'+published.version+'.');return}
  try{await registration.update()}catch(error){
   const invalidState=error?.name==='InvalidStateError'||/invalid state|uninstalling/i.test(error?.message||'');
   if(!invalidState)console.warn('Quiet Reader service-worker update check:',error);
   if(registration.waiting||registration.installing){setAppUpdateStatus('Version verified · GitHub v'+published.version+'. The offline update is being prepared.');return}
   setAppUpdateStatus((sameBuild?'Up to date':'Update available')+' · GitHub v'+published.version+' ('+published.commit+'). '+(invalidState?'The browser is completing a service-worker transition; the version check itself succeeded.':'The browser deferred the offline update check; the published version was verified.'));
   return;
  }
  refreshAppUpdateStatus();
  if(registration.waiting){setAppUpdateStatus('Update downloaded · GitHub v'+published.version+' is ready to install.');return}
  if(registration.installing){setAppUpdateStatus('Version verified · GitHub v'+published.version+'. The offline update is downloading.');return}
  setAppUpdateStatus(sameBuild?'Up to date · installed v'+APP_BUILD_VERSION+' matches GitHub v'+published.version+'.':'Update available · GitHub v'+published.version+' ('+published.commit+') is newer than installed v'+APP_BUILD_VERSION+'. Keep the app online and check again shortly.');
 })();
 try{return await appUpdateCheckPromise}finally{appUpdateCheckPromise=null}
}
function installAppUpdate(){
 if(!appUpdateRegistration?.waiting)return;
 reloadAfterAppUpdate=true;
 setAppUpdateStatus('Installing the update. The app will reload when the new version takes control.');
 appUpdateRegistration.waiting.postMessage({type:'SKIP_WAITING'});
}
document.querySelectorAll('#checkAppUpdate,[data-app-update-check]').forEach(button=>button.addEventListener('click',checkForAppUpdate));
document.querySelectorAll('#installAppUpdate,[data-app-update-install]').forEach(button=>button.addEventListener('click',installAppUpdate));
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(registration=>{
  appUpdateRegistration=registration;
  const watch=worker=>{if(worker)worker.addEventListener('statechange',refreshAppUpdateStatus)};
  watch(registration.installing);
  registration.addEventListener('updatefound',()=>{watch(registration.installing);refreshAppUpdateStatus()});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{refreshAppUpdateStatus();if(reloadAfterAppUpdate)location.reload()});
  // register() already performs the browser's normal update check. Avoid a
  // second startup update() call racing the explicit Check for updates action.
  refreshAppUpdateStatus();
 }).catch(()=>setAppUpdateStatus('Offline updates are unavailable in this browser context.'));
}
window.addEventListener('online',refreshAppUpdateStatus);
window.addEventListener('offline',refreshAppUpdateStatus);
setScreen('library');

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
 state.filter=button.dataset.categorySource||'manual';syncHeaderActions('library');
 document.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item.dataset.filter===state.filter));
 if($('tagFilter'))$('tagFilter').value=state.tagFilter;
 drawLibrary();
});
function manageLibraryCategories(){
 const mainCategories=[['epub','EPUB'],['manhwa','Manhwa'],['pdf','PDF'],['manual','Novels'],['gallery','Galleries']];
 let subcategories={};
 try{subcategories=JSON.parse(localStorage.getItem('qrLibrarySubcategories')||'{}')||{}}catch{subcategories={}}
 if(!Object.keys(subcategories).length){
  let legacy=[];try{const value=JSON.parse(localStorage.getItem('qrLibraryCategories')||'[]');if(Array.isArray(value))legacy=value.filter(x=>typeof x==='string'&&x.trim())}catch{}
  if(legacy.length)subcategories.manual=legacy.map((name,index)=>({id:'legacy-'+index+'-'+Math.random().toString(36).slice(2,6),name:String(name).trim(),locked:false}));
  localStorage.setItem('qrLibrarySubcategories',JSON.stringify(subcategories));
 }
 let selectedSource='manual';
 const body='<div class="stack category-manager"><p class="muted tiny">Choose a main library category to manage its subcategories. LN Reader categories are imported from LN Reader and remain fixed here.</p><label>Main category<select id="categoryManagerSelect">'+mainCategories.map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label><section class="category-manager-subsection"><div class="row between"><div><b id="categoryManagerHeading">Novels subcategories</b><p class="muted tiny">Locked subcategories cannot be removed. Unlock one to delete it.</p></div><span id="categorySubCount" class="muted tiny"></span></div><div class="row category-create-row"><input id="newSubCategory" placeholder="New subcategory name" maxlength="40"><button type="button" id="addSubCategory" class="primary">Add</button></div><div id="categorySubcategoryList" class="category-manager-list"></div></section></div>';
 modal('Manage categories',body,()=>{
  const select=$('categoryManagerSelect'),host=$('categorySubcategoryList');
  const safe=value=>String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const list=()=>Array.isArray(subcategories[selectedSource])?subcategories[selectedSource]:[];
  const persist=()=>{
   const all=[...new Set(Object.values(subcategories).flat().map(item=>String(item.name||'').trim()).filter(Boolean))];
   localStorage.setItem('qrLibrarySubcategories',JSON.stringify(subcategories));
   localStorage.setItem('qrLibraryCategories',JSON.stringify(all));
   drawLibrary();render();
  };
  const render=()=>{
   const label=mainCategories.find(item=>item[0]===selectedSource)?.[1]||'Library';
   $('categoryManagerHeading').textContent=label+' subcategories';
   $('categorySubCount').textContent=list().length+' subcategories';
   host.innerHTML=list().length?list().map(item=>'<div class="category-manager-item category-manager-subcategory"><span class="category-sub-indent">↳</span><b>'+safe(item.name)+'</b><span class="grow"></span><button type="button" class="category-manager-lock '+(item.locked?'locked':'')+'" data-lock-sub="'+safe(item.id)+'" aria-label="'+(item.locked?'Unlock':'Lock')+' subcategory">'+(item.locked?'🔒':'🔓')+'</button><button type="button" data-remove-sub="'+safe(item.id)+'" '+(item.locked?'disabled':'')+'>Remove</button></div>').join(''):'<p class="muted tiny">No subcategories for this main category yet. Add one above.</p>';
  };
  select.value=selectedSource;select.onchange=()=>{selectedSource=select.value;render()};
  $('addSubCategory').onclick=()=>{
   const input=$('newSubCategory'),name=input.value.trim();
   if(!name)return toast('Enter a subcategory name');
   if(list().some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return toast('That subcategory already exists in this category');
   subcategories[selectedSource]=[...list(),{id:'subcategory-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name,locked:false}];
   input.value='';persist();
  };
  $('newSubCategory').onkeydown=event=>{if(event.key==='Enter')$('addSubCategory').click()};
  host.onclick=event=>{
   const lock=event.target.closest('[data-lock-sub]');
   if(lock){const item=list().find(value=>value.id===lock.dataset.lockSub);if(item){item.locked=!item.locked;persist()}return}
   const remove=event.target.closest('[data-remove-sub]');
   if(remove){const item=list().find(value=>value.id===remove.dataset.removeSub);if(!item||item.locked)return;subcategories[selectedSource]=list().filter(value=>value.id!==item.id);persist()}
  };
  render();
 });
}$('manageCategories')?.addEventListener('click',manageLibraryCategories);

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
