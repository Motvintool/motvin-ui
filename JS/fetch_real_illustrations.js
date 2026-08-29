const fs = require("fs");
const path = require("path");
const https = require("https");

const perSourceLimit = Number.parseInt(process.env.ILLUSTRATION_LIMIT || "250", 10);
const allIllustrations = [];
const seenIds = new Set();

const sources = [
  { id: "ira", name: "IRA Design", repo: "ira-design/ira-illustrations", branch: "master", license: "MIT", author: "IRA Design" },
  { id: "flowbite", name: "Flowbite Illustrations", repo: "themesberg/flowbite-illustrations", license: "MIT", author: "Themesberg" },
  { id: "opendoodles", name: "Open Doodles", repo: "lunahq/react-open-doodles", license: "MIT", author: "Open Doodles" },
  { id: "fluentemoji", name: "Fluent Emoji", repo: "microsoft/fluentui-emoji", license: "MIT", author: "Microsoft" },
  { id: "bioicons", name: "Bioicons", repo: "duerrsimon/bioicons", license: "MIT", author: "Bioicons" },
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "motvin-illustration-importer" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(fetchText(response.headers.location));
      }
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function svgMetadata(svg) {
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const viewBox = svgTag.match(/viewBox=["']([^"']+)["']/i)?.[1] || "0 0 512 512";
  const body = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i)?.[1];
  if (!body) return null;

  return {
    viewBox,
    svg: body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/\son\w+=["'][^"']*["']/gi, ""),
  };
}

function jsxSvgMetadata(component) {
  const svg = component.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
  if (!svg) return null;
  return svgMetadata(
    svg
      .replace(/className=/g, "class=")
      .replace(/\{`([^`]*)`\}/g, '"$1"')
      .replace(/\{\"([^\"]*)\"\}/g, '"$1"')
      .replace(/\{\'([^\']*)\'\}/g, '"$1"')
      .replace(/(fill|stroke)=\{[^}]+\}/g, '$1="currentColor"')
      .replace(/(opacity|fillOpacity|strokeOpacity)=\{[^}]+\}/g, '$1="1"'),
  );
}

function isIllustrationFile(filePath) {
  const normalized = filePath.toLowerCase();
  if (!normalized.endsWith(".svg")) return false;
  return !/(^|\/)(test|tests|docs|doc|examples|example|stories|storybook|node_modules|\.github)(\/|$)/.test(normalized);
}

function isSourceAsset(source, filePath) {
  if (source.id === "ira") return /^assets\/img\/.*\.(png|jpe?g|webp)$/i.test(filePath);
  if (source.id === "opendoodles") return filePath.startsWith("src/components/") && filePath.endsWith(".tsx");
  return isIllustrationFile(filePath);
}

function categoryFor(source, filePath) {
  if (source.id === "bioicons") return "Science";
  if (source.id === "fluentemoji") return "Emoji";
  if (source.id === "opendoodles") return "Doodles";
  if (source.id === "ira") return "Composable";
  return "General";
}

async function importSource(source) {
  const branch = source.branch || (await fetchJson(`https://api.github.com/repos/${source.repo}`)).default_branch;
  const tree = await fetchJson(`https://api.github.com/repos/${source.repo}/git/trees/${branch}?recursive=1`);
  if (!Array.isArray(tree.tree)) throw new Error(`No file tree was returned for ${source.repo}@${branch}`);
  const files = tree.tree.filter((entry) => entry.type === "blob" && isSourceAsset(source, entry.path)).slice(0, perSourceLimit);
  let imported = 0;

  for (let offset = 0; offset < files.length; offset += 20) {
    const batch = files.slice(offset, offset + 20);
    await Promise.all(batch.map(async (file) => {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${source.repo}/${branch}/${file.path}`;
        const contents = source.id === "ira" ? null : await fetchText(rawUrl);
        const metadata = source.id === "ira"
          ? null
          : source.id === "opendoodles"
            ? jsxSvgMetadata(contents)
            : svgMetadata(contents);
        if (source.id !== "ira" && !metadata) return;
        const extension = path.extname(file.path);
        const fileName = path.basename(file.path, extension);
        const id = `${source.id}_${file.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
        if (seenIds.has(id)) return;
        seenIds.add(id);
        allIllustrations.push({
          id,
          name: fileName.replace(/[-_]+/g, " "),
          source: source.id,
          sourceName: source.name,
          category: categoryFor(source, file.path),
          tags: [fileName, source.name, source.id, categoryFor(source, file.path), "illustration"],
          style: "color",
          viewBox: metadata?.viewBox || "0 0 1 1",
          svg: metadata?.svg || "",
          imageUrl: source.id === "ira" || source.id === "bioicons" || source.id === "flowbite" ? rawUrl : "",
          license: source.license,
          licenseUrl: `https://github.com/${source.repo}/blob/${branch}/LICENSE`,
          author: source.author,
        });
        imported += 1;
      } catch (error) {
        // Skip individual files that are unavailable or malformed.
      }
    }));
  }

  console.log(`${source.name}: ${imported} illustrations imported`);
}

async function main() {
  if (!Number.isInteger(perSourceLimit) || perSourceLimit < 1) {
    throw new Error("ILLUSTRATION_LIMIT must be a positive integer");
  }

  for (const source of sources) {
    await importSource(source);
  }

  allIllustrations.sort((first, second) => first.name.localeCompare(second.name));
  const output = `var REAL_ILLUSTRATIONS = ${JSON.stringify(allIllustrations)};\n`;
  fs.writeFileSync(path.join(__dirname, "..", "real_illustrations_data.js"), output);
  console.log(`Saved ${allIllustrations.length} illustrations to real_illustrations_data.js`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});