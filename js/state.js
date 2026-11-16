import {uid} from './utils.js';
export const state={books:[],pastes:[],book:null,chapter:0,editIndex:null,filter:'all',tagFilter:'all',screen:'library'};
export function freshBook(source,title){return{id:uid(),kind:'book',source,title,author:'',cover:'',chapters:[],locked:false,bookmarks:[],highlights:[],progress:{chapter:0,offset:0},updated:Date.now()}}
let readerViewportSnapshot=null;
let bookViewportSnapshot=null;
function setBookViewport(enabled){
 const screen=document.getElementById('screen-book');
 const topbar=document.querySelector('.topbar');
 const navigation=document.querySelector('.main-nav-wrap');
 if(enabled){
  if(!bookViewportSnapshot)bookViewportSnapshot={bodyOverflow:document.body.style.overflow,topbarDisplay:topbar?.style.display||'',navigationDisplay:navigation?.style.display||'',screenStyle:screen.style.cssText};
  if(topbar)topbar.style.display='none';if(navigation)navigation.style.display='none';document.body.style.overflow='hidden';
  Object.assign(screen.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',minHeight:'0',maxWidth:'none',margin:'0',padding:'18px clamp(14px,3vw,42px) 70px',overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',zIndex:'60',background:'var(--bg)'});
 }else if(bookViewportSnapshot){
  document.body.style.overflow=bookViewportSnapshot.bodyOverflow;if(topbar)topbar.style.display=bookViewportSnapshot.topbarDisplay;if(navigation)navigation.style.display=bookViewportSnapshot.navigationDisplay;screen.style.cssText=bookViewportSnapshot.screenStyle;bookViewportSnapshot=null;
 }
}
function setReaderViewport(enabled){
 const reader=document.getElementById('screen-reader');
 const topbar=document.querySelector('.topbar');
 const navigation=document.querySelector('.main-nav-wrap');
 const toolbar=reader?.querySelector('.reader-toolbar');
 const column=reader?.querySelector('.reading-column');
 if(enabled){
  if(!readerViewportSnapshot)readerViewportSnapshot={bodyOverflow:document.body.style.overflow,topbarDisplay:topbar?.style.display||'',navigationDisplay:navigation?.style.display||'',readerStyle:reader.style.cssText,toolbarStyle:toolbar?.style.cssText||'',columnStyle:column?.style.cssText||''};
  if(topbar)topbar.style.display='none';
  if(navigation)navigation.style.display='none';
  document.body.style.overflow='hidden';
  Object.assign(reader.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',minHeight:'0',maxWidth:'none',margin:'0',padding:'0',overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',zIndex:'60',background:'var(--bg)'});
  if(toolbar)Object.assign(toolbar.style,{position:'sticky',top:'0',zIndex:'20',backdropFilter:'blur(18px)',width:'100%'});
  if(column)Object.assign(column.style,{width:'min(100%, 920px)',maxWidth:'920px',margin:'0 auto',padding:'clamp(26px,5vh,54px) clamp(20px,5vw,56px) 100px'});
 }else if(readerViewportSnapshot){
  document.body.style.overflow=readerViewportSnapshot.bodyOverflow;
  if(topbar)topbar.style.display=readerViewportSnapshot.topbarDisplay;
  if(navigation)navigation.style.display=readerViewportSnapshot.navigationDisplay;
  reader.style.cssText=readerViewportSnapshot.readerStyle;
  if(toolbar)toolbar.style.cssText=readerViewportSnapshot.toolbarStyle;
  if(column)column.style.cssText=readerViewportSnapshot.columnStyle;
  readerViewportSnapshot=null;
 }
}
export function setScreen(name){
 state.screen=name;
 for(const id of ['paste','library','book','editor','reader'])document.getElementById('screen-'+id).classList.toggle('hidden',id!==name);
 setReaderViewport(name==='reader');
 setBookViewport(name==='book');
 document.getElementById('drawer').classList.remove('open');
 document.getElementById('readerPanel').classList.add('hidden');
 document.getElementById('scrim').classList.add('hidden');
 if(name==='reader')document.getElementById('screen-reader').scrollTop=0;
 else window.scrollTo(0,0);
}