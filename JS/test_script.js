const fs=require('fs'); 
const { JSDOM } = require('jsdom'); 
const html = fs.readFileSync('motvin-icons.html', 'utf8'); 
const dom = new JSDOM(html); 
global.window = dom.window; 
global.document = dom.window.document; 
global.localStorage = { getItem:()=>null, setItem:()=>null }; 
const js = fs.readFileSync('motvin-icons.js', 'utf8'); 

// Patch JS to attach state and ICONS to window so we can test it
let patchedJs = js + "\nwindow.state = state; window.ICONS = ICONS; window.filterIcons = filterIcons;";

const script = document.createElement('script'); 
script.textContent = patchedJs; 
document.body.appendChild(script); 

setTimeout(() => { 
  try {
    const state = window.state; 
    const ICONS = window.ICONS; 
    state.query = 'Communication'; 
    const res = window.filterIcons(); 
    console.log('Found:', res.length, 'icons for Communication');
    
    state.query = 'Others';
    const res2 = window.filterIcons(); 
    console.log('Found:', res2.length, 'icons for Others');
  } catch(e) {
    console.log('Error:', e);
  }
}, 500);
