const fs=require('fs'); 
const { JSDOM } = require('jsdom'); 
const html = fs.readFileSync('motvin-icons.html', 'utf8'); 
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "dangerously" }); 

const js1 = fs.readFileSync('real_icons_data.js', 'utf8'); 
const script1 = dom.window.document.createElement('script'); 
script1.textContent = js1; 
dom.window.document.body.appendChild(script1); 

const js = fs.readFileSync('motvin-icons.js', 'utf8'); 
const script = dom.window.document.createElement('script'); 
script.textContent = js; 
dom.window.document.body.appendChild(script); 

setTimeout(() => { 
  try {
    const win = dom.window;
    if(!win.state) { console.log("State undefined"); return; }
    
    // Check initial state
    const grid = win.document.getElementById('icon-grid');
    console.log('Initial Grid length:', grid.innerHTML.length);
    console.log('Initial Results count text:', win.document.getElementById('results-count').textContent);

    // Simulate clicking 'Arrows'
    const catItem = win.document.querySelector('.mi-rp-cat-item[data-cat="Arrows"]');
    if(catItem) {
      catItem.click();
      console.log('Clicked Arrows');
      console.log('Query is:', win.state.query);
      console.log('Grid innerHTML length:', grid.innerHTML.length);
      console.log('Results count text:', win.document.getElementById('results-count').textContent);
    } else {
      console.log('Category not found');
    }
  } catch(e) {
    console.log('Error:', e);
  }
}, 1000);
