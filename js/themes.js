import {$} from './utils.js';

const palettes={
 default:{bg:'#47474747',panel:'#505050',panel2:'#5b5b5b',fg:'#eeeeee',muted:'#c1c1c1',line:'#6b6b6b',accent:'#b9f27c'},
 dark:{bg:'#10141b',panel:'#171e28',panel2:'#222d3a',fg:'#e9eef4',muted:'#95a2b1',line:'#303d4d',accent:'#b9f27c'},
 midnight:{bg:'#090e18',panel:'#111a29',panel2:'#1a2940',fg:'#e7eefb',muted:'#91a2bb',line:'#2c3d57',accent:'#8be9fd'},
 ocean:{bg:'#0b1820',panel:'#122832',panel2:'#1b3945',fg:'#e1f2f3',muted:'#8eafb4',line:'#2c5058',accent:'#63d8c5'},
 forest:{bg:'#101b17',panel:'#192820',panel2:'#24382d',fg:'#e6f0e8',muted:'#9aafa0',line:'#354c3d',accent:'#a3e6a0'},
 plum:{bg:'#19131f',panel:'#241b2c',panel2:'#34263d',fg:'#f0e8f4',muted:'#b2a0bd',line:'#4a3855',accent:'#d6a5f5'},
 sepia:{bg:'#eee2ce',panel:'#e4d5bc',panel2:'#d8c5a6',fg:'#4d3c2a',muted:'#806d56',line:'#c6b391',accent:'#987344'},
 light:{bg:'#f4f6f8',panel:'#ffffff',panel2:'#e9edf1',fg:'#26313c',muted:'#667483',line:'#d5dce3',accent:'#648b43'}
};

function rememberColor(key,color){
 try{
  const history=JSON.parse(localStorage.getItem(key)||'[]');
  const next=[color,...history.filter(value=>value!==color)].slice(0,10);
  localStorage.setItem(key,JSON.stringify(next));
 }catch(error){console.warn('Could not save appearance color history',error)}
}
function setFavicon(){
 const link=document.querySelector('link[rel~="icon"]');
 if(!link)return;
 const mode=localStorage.getItem('qrFaviconMode')||'theme';
 const custom=localStorage.getItem('qrCustomFavicon');
 if(mode==='custom'&&custom){link.href=custom;return}
 const palette=palettes[localStorage.getItem('qbtheme')||'default']||palettes.default;
 let background=localStorage.getItem('qrAccent')||palette.accent;
 let foreground=localStorage.getItem('qrBackground')||palette.bg;
 if(mode==='classic'){background='#474747';foreground='#BABABF'}
 if(mode==='mono'){background=palette.fg;foreground=palette.bg}
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="'+background+'"/><text x="32" y="47" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="45" font-weight="800" fill="'+foreground+'">q</text></svg>';
 link.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
export function applyFaviconMode(mode){
 const allowed=['theme','classic','mono','custom'];
 const value=allowed.includes(mode)?mode:'theme';
 localStorage.setItem('qrFaviconMode',value);
 setFavicon();
}
export function applyAccent(color,remember=true){
 const value=/^#[0-9a-f]{6}$/i.test(color)?color:'#b9f27c';
 document.documentElement.style.setProperty('--accent',value);
 document.documentElement.style.setProperty('--accent-hover','color-mix(in srgb, '+value+' 12%, var(--panel))');
 if(localStorage.getItem('qrAutoReadHighlightCustom')!=='true'){document.documentElement.style.setProperty('--auto-read-highlight',value);localStorage.setItem('qrAutoReadHighlight',value)}
 localStorage.setItem('qrAccent',value);
 if(remember)rememberColor('qrAccentHistory',value);
 if(localStorage.getItem('qrAutoReadHighlightCustom')!=='true'){const input=$('autoReadHighlightColor');if(input)input.value=value;}
 setFavicon();
}
export function applyBackground(color,remember=true){
 const value=/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)?color:null;
 if(!value){localStorage.removeItem('qrBackground');applyTheme(localStorage.getItem('qbtheme')||'default');return}
 document.documentElement.style.setProperty('--bg',value);
 document.documentElement.style.setProperty('--panel','color-mix(in srgb, '+value+' 88%, var(--fg))');
 document.documentElement.style.setProperty('--panel2','color-mix(in srgb, '+value+' 78%, var(--fg))');
 localStorage.setItem('qrBackground',value);
 if(remember)rememberColor('qrBackgroundHistory',value);
 setFavicon();
}
export function applyHoverColor(color,remember=true){
 const value=/^#[0-9a-f]{6}$/i.test(color)?color:null;
 if(!value){localStorage.removeItem('qrHoverColor');document.documentElement.style.setProperty('--hover','color-mix(in srgb,var(--fg) 8%,var(--panel))');return}
 document.documentElement.style.setProperty('--hover',value);
 localStorage.setItem('qrHoverColor',value);
 if(remember)rememberColor('qrHoverColorHistory',value);
}
export function applyTextColor(color,remember=true){
 const value=/^#[0-9a-f]{6}$/i.test(color)?color:null;
 if(!value){localStorage.removeItem('qrTextColor');document.documentElement.classList.remove('has-custom-text-color');applyTheme(localStorage.getItem('qbtheme')||'default');return}
 document.documentElement.style.setProperty('--fg',value);
 document.documentElement.style.setProperty('--muted','color-mix(in srgb, '+value+' 68%, var(--bg))');
 document.documentElement.classList.add('has-custom-text-color');
 localStorage.setItem('qrTextColor',value);
 if(remember)rememberColor('qrTextColorHistory',value);
}
export function applyTheme(name){
 const palette=palettes[name]||palettes.default;
 for(const [key,value] of Object.entries(palette))document.documentElement.style.setProperty('--'+key,value);
 document.documentElement.style.colorScheme=name==='sepia'||name==='light'?'light':'dark';
 localStorage.setItem('qbtheme',name);
 if($('readerTheme'))$('readerTheme').value=name;
 const accent=localStorage.getItem('qrAccent')||palette.accent;
 if(localStorage.getItem('qrAccent'))applyAccent(accent,false);else{const highlight=localStorage.getItem('qrAutoReadHighlightCustom')==='true'?(localStorage.getItem('qrAutoReadHighlight')||accent):accent;document.documentElement.style.setProperty('--auto-read-highlight',highlight);localStorage.setItem('qrAutoReadHighlight',highlight);setFavicon()}
 const background=localStorage.getItem('qrBackground');if(background)applyBackground(background,false);
 const textColor=localStorage.getItem('qrTextColor');if(textColor)applyTextColor(textColor,false);
 const hoverColor=localStorage.getItem('qrHoverColor');if(hoverColor)applyHoverColor(hoverColor,false);else applyHoverColor(null,false);
}
export function initTheme(){applyTheme(localStorage.getItem('qbtheme')||'default')}
