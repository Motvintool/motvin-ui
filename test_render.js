const fs = require('fs');
const jsCode = fs.readFileSync('JS/motvin-icons.js', 'utf8');

const tdesign = '<g fill=\"none\"><path d=\"M21 3h-9v18h9z\"/><path stroke=\"currentColor\" stroke-width=\"2\" d=\"M12 3h9v9m-9-9v9m0-9l9 9m-9 0v9h9m-9-9l9 9m0 0v-9\"/><path stroke=\"currentColor\" stroke-width=\"2\" d=\"M3 3v18h18V3z\"/></g>';

// Extract the renderSvg function
const renderSvgCode = jsCode.substring(jsCode.indexOf('function renderSvg'), jsCode.indexOf('// ---'));
eval(renderSvgCode);

console.log(renderSvg(tdesign, { viewBox: '0 0 24 24', iconStyle: 'outline', color: 'red' }));
