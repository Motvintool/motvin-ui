const fs = require('fs');
let content = fs.readFileSync('JS/motvin-icons.js', 'utf8');

const target = `  // Hide stroke controls if the icon style is solid (only for outline icons)
  const isOutline = state.editorIcon.style === "outline";
  $("#ctrl-stroke").closest(".mi-ctrl-group").style.display = isOutline
    ? ""
    : "none";`;

const replacement = `  // Hide Fill, Stroke, and STROKE advanced section if the icon style is solid
  const isOutline = state.editorIcon?.style === "outline";
  const displayVal = isOutline ? "" : "none";
  
  const strokeGroup = $("#ctrl-stroke")?.closest(".mi-ctrl-group");
  if (strokeGroup) strokeGroup.style.display = displayVal;
  
  const fillModeGroup = $("#grp-fill-mode");
  if (fillModeGroup) fillModeGroup.style.display = displayVal;
  
  const strokeSection = $("#grp-stroke-section");
  if (strokeSection) strokeSection.style.display = displayVal;
  
  const strokeDivider = $("#grp-stroke-divider");
  if (strokeDivider) strokeDivider.style.display = displayVal;`;

content = content.replace(target, replacement);
fs.writeFileSync('JS/motvin-icons.js', content);
