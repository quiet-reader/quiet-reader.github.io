import {$} from './utils.js';
const palettes={
 default:{bg:'#171d26',panel:'#202a36',panel2:'#293646',fg:'#e5ebf1',muted:'#9ba9b8',line:'#354456',accent:'#b9f27c'},
 dark:{bg:'#10141b',panel:'#171e28',panel2:'#222d3a',fg:'#e9eef4',muted:'#95a2b1',line:'#303d4d',accent:'#b9f27c'},
 sepia:{bg:'#eee2ce',panel:'#e4d5bc',panel2:'#d8c5a6',fg:'#4d3c2a',muted:'#806d56',line:'#c6b391',accent:'#987344'},
 light:{bg:'#f4f6f8',panel:'#ffffff',panel2:'#e9edf1',fg:'#26313c',muted:'#667483',line:'#d5dce3',accent:'#648b43'}
};
export function applyTheme(name){
 const palette=palettes[name]||palettes.default;
 for(const [key,value] of Object.entries(palette))document.documentElement.style.setProperty('--'+key,value);
 localStorage.setItem('qbtheme',name);
 if($('readerTheme'))$('readerTheme').value=name;
}
export function initTheme(){applyTheme(localStorage.getItem('qbtheme')||'default')}
