const fs = require('fs');
const path = require('path');
const https = require('https');

const allLogos = [];
const seenIds = new Set();

const baseUrl = 'https://raw.githubusercontent.com/iconify/icon-sets/master/json/';

function getDimensions(iconData, data) {
  const info = data.info || {};
  const dH = info.displayHeight;
  const dW = info.displayWidth ?? dH;
  const defaultHeight = dH ?? info.height ?? info.width ?? 16;
  const defaultWidth = dW ?? info.width ?? info.height ?? 16;
  const vLeft = iconData.left ?? data.left ?? 0;
  const vTop = iconData.top ?? data.top ?? 0;
  const vWidth = iconData.width ?? data.width ?? defaultWidth;
  const vHeight = iconData.height ?? data.height ?? defaultHeight;
  return vLeft + ' ' + vTop + ' ' + vWidth + ' ' + vHeight;
}

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      if (res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const sources = [
  { file: 'logos',         sourceId: 'logos',        sourceName: 'SVG Logos',        style: 'color' },
  { file: 'simple-icons',  sourceId: 'simpleicons',  sourceName: 'Simple Icons',       style: 'solid' },
  { file: 'skill-icons',   sourceId: 'skillicons',   sourceName: 'Skill Icons',        style: 'color' },
  { file: 'devicon',       sourceId: 'devicon',      sourceName: 'Devicon',            style: 'color' }
];

async function processSource(src) {
  console.log(`Fetching ${src.sourceName} (${src.file}.json)...`);
  try {
    const data = await fetchJson(`${baseUrl}${src.file}.json`);
    const iconsObj = data.icons || {};
    let count = 0;

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      const uid = `${src.sourceId}_${src.style}_${iconName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allLogos.push({
        id: uid,
        name: iconName,
        source: src.sourceId,
        sourceName: src.sourceName,
        category: 'Logo',
        tags: [iconName, 'logo', 'brand', src.sourceId, src.style],
        style: src.style,
        viewBox: viewBox,
        svg: svgBody
      });
      count++;
    });
    console.log(`  ✓ Added ${count} logos from ${src.sourceName}`);
  } catch (e) {
    console.log(`  ✗ Error downloading ${src.file}.json: ${e.message}`);
  }
}

async function processVectorLogoZone() {
  console.log(`Fetching VectorLogoZone (via GitHub Tree)...`);
  try {
    const treeData = await fetchJson('https://api.github.com/repos/VectorLogoZone/vectorlogozone/git/trees/main?recursive=1', {
      headers: { 'User-Agent': 'Node.js Fetcher' }
    });
    
    // Filter for files in src/content/logos that are SVGs
    const svgFiles = treeData.tree.filter(node => 
      node.path.startsWith('src/content/logos/') && 
      node.path.endsWith('.svg')
    );

    console.log(`  Found ${svgFiles.length} logos in VectorLogoZone. Downloading SVGs...`);
    
    let count = 0;
    // Download in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < svgFiles.length; i += chunkSize) {
      const chunk = svgFiles.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (fileNode) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/VectorLogoZone/vectorlogozone/main/${fileNode.path}`;
          const svgContent = await fetchText(rawUrl);
          
          const iconName = fileNode.path.split('/').pop().replace('.svg', '');
          const uid = `vectorlogozone_color_${iconName}`;
          if (seenIds.has(uid)) return;
          
          let viewBox = '0 0 24 24'; // default
          const vbMatch = svgContent.match(/viewBox=["'](.*?)["']/i);
          if (vbMatch) {
            viewBox = vbMatch[1];
          } else {
            const wMatch = svgContent.match(/<svg[^>]*\swidth=["']([^"']+)["']/i);
            const hMatch = svgContent.match(/<svg[^>]*\sheight=["']([^"']+)["']/i);
            if (wMatch && hMatch) {
              const w = parseFloat(wMatch[1].replace(/[^\d.]/g, ''));
              const h = parseFloat(hMatch[1].replace(/[^\d.]/g, ''));
              if (!isNaN(w) && !isNaN(h)) {
                viewBox = `0 0 ${w} ${h}`;
              }
            }
          }
          
          const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
          let svgBody = '';
          if (bodyMatch) {
            svgBody = bodyMatch[1].trim();
          } else {
            return; // Not a valid SVG or couldn't parse
          }

          seenIds.add(uid);
          allLogos.push({
            id: uid,
            name: iconName,
            source: 'vectorlogozone',
            sourceName: 'VectorLogoZone',
            category: 'Logo',
            tags: [iconName, 'logo', 'brand', 'vectorlogozone', 'color'],
            style: 'color',
            viewBox: viewBox,
            svg: svgBody
          });
          count++;
        } catch (e) {
          // ignore individual fetch errors
        }
      }));
      
      process.stdout.write(`\r  Progress: ${Math.min(i + chunkSize, svgFiles.length)} / ${svgFiles.length} (${count} added)`);
    }
    console.log(`\n  ✓ Added ${count} logos from VectorLogoZone`);
  } catch (e) {
    console.log(`\n  ✗ Error downloading VectorLogoZone: ${e.message}`);
  }
}

async function main() {
  for (const src of sources) {
    await processSource(src);
  }
  
  await processVectorLogoZone();

  const byStyle = allLogos.reduce((m, ic) => { m[ic.style] = (m[ic.style] || 0) + 1; return m; }, {});
  console.log('\n=== SUMMARY ===');
  Object.entries(byStyle).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log(`  ${s}: ${c}`));
  console.log(`  TOTAL: ${allLogos.length}`);

  const outputJS = `var REAL_LOGOS = ${JSON.stringify(allLogos)};\n`;
  const rootPath = path.join(__dirname, '..', 'real_logos_data.js');
  fs.writeFileSync(rootPath, outputJS);
  console.log(`\nSaved ${allLogos.length} logos to real_logos_data.js (root)!`);
}

main();
