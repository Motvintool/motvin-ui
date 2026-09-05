const fs = require('fs');
const path = require('path');

// Go up one directory to reach the root of motvin-ui where index.html lives
const file = path.join(__dirname, '../index.html');

let content = fs.readFileSync(file, 'utf8'); 

// Uses a regular expression to find all ASSET/Images/*.png and rename the extension to .webp
content = content.replace(/ASSET\/Images\/([^"]+)\.png/g, 'ASSET/Images/$1.webp'); 

fs.writeFileSync(file, content);
console.log('Successfully updated HTML links from PNG to WebP');
