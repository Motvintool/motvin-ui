const paths = '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16v-5.5a2.5 2.5 0 0 1 5 0V16m0-4H3m9-6v12m4-2V8h3a2 2 0 0 1 0 4h-3m3 0a2 2 0 0 1 0 4h-3"/>';
const strokeInl = 'stroke="red" stroke-width="1.75" stroke-linecap="butt" stroke-linejoin="miter"';
const isFillBased = false;
const rootFill = "none";
const color = "red";
const opts = { fillMode: "none" };

let cleanPaths = paths.replace(/stroke-width="[^"]*"/g, '')
                      .replace(/stroke-linecap="[^"]*"/g, '')
                      .replace(/stroke-linejoin="[^"]*"/g, '');

cleanPaths = cleanPaths.replace(/<(path|circle|rect|polygon|polyline|line|ellipse)([^>]*)>/g, function(match, tag, attrs) {
  const isSelfClosing = attrs.trim().endsWith('/');
  const pureAttrs = attrs.replace(/\/$/, '');

  let pathStroke = strokeInl;
  const strokeMatch = pureAttrs.match(/stroke="([^"]*)"/);
  if (strokeMatch) {
    const val = strokeMatch[1].toLowerCase();
    if (val === 'none') {
      pathStroke = `stroke="none"`;
    }
  }

  let pathFill = rootFill;

  let cleanAttrs = pureAttrs.replace(/stroke="[^"]*"/g, '').replace(/fill="[^"]*"/g, '');
  const endTag = isSelfClosing ? ' />' : '>';
  return `<${tag} ${cleanAttrs} fill="${pathFill}" ${pathStroke}${endTag}`;
});

console.log(cleanPaths);
