const fs = require('fs');
let content = fs.readFileSync('JS/motvin-icons.js', 'utf8');

const target = `  // Hide Fill, Stroke, and STROKE advanced section if the icon style is solid
  const isOutline = state.editorIcon?.style !== "solid";
  const displayVal = isOutline ? "" : "none";`;

const replacement = `  // Hide Fill, Stroke, and STROKE advanced section if the icon is fill-based
  const isFillBased = state.editorIcon ? !state.editorIcon.svg.includes("stroke") : false;
  const displayVal = isFillBased ? "none" : "";`;

content = content.replace(target, replacement);
fs.writeFileSync('JS/motvin-icons.js', content);
