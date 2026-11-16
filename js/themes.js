import {$} from './utils.js';
const palettes={
 default:{bg:'#171d26',panel:'#202a36',panel2:'#293646',fg:'#e5ebf1',muted:'#9ba9b8',line:'#354456',accent:'#b9f27c'},
 dark:{bg:'#10141b',panel:'#171e28',panel2:'#222d3a',fg:'#e9eef4',muted:'#95a2b1',line:'#303d4d',accent:'#b9f27c'},
 midnight:{bg:'#090e18',panel:'#111a29',panel2:'#1a2940',fg:'#e7eefb',muted:'#91a2bb',line:'#2c3d57',accent:'#8be9fd'},
 ocean:{bg:'#0b1820',panel:'#122832',panel2:'#1b3945',fg:'#e1f2f3',muted:'#8eafb4',line:'#2c5058',accent:'#63d8c5'},
 forest:{bg:'#101b17',panel:'#192820',panel2:'#24382d',fg:'#e6f0e8',muted:'#9aafa0',line:'#354c3d',accent:'#a3e6a0'},
 plum:{bg:'#19131f',panel:'#241b2c',panel2:'#34263d',fg:'#f0e8f4',muted:'#b2a0bd',line:'#4a3855',accent:'#d6a5f5'},
 sepia:{bg:'#eee2ce',panel:'#e4d5bc',panel2:'#d8c5a6',fg:'#4d3c2a',muted:'#806d56',line:'#c6b391',accent:'#987344'},
 light:{bg:'#f4f6f8',panel:'#ffffff',panel2:'#e9edf1',fg:'#26313c',muted:'#667483',line:'#d5dce3',accent:'#648b43'}
};
function setFavicon(accent){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="#101820"/><path d="M12 15h40v34H12z" rx="5" fill="'+accent+'"/><path d="M23 22v20m0-10c0-7 18-7 18 0v10" fill="none" stroke="#101820" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const link=document.querySelector('link[rel~="icon"]');if(link)link.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
export function applyAccent(color){
 const value=/^#[0-9a-f]{6}$/i.test(color)?color:'#b9f27c';
 document.documentElement.style.setProperty('--accent',value);
 localStorage.setItem('qrAccent',value);setFavicon(value);
}
export function applyBackground(color){
 const value=/^#[0-9a-f]{6}$/i.test(color)?color:null;
 if(!value){localStorage.removeItem('qrBackground');applyTheme(localStorage.getItem('qbtheme')||'default');return}
 document.documentElement.style.setProperty('--bg',value);
 document.documentElement.style.setProperty('--panel','color-mix(in srgb, '+value+' 88%, var(--fg))');
 document.documentElement.style.setProperty('--panel2','color-mix(in srgb, '+value+' 78%, var(--fg))');
 localStorage.setItem('qrBackground',value);
}
export function applyTheme(name){
 const palette=palettes[name]||palettes.default;
 for(const [key,value] of Object.entries(palette))document.documentElement.style.setProperty('--'+key,value);
 document.documentElement.style.colorScheme=name==='sepia'||name==='light'?'light':'dark';
 localStorage.setItem('qbtheme',name);
 if($('readerTheme'))$('readerTheme').value=name;
 const accent=localStorage.getItem('qrAccent');if(accent)applyAccent(accent);
 const background=localStorage.getItem('qrBackground');if(background)applyBackground(background);
}
export function initTheme(){applyTheme(localStorage.getItem('qbtheme')||'default')}
