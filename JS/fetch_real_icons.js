const fs = require('fs');
const path = require('path');
const https = require('https');

const allIcons = [];
const seenIds = new Set(); // Prevent duplicates

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


async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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

// Each entry: Iconify JSON file, motvin sourceId, display name, style tag
const sources = [
  // --- NEW PACKS ---
  { file: 'tabler',              sourceId: 'tabler',      sourceName: 'Tabler Icons', style: 'outline' },
  { file: 'ph',                  sourceId: 'phosphor',    sourceName: 'Phosphor',     style: 'outline' },
  { file: 'solar',               sourceId: 'solar',       sourceName: 'Solar',        style: 'outline' },
  { file: 'mingcute',            sourceId: 'mingcute',    sourceName: 'MingCute',     style: 'outline' },
  { file: 'circum',              sourceId: 'circum',      sourceName: 'Circum Icons', style: 'outline' },
  { file: 'typcn',               sourceId: 'typicons',    sourceName: 'Typicons',     style: 'solid' },
  // --- OUTLINE ---
  { file: 'lucide',              sourceId: 'lucide',      sourceName: 'Lucide',       style: 'outline' },
  { file: 'feather',             sourceId: 'feather',     sourceName: 'Feather',      style: 'outline' },
  { file: 'heroicons-outline',   sourceId: 'heroicons',   sourceName: 'Heroicons',    style: 'outline' },
  { file: 'radix-icons',         sourceId: 'radix',       sourceName: 'Radix Icons',  style: 'outline' },
  { file: 'ant-design',          sourceId: 'antd',        sourceName: 'Ant Design',   style: 'outline' },
  { file: 'carbon',              sourceId: 'carbon',      sourceName: 'Carbon',       style: 'outline' },
  { file: 'hugeicons',           sourceId: 'hugeicons',   sourceName: 'Huge Icons',   style: 'outline' },
  { file: 'bx',                  sourceId: 'boxicons',    sourceName: 'Boxicons',     style: 'outline' },
  { file: 'iconoir',             sourceId: 'iconoir',     sourceName: 'Iconoir',      style: 'outline' },
  { file: 'arcticons',           sourceId: 'arcticons',   sourceName: 'Arcticons',    style: 'outline' },
  { file: 'thesvg',              sourceId: 'thesvg',      sourceName: 'theSVG',       style: 'outline' },
  { file: 'griddy-icons',        sourceId: 'griddy',      sourceName: 'Griddy Icons', style: 'outline' },
  { file: 'streamline',          sourceId: 'streamline',  sourceName: 'Streamline',   style: 'outline' },
  { file: 'iconamoon',           sourceId: 'iconamoon',   sourceName: 'IconaMoon',    style: 'outline' },
  { file: 'la',                  sourceId: 'la',          sourceName: 'Line Awesome', style: 'outline' },
  { file: 'lets-icons',          sourceId: 'letsicons',   sourceName: 'Lets Icons',   style: 'outline' },
  { file: 'f7',                  sourceId: 'f7',          sourceName: 'Framework7',   style: 'outline' },
  { file: 'uil',                 sourceId: 'uil',         sourceName: 'Unicons',      style: 'outline' },
  { file: 'clarity',             sourceId: 'clarity',     sourceName: 'Clarity',      style: 'outline' },
  { file: 'mage',                sourceId: 'mage',        sourceName: 'Mage Icons',   style: 'outline' },
  { file: 'octicon',             sourceId: 'octicon',     sourceName: 'Octicons',     style: 'outline' },
  { file: 'flowbite',            sourceId: 'flowbite',    sourceName: 'Flowbite',     style: 'outline' },
  { file: 'gravity-ui',          sourceId: 'gravityui',   sourceName: 'Gravity UI',   style: 'outline' },
  { file: 'vaadin',              sourceId: 'vaadin',      sourceName: 'Vaadin',       style: 'outline' },
  { file: 'teenyicons',          sourceId: 'teenyicons',  sourceName: 'Teenyicons',   style: 'outline' },
  { file: 'stash',               sourceId: 'stash',       sourceName: 'Stash Icons',  style: 'outline' },
  { file: 'jam',                 sourceId: 'jam',         sourceName: 'Jam Icons',    style: 'outline' },
  { file: 'qlementine-icons',    sourceId: 'qlementine',  sourceName: 'Qlementine',   style: 'outline' },
  { file: 'majesticons',         sourceId: 'majesticons', sourceName: 'Majesticons',  style: 'outline' },
  { file: 'gg',                  sourceId: 'gg',          sourceName: 'css.gg',       style: 'outline' },
  { file: 'lineicons',           sourceId: 'lineicons',   sourceName: 'Lineicons',    style: 'outline' },
  { file: 'icomoon-free',        sourceId: 'icomoon',     sourceName: 'IcoMoon Free', style: 'outline' },
  { file: 'eva',                 sourceId: 'eva',         sourceName: 'Eva Icons',    style: 'outline' },
  { file: 'cil',                 sourceId: 'coreui',      sourceName: 'CoreUI Free',  style: 'outline' },
  { file: 'system-uicons',       sourceId: 'systemui',    sourceName: 'System UIcons',style: 'outline' },
  { file: 'fontisto',            sourceId: 'fontisto',    sourceName: 'Fontisto',     style: 'outline' },
  { file: 'proicons',            sourceId: 'proicons',    sourceName: 'ProIcons',     style: 'outline' },
  { file: 'basil',               sourceId: 'basil',       sourceName: 'Basil',        style: 'outline' },
  { file: 'akar-icons',          sourceId: 'akar',        sourceName: 'Akar Icons',   style: 'outline' },
  { file: 'ci',                  sourceId: 'coolicons',   sourceName: 'coolicons',    style: 'outline' },
  { file: 'pixel',               sourceId: 'pixelicon',   sourceName: 'Pixel Icon',   style: 'outline' },
  { file: 'marketeq',            sourceId: 'marketeq',    sourceName: 'Marketeq',     style: 'outline' },
  { file: 'meteor-icons',        sourceId: 'meteor',      sourceName: 'Meteor Icons', style: 'outline' },
  { file: 'oi',                  sourceId: 'oi',          sourceName: 'Open Iconic',  style: 'outline' },
  { file: 'gridicons',           sourceId: 'gridicons',   sourceName: 'Gridicons',    style: 'outline' },
  { file: 'simple-line-icons',   sourceId: 'simpleline',  sourceName: 'Simple Line',  style: 'outline' },
  { file: 'rivet-icons',         sourceId: 'rivet',       sourceName: 'Rivet Icons',  style: 'outline' },
  { file: 'eos-icons',           sourceId: 'eos',         sourceName: 'EOS Icons',    style: 'outline' },
  { file: 'uiw',                 sourceId: 'uiw',         sourceName: 'UIW Icons',    style: 'outline' },
  { file: 'uit',                 sourceId: 'uit',         sourceName: 'Unicons Thin', style: 'outline' },
  { file: 'mono-icons',          sourceId: 'mono',        sourceName: 'Mono Icons',   style: 'outline' },
  { file: 'formkit',             sourceId: 'formkit',     sourceName: 'FormKit',      style: 'outline' },
  { file: 'weui',                sourceId: 'weui',        sourceName: 'WeUI',         style: 'outline' },
  { file: 'ion',                 sourceId: 'ionicons',    sourceName: 'Ionicons',     style: 'outline' },
  { file: 'fa6-regular',         sourceId: 'fontawesome', sourceName: 'Font Awesome', style: 'outline' },
  { file: 'icon-park-outline',   sourceId: 'iconpark',    sourceName: 'IconPark',     style: 'outline' },
  { file: 'ri',                  sourceId: 'remix',       sourceName: 'Remix Icon',   style: 'outline' },
  { file: 'mynaui',              sourceId: 'mynaui',      sourceName: 'Mynaui',       style: 'outline' },
  { file: 'mdi-light',           sourceId: 'material',    sourceName: 'Material',     style: 'outline' },
  // NEW — outline packs
  { file: 'ep',                  sourceId: 'ep',          sourceName: 'Element Plus',   style: 'outline' },
  { file: 'pepicons-print',      sourceId: 'pepicons',    sourceName: 'Pepicons',       style: 'outline' },
  { file: 'charm',               sourceId: 'charm',       sourceName: 'Charm Icons',    style: 'outline' },
  { file: 'nimbus',              sourceId: 'nimbus',      sourceName: 'Nimbus Icons',   style: 'outline' },
  { file: 'quill',               sourceId: 'quill',       sourceName: 'Quill Icons',    style: 'outline' },
  { file: 'bytesize',            sourceId: 'bytesize',    sourceName: 'Bytesize',       style: 'outline' },
  { file: 'nonicons',            sourceId: 'nonicons',    sourceName: 'Nonicons',       style: 'outline' },
  { file: 'oui',                 sourceId: 'oui',         sourceName: 'OpenSearch UI',  style: 'outline' },
  { file: 'wpf',                 sourceId: 'wpf',         sourceName: 'WPF UI Icons',   style: 'outline' },
  { file: 'ps',                  sourceId: 'primeicons',  sourceName: 'PrimeIcons',     style: 'outline' },
  { file: 'topcoat',             sourceId: 'topcoat',     sourceName: 'Topcoat',        style: 'outline' },
  { file: 'gis',                 sourceId: 'gis',         sourceName: 'GIS Map Icons',  style: 'outline' },

  // --- SOLID ---
  { file: 'heroicons-solid',     sourceId: 'heroicons',   sourceName: 'Heroicons',    style: 'solid' },
  { file: 'fa6-solid',           sourceId: 'fontawesome', sourceName: 'Font Awesome', style: 'solid' },
  { file: 'icon-park-solid',     sourceId: 'iconpark',    sourceName: 'IconPark',     style: 'solid' },
  { file: 'bxs',                 sourceId: 'boxicons',    sourceName: 'Boxicons Solid',style: 'solid' },
  { file: 'simple-icons',        sourceId: 'simpleicons', sourceName: 'Simple Icons',style: 'solid' },

  // New sources
  { file: 'ic',                  sourceId: 'ic',          sourceName: 'Google Material Icons', style: 'outline' },
  { file: 'line-md',             sourceId: 'linemd',      sourceName: 'Material Line Icons', style: 'outline' },
  { file: 'lucide-lab',          sourceId: 'lucidelab',   sourceName: 'Lucide Lab',       style: 'outline' },
  { file: 'prime',               sourceId: 'prime',       sourceName: 'Prime Icons',      style: 'outline' },
  { file: 'bitcoin-icons',       sourceId: 'bitcoin',     sourceName: 'Bitcoin Icons',    style: 'outline' },
  { file: 'humbleicons',         sourceId: 'humble',      sourceName: 'Humbleicons',      style: 'outline' },
  { file: 'wordpress',           sourceId: 'wordpress',   sourceName: 'WordPress Icons',  style: 'solid' },
  { file: 'icon-park-twotone',   sourceId: 'iptwotone',   sourceName: 'IconPark TwoTone', style: 'multi-color' },
  { file: 'guidance',            sourceId: 'guidance',    sourceName: 'Guidance',         style: 'solid' },
  { file: 'cuida',               sourceId: 'cuida',       sourceName: 'Cuida Icons',      style: 'outline' },
  { file: 'duo-icons',           sourceId: 'duoicons',    sourceName: 'Duoicons',         style: 'duotone' },
  { file: 'uim',                 sourceId: 'uim',         sourceName: 'Unicons Monochrome', style: 'outline' },
  { file: 'fa7-solid',           sourceId: 'fa7solid',    sourceName: 'Font Awesome 7 Solid', style: 'solid' },
  { file: 'fa7-regular',         sourceId: 'fa7regular',  sourceName: 'Font Awesome 7 Regular', style: 'outline' },
  { file: 'fluent-color',        sourceId: 'fluentcolor', sourceName: 'Fluent UI Color',  style: 'color' },
  { file: 'material-icon-theme', sourceId: 'mit',         sourceName: 'Material Icon Theme', style: 'color' },
  { file: 'pajamas',             sourceId: 'pajamas',     sourceName: 'Gitlab SVGs',      style: 'outline' },
  { file: 'ei',                  sourceId: 'ei',          sourceName: 'Evil Icons',       style: 'outline' },
  { file: 'codex',               sourceId: 'codex',       sourceName: 'CodeX Icons',      style: 'outline' },
  { file: 'memory',              sourceId: 'memory',      sourceName: 'Memory Icons',     style: 'solid' },
  { file: 'ix',                  sourceId: 'ix',          sourceName: 'Siemens Industrial',style: 'outline' },
  { file: 'si',                  sourceId: 'si',          sourceName: 'Sargam Icons',     style: 'outline' },
  { file: 'vadivam',             sourceId: 'vadivam',     sourceName: 'Vadivam',          style: 'solid' },
  { file: 'streamline-cyber',    sourceId: 'scyber',      sourceName: 'Streamline Cyber', style: 'outline' },
  { file: 'streamline-pixel',    sourceId: 'spixel',      sourceName: 'Streamline Pixel', style: 'outline' },
  { file: 'streamline-block',    sourceId: 'sblock',      sourceName: 'Streamline Block', style: 'solid' },
  { file: 'glyphs-poly',         sourceId: 'glyphspoly',  sourceName: 'Glyphs Poly',      style: 'solid' },
  { file: 'ooui',                sourceId: 'ooui',        sourceName: 'OOUI',             style: 'outline' },
  { file: 'fe',                  sourceId: 'fe',          sourceName: 'Feather Icon',     style: 'outline' },
  { file: 'devicon-plain',       sourceId: 'deviconplain',sourceName: 'Devicon Plain',    style: 'solid' },
  { file: 'fa7-brands',          sourceId: 'fa7brands',   sourceName: 'Font Awesome 7 Brands', style: 'solid' },
  { file: 'flat-color-icons',    sourceId: 'flatcolor',   sourceName: 'Flat Color Icons', style: 'color' },
  { file: 'icons8',              sourceId: 'icons8',      sourceName: 'Icons8 Windows 10',style: 'outline' },
  { file: 'k8s',                 sourceId: 'k8s',         sourceName: 'Kubernetes Icons', style: 'color' },
  { file: 'unjs',                sourceId: 'unjs',        sourceName: 'UnJS Logos',       style: 'outline' },
  { file: 'brandico',            sourceId: 'brandico',    sourceName: 'Brandico',         style: 'solid' },
  { file: 'geo',                 sourceId: 'geo',         sourceName: 'GeoGlyphs',        style: 'solid' },
  { file: 'osmic',               sourceId: 'osmic',       sourceName: 'OSM Icons',        style: 'solid' },

  { file: 'grommet-icons',       sourceId: 'grommet',     sourceName: 'Grommet Icons',    style: 'outline' },
  { file: 'zmdi',                sourceId: 'zmdi',        sourceName: 'MD Iconic Font',   style: 'solid' },
  { file: 'streamline-emojis',   sourceId: 'semojis',     sourceName: 'Streamline Emojis',style: 'color' },
  { file: 'icon-park',           sourceId: 'iconparkbase',sourceName: 'IconPark',         style: 'outline' },
  { file: 'picon',               sourceId: 'picon',       sourceName: 'Pico-icon',        style: 'outline' },
  { file: 'roentgen',            sourceId: 'roentgen',    sourceName: 'Röntgen',          style: 'solid' },
  { file: 'temaki',              sourceId: 'temaki',      sourceName: 'Temaki',           style: 'solid' },
  { file: 'fad',                 sourceId: 'fad',         sourceName: 'FontAudio',        style: 'solid' },
  { file: 'ginetex',             sourceId: 'ginetex',     sourceName: 'Ginetex Care',     style: 'solid' },
  { file: 'raphael',             sourceId: 'raphael',     sourceName: 'Raphael',          style: 'solid' },
  { file: 'et',                  sourceId: 'et',          sourceName: 'Elegant',          style: 'outline' },

  { file: 'streamline-kameleon-color', sourceId: 'kameleon',   sourceName: 'Kameleon color',   style: 'color' },
  { file: 'fluent-emoji',        sourceId: 'fluentemoji', sourceName: 'Fluent Emoji',     style: 'color' },
  { file: 'nrk',                 sourceId: 'nrk',         sourceName: 'NRK Core Icons',   style: 'outline' },
  { file: 'streamline-stickies-color', sourceId: 'stickies',   sourceName: 'Stickies color',   style: 'color' },
  { file: 'streamline-cyber-color',    sourceId: 'cybercolor', sourceName: 'Streamline Cyber color',      style: 'color' },
  { file: 'at-icons',            sourceId: 'aticons',     sourceName: '@icons',           style: 'solid' },
  { file: 'iwwa',                sourceId: 'iwwa',        sourceName: 'Innowatio Font',   style: 'solid' },
  { file: 'gala',                sourceId: 'gala',        sourceName: 'Gala Icons',       style: 'outline' },
  { file: 'subway',              sourceId: 'subway',      sourceName: 'Subway Icon Set',  style: 'solid' },
  { file: 'whh',                 sourceId: 'whh',         sourceName: 'WebHostingHub Glyphs',    style: 'solid' },
  { file: 'ls',                  sourceId: 'ls',          sourceName: 'Ligature Symbols', style: 'solid' },
  { file: 'bpmn',                sourceId: 'bpmn',        sourceName: 'BPMN',             style: 'solid' },
  { file: 'fa-solid',            sourceId: 'fa-solid',    sourceName: 'Font Awesome 5 Solid', style: 'solid' },
  { file: 'fa-regular',          sourceId: 'fa-regular',  sourceName: 'Font Awesome 5 Regular', style: 'outline' },
  { file: 'fa-brands',           sourceId: 'fa-brands',   sourceName: 'Font Awesome 5 Brands', style: 'solid' },
  { file: 'fa',                  sourceId: 'fa',          sourceName: 'Font Awesome 4',   style: 'solid' },
  { file: 'si-glyph',            sourceId: 'si-glyph',    sourceName: 'SmartIcons Glyph', style: 'solid' },
  { file: 'flat-ui',             sourceId: 'flat-ui',     sourceName: 'Flat UI Icons',    style: 'color' },
  { file: 'vs',                  sourceId: 'vs',          sourceName: 'Vesper Icons',     style: 'solid' },
  { file: 'il',                  sourceId: 'il',          sourceName: 'Icalicons',        style: 'outline' },
  { file: 'websymbol',           sourceId: 'websymbol',   sourceName: 'Web Symbols Liga', style: 'solid' },
  { file: 'fontelico',           sourceId: 'fontelico',   sourceName: 'Fontelico',        style: 'solid' },
  { file: 'pepicons',            sourceId: 'pepicons-orig', sourceName: 'Pepicons Original', style: 'solid' },

  { file: 'logos',               sourceId: 'logos',       sourceName: 'SVG Logos',    style: 'color' },
  { file: 'ix2',                 sourceId: 'ix2',         sourceName: 'Siemens Industrial Experience', style: 'solid' },
  { file: 'la',                  sourceId: 'la',          sourceName: 'Line Awesome',     style: 'solid' },
  { file: 'vscode-icons',        sourceId: 'vscode',      sourceName: 'VSCode Icons', style: 'color' },
  { file: 'devicon',             sourceId: 'devicon',     sourceName: 'Devicon',      style: 'color' },
  { file: 'emojione',            sourceId: 'emojione',    sourceName: 'Emoji One',    style: 'color' },
  { file: 'file-icons',          sourceId: 'fileicons',   sourceName: 'File Icons',   style: 'solid' },
  { file: 'codicon',             sourceId: 'codicon',     sourceName: 'Codicons',     style: 'solid' },
  { file: 'circle-flags',        sourceId: 'circleflags', sourceName: 'Circle Flags', style: 'color' },
  { file: 'pixelarticons',       sourceId: 'pixelart',    sourceName: 'Pixelarticons',style: 'solid' },
  { file: 'cryptocurrency',      sourceId: 'crypto',      sourceName: 'Crypto Icons', style: 'solid' },
  { file: 'flag',                sourceId: 'flagicons',   sourceName: 'Flag Icons',   style: 'color' },
  { file: 'gcp',                 sourceId: 'gcp',         sourceName: 'Google Cloud', style: 'color' },
  { file: 'wi',                  sourceId: 'wi',          sourceName: 'Weather Icons',style: 'solid' },
  { file: 'covid',               sourceId: 'covid',       sourceName: 'Covid Icons',  style: 'solid' },
  { file: 'medical-icon',        sourceId: 'medical',     sourceName: 'Medical Icons',style: 'solid' },
  { file: 'academicons',         sourceId: 'academicons', sourceName: 'Academicons',  style: 'solid' },
  { file: 'maki',                sourceId: 'maki',        sourceName: 'Maki',         style: 'solid' },
  { file: 'map',                 sourceId: 'mapicons',    sourceName: 'Map Icons',    style: 'solid' },
  { file: 'uis',                 sourceId: 'uis',         sourceName: 'Unicons Solid',style: 'solid' },
  { file: 'flagpack',            sourceId: 'flagpack',    sourceName: 'Flagpack',     style: 'color' },
  { file: 'cif',                 sourceId: 'cif',         sourceName: 'CoreUI Flags', style: 'color' },
  { file: 'glyphs',              sourceId: 'glyphs',      sourceName: 'Glyphs',       style: 'solid' },
  { file: 'reicon',              sourceId: 'reicon',      sourceName: 'Reicon',       style: 'solid' },
  { file: 'game-icons',          sourceId: 'gameicons',   sourceName: 'Game Icons',   style: 'solid' },
  { file: 'selfhst',             sourceId: 'selfhst',     sourceName: 'selfh.st',     style: 'solid' },
  { file: 'token-branded',       sourceId: 'web3',        sourceName: 'Web3 Icons',   style: 'solid' },
  { file: 'healthicons',         sourceId: 'health',      sourceName: 'Health Icons', style: 'solid' },
  { file: 'openmoji',            sourceId: 'openmoji',    sourceName: 'OpenMoji',     style: 'color' },
  { file: 'twemoji',             sourceId: 'twemoji',     sourceName: 'Twemoji',      style: 'color' },
  { file: 'mdi',                 sourceId: 'material',    sourceName: 'Material',     style: 'solid' },
  // NEW — solid packs
  { file: 'pepicons-pop',        sourceId: 'pepicons',    sourceName: 'Pepicons',     style: 'solid' },

  // NEW — Color & Emoji Packs (Rule 1: MUST be 'color' to preserve gradients)
  { file: 'emojione-v1',           sourceId: 'emojione-v1',           sourceName: 'Emoji One (v1)',        style: 'color' },
  { file: 'streamline-plump-color',sourceId: 'streamline-plump-color',sourceName: 'Plump Color Icons',     style: 'color' },
  { file: 'streamline-freehand-color',sourceId: 'streamline-freehand-color',sourceName: 'Freehand Color Icons', style: 'color' },
  { file: 'streamline-flex-color', sourceId: 'streamline-flex-color', sourceName: 'Flex Color Icons',      style: 'color' },
  { file: 'streamline-sharp-color',sourceId: 'streamline-sharp-color',sourceName: 'Sharp Color Icons',     style: 'color' },
  { file: 'streamline-ultimate-color',sourceId: 'streamline-ultimate-color',sourceName: 'Ultimate Color Icons',style: 'color' },

  { file: 'thesvg-color',        sourceId: 'thesvg-color',        sourceName: 'theSVG Color',       style: 'color' },
  { file: 'fluent-emoji-flat',   sourceId: 'fluent-emoji-flat',   sourceName: 'Fluent Emoji Flat',  style: 'color' },
  { file: 'streamline-color',    sourceId: 'streamline-color',    sourceName: 'Streamline Color',   style: 'color' },
  { file: 'streamline-logos',    sourceId: 'streamline-logos',    sourceName: 'Streamline Logos',   style: 'color' },
  { file: 'cbi',                 sourceId: 'cbi',                 sourceName: 'Custom Brand Icons', style: 'color' },

  // NEW — UI Packs (Rule 2: MUST be 'outline' or 'solid', renderer auto-detects fills)
  { file: 'fluent-emoji-high-contrast', sourceId: 'fluent-emoji-hc',  sourceName: 'Fluent Emoji High Contrast', style: 'solid' },
  { file: 'streamline-sharp',    sourceId: 'streamline-sharp',    sourceName: 'Sharp Free Icons',   style: 'outline' },
  { file: 'streamline-flex',     sourceId: 'streamline-flex',     sourceName: 'Flex Free Icons',    style: 'outline' },
  { file: 'streamline-plump',    sourceId: 'streamline-plump',    sourceName: 'Plump Free Icons',   style: 'solid' },
  { file: 'famicons',            sourceId: 'famicons',            sourceName: 'Famicons',           style: 'solid' },
  { file: 'pepicons-pencil',     sourceId: 'pepicons-pencil',     sourceName: 'Pepicons Pencil',    style: 'outline' },
  { file: 'dinkie-icons',        sourceId: 'dinkie-icons',        sourceName: 'Dinkie Icons',       style: 'solid' },
  { file: 'streamline-freehand', sourceId: 'streamline-freehand', sourceName: 'Freehand Free Icons',style: 'outline' },
  { file: 'garden',              sourceId: 'garden',              sourceName: 'Garden SVG Icons',   style: 'solid' },

  { file: 'streamline-ultimate', sourceId: 'streamline-ultimate', sourceName: 'Streamline Ultimate',style: 'outline' },
  { file: 'fluent-mdl2',         sourceId: 'fluent-mdl2',         sourceName: 'Fluent UI MDL2',     style: 'outline' },
  { file: 'pinhead',             sourceId: 'pinhead',             sourceName: 'Pinhead Map Icons',  style: 'solid' },
  { file: 'zondicons',           sourceId: 'zondicons',   sourceName: 'Zondicons',    style: 'solid' },
  { file: 'dashicons',           sourceId: 'dashicons',   sourceName: 'Dashicons',    style: 'solid' },
  { file: 'entypo',              sourceId: 'entypo',      sourceName: 'Entypo',       style: 'solid' },
  { file: 'entypo-social',       sourceId: 'entyposoc',   sourceName: 'Entypo Social',style: 'solid' },
  { file: 'foundation',          sourceId: 'foundation',  sourceName: 'Foundation',   style: 'solid' },
  { file: 'fa6-brands',          sourceId: 'fabrand',     sourceName: 'FA6 Brands',   style: 'solid' },
  { file: 'cryptocurrency-color',sourceId: 'cryptoclr',  sourceName: 'Crypto Color', style: 'solid' },
  { file: 'cib',                 sourceId: 'cib',         sourceName: 'CoreUI Brands',style: 'solid' },
  { file: 'bxl',                 sourceId: 'bxlogos',     sourceName: 'Boxicons Logos',style:'solid' },

  // --- COLOR / MULTICOLOR (treated as solid in grid, filterable by style) ---
  { file: 'noto',                sourceId: 'noto',        sourceName: 'Noto Emoji',   style: 'color' },
  { file: 'fxemoji',             sourceId: 'fxemoji',     sourceName: 'FxEmoji',      style: 'color' },
  { file: 'noto-v1',             sourceId: 'notov1',      sourceName: 'Noto v1',      style: 'color' },
  { file: 'skill-icons',         sourceId: 'skillicons',  sourceName: 'Skill Icons',  style: 'color' },
  { file: 'catppuccin',          sourceId: 'catppuccin',  sourceName: 'Catppuccin',   style: 'color' },
  { file: 'svg-spinners',        sourceId: 'spinners',    sourceName: 'SVG Spinners', style: 'color' },
  // Mono emoji
  { file: 'emojione-monotone',   sourceId: 'emojimono',   sourceName: 'Emoji One Mono',style:'outline'},

  // --- BOLD ---
  { file: 'mynaui',              sourceId: 'mynaui',      sourceName: 'Mynaui',       style: 'bold' },  // mynaui is actually bold/thick

  // --- THIN ---
  { file: 'material-symbols-light', sourceId: 'material', sourceName: 'Material',    style: 'thin' },

  // --- ROUNDED ---
  { file: 'material-symbols',    sourceId: 'material',    sourceName: 'Material',     style: 'rounded' },
];


async function processSource(src) {
  try {
    console.log(`Downloading ${src.file}.json (${src.style})...`);
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

      allIcons.push({
        id: uid,
        name: iconName,
        source: src.sourceId,
        sourceName: src.sourceName,
        category: 'UI',
        tags: [iconName, 'ui', src.sourceId, src.style],
        style: src.style,
        viewBox: viewBox,
        svg: svgBody
      });
      count++;
    });
    console.log(`  ✓ Loaded ${count} ${src.style} icons from ${src.sourceId}`);
  } catch (e) {
    console.log(`  ✗ Error downloading ${src.file}.json: ${e.message}`);
  }
}

async function processSolar() {
  // Solar encodes style in icon name suffix:
  // -outline = outline, -bold = bold, -bold-duotone = duotone, -linear = thin
  try {
    console.log(`Downloading solar.json (multi-style)...`);
    const data = await fetchJson(`${baseUrl}solar.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, bold: 0, duotone: 0, thin: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-bold-duotone')) {
        style = 'duotone'; baseName = iconName.replace(/-bold-duotone$/, '');
      } else if (iconName.endsWith('-bold')) {
        style = 'bold'; baseName = iconName.replace(/-bold$/, '');
      } else if (iconName.endsWith('-linear')) {
        style = 'thin'; baseName = iconName.replace(/-linear$/, '');
      } else if (iconName.endsWith('-outline')) {
        style = 'outline'; baseName = iconName.replace(/-outline$/, '');
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `solar_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'solar',
        sourceName: 'Solar',
        category: 'UI',
        tags: [baseName, 'ui', 'solar', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Solar: outline=${counts.outline}, bold=${counts.bold}, duotone=${counts.duotone}, thin=${counts.thin}`);
  } catch (e) {
    console.log(`  ✗ Error downloading solar.json: ${e.message}`);
  }
}

async function processBootstrap() {
  try {
    console.log(`Downloading bi.json (Bootstrap Icons)...`);
    const data = await fetchJson(`${baseUrl}bi.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-fill')) {
        style = 'solid'; baseName = iconName.replace(/-fill$/, '');
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `bi_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'bootstrap',
        sourceName: 'Bootstrap',
        category: 'UI',
        tags: [baseName, 'ui', 'bootstrap', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Bootstrap: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading bi.json: ${e.message}`);
  }
}

async function processFluent() {
  try {
    console.log(`Downloading fluent.json (Fluent UI)...`);
    const data = await fetchJson(`${baseUrl}fluent.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;
      
      // Fluent UI has sizes like -16, -20, -24. We only pick 24 to avoid thousands of duplicate icons.
      if (!iconName.includes('-24-')) return;

      let style, baseName;
      if (iconName.endsWith('-filled')) {
        style = 'solid'; baseName = iconName.replace(/-24-filled$/, '');
      } else if (iconName.endsWith('-regular')) {
        style = 'outline'; baseName = iconName.replace(/-24-regular$/, '');
      } else {
        return;
      }

      const uid = `fluent_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'fluent',
        sourceName: 'Fluent UI',
        category: 'UI',
        tags: [baseName, 'ui', 'fluent', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Fluent UI: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading fluent.json: ${e.message}`);
  }
}

async function processTabler() {
  try {
    console.log(`Downloading tabler.json (Tabler)...`);
    const data = await fetchJson(`${baseUrl}tabler.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-filled')) {
        style = 'solid'; baseName = iconName.replace(/-filled$/, '');
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `tabler_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'tabler',
        sourceName: 'Tabler',
        category: 'UI',
        tags: [baseName, 'ui', 'tabler', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Tabler: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading tabler.json: ${e.message}`);
  }
}

async function processPhosphor() {
  try {
    console.log(`Downloading ph.json (Phosphor)...`);
    const data = await fetchJson(`${baseUrl}ph.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0, duotone: 0, bold: 0, thin: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-fill')) {
        style = 'solid'; baseName = iconName.replace(/-fill$/, '');
      } else if (iconName.endsWith('-bold')) {
        style = 'bold'; baseName = iconName.replace(/-bold$/, '');
      } else if (iconName.endsWith('-duotone')) {
        style = 'duotone'; baseName = iconName.replace(/-duotone$/, '');
      } else if (iconName.endsWith('-thin')) {
        style = 'thin'; baseName = iconName.replace(/-thin$/, '');
      } else if (iconName.endsWith('-light')) {
        return; // skip light variant to avoid bloat
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `phosphor_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'phosphor',
        sourceName: 'Phosphor',
        category: 'UI',
        tags: [baseName, 'ui', 'phosphor', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Phosphor: outline=${counts.outline}, solid=${counts.solid}, bold=${counts.bold}, duotone=${counts.duotone}, thin=${counts.thin}`);
  } catch (e) {
    console.log(`  ✗ Error downloading ph.json: ${e.message}`);
  }
}

async function processMingCute() {
  try {
    console.log(`Downloading mingcute.json (MingCute)...`);
    const data = await fetchJson(`${baseUrl}mingcute.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-fill')) {
        style = 'solid'; baseName = iconName.replace(/-fill$/, '');
      } else {
        style = 'outline'; baseName = iconName.replace(/-line$/, ''); // handles -line too
      }

      const uid = `mingcute_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'mingcute',
        sourceName: 'MingCute',
        category: 'UI',
        tags: [baseName, 'ui', 'mingcute', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ MingCute: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading mingcute.json: ${e.message}`);
  }
}

async function processSidekick() {
  try {
    console.log(`Downloading sidekickicons.json (Sidekick)...`);
    const data = await fetchJson(`${baseUrl}sidekickicons.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let baseName = iconName;
      let style = 'outline';
      
      if (iconName.includes('solid')) {
        style = 'solid';
        baseName = iconName.replace(/-?\d*-?solid$/, '');
      }

      const uid = `sidekick_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      
      const vBox = getDimensions(iconData, data);
      allIcons.push({
        id: uid,
        name: baseName,
        source: 'sidekick',
        sourceName: 'Sidekick',
        category: 'UI',
        tags: [baseName, 'ui', 'sidekick', style],
        style: style,
        viewBox: vBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Sidekick: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (err) {
    console.error(`Error processing Sidekick: ${err.message}`);
  }
}

async function processLsicon() {
  try {
    console.log(`Downloading lsicon.json (Lsicon)...`);
    const data = await fetchJson(`${baseUrl}lsicon.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-filled')) {
        style = 'solid'; baseName = iconName.replace(/-filled$/, '');
      } else if (iconName.endsWith('-outline')) {
        style = 'outline'; baseName = iconName.replace(/-outline$/, '');
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `lsicon_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);

      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'lsicon',
        sourceName: 'Lsicon',
        category: 'UI',
        tags: [baseName, 'ui', 'lsicon', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ Lsicon: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading lsicon.json: ${e.message}`);
  }
}


async function processTDesign() {
  try {
    console.log(`Downloading tdesign.json (TDesign)...`);
    const data = await fetchJson(`${baseUrl}tdesign.json`);
    const iconsObj = data.icons || {};
    const counts = { outline: 0, solid: 0 };

    Object.entries(iconsObj).forEach(([iconName, iconData]) => {
      if (iconData.hidden) return;
      const svgBody = iconData.body;
      if (!svgBody) return;

      let style, baseName;
      if (iconName.endsWith('-filled')) {
        style = 'solid'; baseName = iconName.replace(/-filled$/, '');
      } else {
        style = 'outline'; baseName = iconName;
      }

      const uid = `tdesign_${style}_${baseName}`;
      if (seenIds.has(uid)) return;
      seenIds.add(uid);
      const viewBox = getDimensions(iconData, data);

      allIcons.push({
        id: uid,
        name: baseName,
        source: 'tdesign',
        sourceName: 'TDesign',
        category: 'UI',
        tags: [baseName, 'ui', 'tdesign', style],
        style: style,
        viewBox: viewBox,
        svg: svgBody
      });
      counts[style]++;
    });
    console.log(`  ✓ TDesign: outline=${counts.outline}, solid=${counts.solid}`);
  } catch (e) {
    console.log(`  ✗ Error downloading tdesign.json: ${e.message}`);
  }
}

async function main() {
  for (const src of sources) {
    await processSource(src);
  }
  await processSolar();
  await processBootstrap();
  await processFluent();
  await processTabler();
  await processPhosphor();
  await processMingCute();
  await processSidekick();
  await processLsicon();
  await processTDesign();

  // Summary by style
  const byStyle = allIcons.reduce((m, ic) => { m[ic.style] = (m[ic.style] || 0) + 1; return m; }, {});
  console.log('\n=== SUMMARY ===');
  Object.entries(byStyle).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log(`  ${s}: ${c}`));
  console.log(`  TOTAL: ${allIcons.length}`);

  const outputJS = `var REAL_ICONS = ${JSON.stringify(allIcons)};\n`;
  // Write to project root (where icons.html loads it from)
  const rootPath = path.join(__dirname, '..', 'real_icons_data.js');
  fs.writeFileSync(rootPath, outputJS);
  console.log(`\nSaved ${allIcons.length} icons to real_icons_data.js (root)!`);
}

main();
