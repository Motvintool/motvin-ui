/* Motvin Illustrations — Illustration Library frontend. */

// Populated from API stats (stats-bridge-illustrations.js)
let SOURCES = window.SOURCES || [];

const getTotalIllustrationCount = () =>
  (window.ILLUSTRATION_STATS && window.ILLUSTRATION_STATS.total) ||
  ICONS.length ||
  0;

function createIllustrationsArray() {
  if (
    typeof REAL_ILLUSTRATIONS === "undefined" ||
    !REAL_ILLUSTRATIONS ||
    REAL_ILLUSTRATIONS.length === 0
  ) {
    return [];
  }
  return REAL_ILLUSTRATIONS.map((ic, i) => ({
    ...ic,
    category: ic.category || "Others",
    style: ic.style || "flat",
    id: ic.id || "ic_" + i,
    sourceIconId: `${ic.source || "illustrations"}:${ic.name}`,
    license: ic.license || "Unknown",
    licenseUrl: ic.licenseUrl || "",
    author: ic.author || "",
    popularity: Math.round(1000 - i + Math.sin(i) * 200),
    createdAt: Date.now() - i * 1e5,
    updatedAt: Date.now(),
  }));
}

let ICONS = createIllustrationsArray();
// Tracks only the icons currently on screen; guarded against race conditions (see renderGrid).
let renderedIconsMap = new Map();

window.recreateIllustrations = function () {
  if (window.SOURCES && window.SOURCES.length > 0) {
    SOURCES = window.SOURCES;
  }
  ICONS = createIllustrationsArray();
  if (typeof renderFilters === "function") renderFilters();
  if (typeof buildCategoryList === "function") buildCategoryList();
};

const state = {
  query: localStorage.getItem("mill.query") || "",
  sourceFilter: new Set(
    JSON.parse(localStorage.getItem("mill.sourceFilter") || "[]"),
  ),
  sourcesVisibleCount: 5,
  styleFilter: new Set(
    JSON.parse(localStorage.getItem("mill.styleFilter") || "[]"),
  ),
  licenseFilter: new Set(
    JSON.parse(localStorage.getItem("mill.licenseFilter") || "[]"),
  ),
  categoryFilter: new Set(
    JSON.parse(localStorage.getItem("mill.categoryFilter") || "[]"),
  ),
  sort: localStorage.getItem("mill.sort") || "all",
  density: localStorage.getItem("mill.density") || "detailed",
  page: 1,
  perPage: 48,
  selected: new Set(),
  showSaved: false,
  editorIcon: null,
  editor: {
    size: 24,
    stroke: 1.75,
    color: "#0F1116",
    fillMode: "none",
    fillColor: "#0F1116",
    bg: "transparent",
    cap: "round",
    join: "round",
    pattern: "solid",
    rotation: 0,
    padding: 0,
    flip: "none",
    opacity: 100,
    shadow: 0,
    shape: "none",
    iconInset: 3,
    shapeRadius: 4,
    shapeColor: "#EEEAFB",
  },
  pngSize: 512,
  copyFmt: "svg",
  gridOn: false,
  globalStroke: parseFloat(localStorage.getItem("mill.globalStroke")) || 1.5,
  globalSize: parseInt(localStorage.getItem("mill.globalSize"), 10) || 55,
  globalColor: localStorage.getItem("mill.globalColor") || "currentColor",
  collections: JSON.parse(localStorage.getItem("mill.collections") || "[]"),
  folders: JSON.parse(localStorage.getItem("mill.folders") || "null"),
  activeFolderId: null,
};

if (!state.folders) {
  state.folders = [];
  const oldFavs = JSON.parse(localStorage.getItem("mill.favorites") || "[]");
  if (oldFavs.length > 0) {
    state.folders.push({
      id: "default",
      name: "Favorites",
      iconIds: oldFavs,
    });
  }
}
window.state = state;

// --------------------------------------------------------------------
// Utility
// --------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg) {
  if (/copied/i.test(msg)) {
    copyStackToast(msg);
    return;
  }
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-visible"), 1800);
}

function copyStackToast(message) {
  const labels = {
    "Copied SVG": "SVG copied",
    "Copied PNG image": "PNG copied",
    "SVG copied — paste in Figma with ⌘V": "SVG copied",
    "Share link copied": "Link copied",
  };
  window.StackToast?.show(labels[message] || message || "Copied to clipboard");
}

function saveLS() {
  const foldersToSave = state.folders.map((f) => ({
    id: f.id,
    name: f.name,
    iconIds: f.iconIds,
  }));
  localStorage.setItem("mill.folders", JSON.stringify(foldersToSave));
  localStorage.setItem("mill.collections", JSON.stringify(state.collections));
}

function getIconFolders(iconId) {
  return state.folders.filter((f) => f.iconIds.includes(iconId));
}

function isIconSaved(iconId) {
  return state.folders.some((f) => f.iconIds.includes(iconId));
}

function getActiveFolderIconIds() {
  if (state.activeFolderId) {
    const f = state.folders.find((x) => x.id === state.activeFolderId);
    return f ? f.iconIds : [];
  }
  const all = new Set();
  state.folders.forEach((f) => f.iconIds.forEach((id) => all.add(id)));
  return [...all];
}

function saveFiltersLS() {
  localStorage.setItem(
    "mill.sourceFilter",
    JSON.stringify([...state.sourceFilter]),
  );
  localStorage.setItem(
    "mill.styleFilter",
    JSON.stringify([...state.styleFilter]),
  );
  localStorage.setItem(
    "mill.licenseFilter",
    JSON.stringify([...state.licenseFilter]),
  );
  localStorage.setItem(
    "mill.categoryFilter",
    JSON.stringify([...state.categoryFilter]),
  );
  localStorage.setItem("mill.sort", state.sort);
  localStorage.setItem("mill.density", state.density);
}

// Map a style keyword → render options so a filtered "solid" or "duotone"
// actually looks solid or duotone, not just labeled that way.
function styleOpts(style) {
  switch (style) {
    // Solid keeps a stroke so line-based icons (menu, minus, activity, etc.)
    // remain visible — the fill covers closed shapes for a solid look.
    case "solid":
      return { cap: "round", join: "round" };
    case "duotone":
      return { cap: "round", join: "round" };
    case "bold":
      return { cap: "round", join: "round" };
    case "thin":
      return { cap: "round", join: "round" };
    case "rounded":
      return { cap: "round", join: "round" };
    default:
      return {};
  }
}

// Render an icon with its native style applied — used by the grid, similar
// row, compare modal, etc. The editor overrides via editorRenderOpts.
function nativeSvgDataUrl(icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox || "0 0 24 24"}" preserveAspectRatio="xMidYMid meet">${icon.svg}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderStyled(icon, extra = {}) {
  if (icon.imageUrl) {
    const size = extra.size || state.globalSize;
    const label = String(icon.name).replace(
      /[&"<>]/g,
      (character) =>
        ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character],
    );
    const src = icon.imageUrl || nativeSvgDataUrl(icon);
    return `<img src="${src}" alt="${label}" width="${size}" height="${size}" style="display:block;max-width:100%;object-fit:contain">`;
  }
  const gc =
    state.globalColor !== "currentColor" ? state.globalColor : undefined;
  return renderSvg(icon.svg, {
    size: state.globalSize,
    stroke: state.globalStroke,
    iconStyle: icon.style,
    sourceId: icon.source,
    ...styleOpts(icon.style),
    viewBox: icon.viewBox,
    ...(gc ? { color: gc } : {}),
    ...extra,
  });
}

function renderSvg(paths, opts = {}) {
  // Strip hardcoded stroke-width from inner paths so the wrapper stroke takes priority
  let cleanPaths = paths.replace(/stroke-width="[^"]*"/g, "");

  const size = opts.size ?? 24;
  const viewBox = opts.viewBox || "0 0 24 24";
  let stroke = opts.stroke ?? 1.75;

  // Calculate relative stroke width so the physical stroke visually matches the slider
  // regardless of how large the SVG canvas is scaled.
  const vwParts = viewBox.trim().split(/\s+/);
  const vWidth = vwParts.length >= 3 ? parseFloat(vwParts[2]) : 24;
  const scale = size / vWidth;
  const adjustedStroke = stroke / scale;

  let isFillBased = !paths.includes("stroke");
  if (
    opts.iconStyle !== "solid" &&
    opts.iconStyle !== "brands" &&
    opts.iconStyle !== "color"
  ) {
    const fillBasedSources = [
      "fontawesome",
      "material",
      "zondicons",
      "entypo",
      "typicons",
    ];
    if (!fillBasedSources.includes(opts.sourceId)) {
      isFillBased = false;
    }
  }

  if (stroke > 0 && isFillBased) {
    stroke = 0;
  }

  const color = opts.color ?? "currentColor";
  const cap = opts.cap ?? "round";
  const join = opts.join ?? "round";
  const pattern = opts.pattern ?? "solid";
  const rot = opts.rotation ?? 0;
  const flip = opts.flip ?? "none";
  const opacity = (opts.opacity ?? 100) / 100;
  const shadow = opts.shadow ?? 0;
  const shape = opts.shape ?? "none";
  const iconInset = opts.iconInset ?? 0;
  const shapeRadius = opts.shapeRadius ?? 4;
  const shapeColor = opts.shapeColor ?? "#EEEAFB";

  // Background shape fills the viewBox — explicit stroke="none" so it doesn't
  // inherit the icon's stroke.
  let bg = "";
  if (shape === "circle")
    bg = `<circle cx="12" cy="12" r="12" fill="${shapeColor}" stroke="none"/>`;
  else if (shape === "rect")
    bg = `<rect x="0" y="0" width="24" height="24" fill="${shapeColor}" stroke="none"/>`;
  else if (shape === "rounded")
    bg = `<rect x="0" y="0" width="24" height="24" rx="${shapeRadius}" ry="${shapeRadius}" fill="${shapeColor}" stroke="none"/>`;

  // Icon transform: when shape is active, scale icon down and center inside inset area
  const tf = [];
  if (shape !== "none" && iconInset > 0) {
    const scale = (24 - 2 * iconInset) / 24;
    tf.push(`translate(12 12) scale(${scale}) translate(-12 -12)`);
  }
  if (rot) tf.push(`rotate(${rot} 12 12)`);
  if (flip === "h") tf.push("scale(-1 1) translate(-24 0)");
  if (flip === "v") tf.push("scale(1 -1) translate(0 -24)");

  const dashMap = { solid: "", dashed: "3 2", dotted: "0.2 2.2" };
  const dashAttr = dashMap[pattern]
    ? ` stroke-dasharray="${dashMap[pattern]}"`
    : "";

  const filter =
    shadow > 0
      ? `<defs><filter id="mi-shd" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${shadow / 6}" stdDeviation="${shadow / 8}" flood-color="#0F1116" flood-opacity="0.25"/></filter></defs>`
      : "";

  let rootFill = opts.fillMode === "solid" ? opts.fillColor || color : "none";
  // If the icon is fill-based, it MUST have a fill to be visible, even if the UI mode isn't solid.
  if (isFillBased && opts.iconStyle !== "color") {
    rootFill = color;
  }
  const fillOpaAttr =
    opts.fillMode === "solid" && typeof opts.fillOpacity === "number"
      ? ` fill-opacity="${opts.fillOpacity}"`
      : "";
  const strokeInl =
    stroke === 0
      ? `stroke="none"`
      : `stroke="${color}" stroke-width="${adjustedStroke}" stroke-linecap="${cap}" stroke-linejoin="${join}"`;

  // Strip hardcoded presentation attributes from inner paths so we can cleanly override them.
  // We skip this for 'color' icons (like emojis) so they retain their native multi-color styles!
  if (opts.iconStyle !== "color") {
    cleanPaths = cleanPaths
      .replace(/stroke-width="[^"]*"/g, "")
      .replace(/stroke-linecap="[^"]*"/g, "")
      .replace(/stroke-linejoin="[^"]*"/g, "");

    cleanPaths = cleanPaths.replace(
      /<(path|circle|rect|polygon|polyline|line|ellipse)([^>]*)>/g,
      function (match, tag, attrs) {
        const fillMatch = attrs.match(/fill="([^"]*)"/);
        const isSelfClosing = attrs.trim().endsWith("/");
        const pureAttrs = attrs.replace(/\/$/, "");

        // Smart Stroke Logic
        let pathStroke = strokeInl;
        const strokeMatch = pureAttrs.match(/stroke="([^"]*)"/);
        if (strokeMatch) {
          const val = strokeMatch[1].toLowerCase();
          if (val === "none") {
            pathStroke = `stroke="none"`;
          } else if (val === "#fff" || val === "#ffffff" || val === "white") {
            pathStroke = strokeInl.replace(
              /stroke="[^"]+"/,
              'stroke="#ffffff"',
            );
          } else if (val === "#000" || val === "#000000" || val === "black") {
            pathStroke = strokeInl.replace(
              /stroke="[^"]+"/,
              'stroke="#000000"',
            );
          }
        } else if (!strokeMatch && isFillBased === false) {
          if (fillMatch && fillMatch[1].toLowerCase() !== "none") {
            pathStroke = `stroke="none"`;
          } else {
            pathStroke = strokeInl;
          }
        }

        // Smart Fill Logic
        let pathFill = rootFill;
        if (opts.fillMode === "solid") {
          pathFill = rootFill;
        } else if (fillMatch) {
          const val = fillMatch[1].toLowerCase();
          if (val === "none") pathFill = "none";
          else if (val === "#fff" || val === "#ffffff" || val === "white")
            pathFill = "#ffffff";
          else if (val === "#000" || val === "#000000" || val === "black")
            pathFill = "#000000";
          else pathFill = color;
        }

        let cleanAttrs = pureAttrs
          .replace(/stroke="[^"]*"/g, "")
          .replace(/fill="[^"]*"/g, "");
        const endTag = isSelfClosing ? " />" : ">";
        return `<${tag} ${cleanAttrs} fill="${pathFill}"${fillOpaAttr} ${pathStroke}${dashAttr}${endTag}`;
      },
    );
  }

  // Wrap paths in an inner SVG to map their native viewBox correctly into the 24x24 canvas.
  // Use width="100%" height="100%" so vector editors scale it properly on paste.
  const innerSvg = `<svg viewBox="${viewBox}" width="24" height="24" x="0" y="0" preserveAspectRatio="xMidYMid meet" fill-rule="evenodd" clip-rule="evenodd">${cleanPaths}</svg>`;

  const iconAttrs = `opacity="${opacity}"${shadow > 0 ? ' filter="url(#mi-shd)"' : ""}${tf.length ? ` transform="${tf.join(" ")}"` : ""}${dashAttr}`;
  const g = `<g ${iconAttrs}>${innerSvg}</g>`;
  const svgColorAttr = opts.color ? ` color="${color}"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"${svgColorAttr}>${filter}${bg}${g}</svg>`;
}

// --------------------------------------------------------------------
// Filtering & Search
// --------------------------------------------------------------------
function scoreIcon(icon, q) {
  if (!q) return icon.popularity;
  const nl = icon.name.toLowerCase();
  const ql = q.toLowerCase();
  let s = 0;
  if (nl === ql) s += 1000;
  if (nl.startsWith(ql)) s += 500;
  if (nl.includes(ql)) s += 200;
  if (icon.tags.some((t) => t.toLowerCase().includes(ql))) s += 100;
  // Synonyms
  const syn = SYNONYMS[ql] || [];
  if (syn.includes(icon.name)) s += 300;
  // Descriptive matches
  ql.split(/\s+/).forEach((word) => {
    if (nl.includes(word)) s += 40;
    if (icon.category && icon.category.toLowerCase().includes(word)) s += 20;
    if (icon.sourceName && icon.sourceName.toLowerCase().includes(word))
      s += 20;
    if (icon.source && icon.source.toLowerCase().includes(word)) s += 20;
  });

  // Exact sourceName match (e.g. typing "Myna UI Icons")
  if (icon.sourceName && icon.sourceName.toLowerCase().includes(ql)) s += 200;
  if (icon.source && icon.source.toLowerCase().includes(ql)) s += 200;
  return s;
}

function filterIcons() {
  const q = state.query.trim();
  let list = ICONS.filter((ic) => {
    if (state.showSaved) {
      if (state.activeFolderId) {
        const f = state.folders.find((x) => x.id === state.activeFolderId);
        if (!f || !f.iconIds.includes(ic.id)) return false;
      } else {
        if (!isIconSaved(ic.id)) return false;
      }
    }
    if (state.sourceFilter.size && !state.sourceFilter.has(ic.source))
      return false;
    if (state.styleFilter.size && !state.styleFilter.has(ic.style))
      return false;
    if (state.licenseFilter.size && !state.licenseFilter.has(ic.license))
      return false;
    if (state.categoryFilter.size && !state.categoryFilter.has(ic.category))
      return false;
    return true;
  });

  if (q) {
    list = list
      .map((ic) => ({ ic, s: scoreIcon(ic, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.ic);
  } else {
    if (state.sort === "popular")
      list.sort((a, b) => b.popularity - a.popularity);
    else if (state.sort === "new")
      list.sort((a, b) => b.createdAt - a.createdAt);
    else if (state.sort === "trending")
      list.sort(
        (a, b) =>
          b.popularity * Math.sin(b.id.length) -
          a.popularity * Math.sin(a.id.length),
      );
    else if (state.sort === "name-asc")
      list.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === "name-desc")
      list.sort((a, b) => b.name.localeCompare(a.name));
    else list.sort((a, b) => b.popularity - a.popularity);
  }
  return list;
}

// --------------------------------------------------------------------
// Rendering
// --------------------------------------------------------------------
function iconCard(icon) {
  const isSel = state.selected.has(icon.id);
  return `
    <div class="mi-card ${isSel ? "is-selected" : ""}" data-id="${icon.id}" role="listitem" tabindex="0">
      <div class="mi-card-cmp" data-cmp aria-label="Select for compare"></div>
      <div class="mi-card-actions">
        <button class="mi-card-act" data-act="copy" title="Copy SVG">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="mi-card-act ${isIconSaved(icon.id) ? "is-active" : ""}" data-act="save" title="Save">
          <svg viewBox="0 0 24 24" fill="${isIconSaved(icon.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <div class="mi-card-preview">${renderStyled(icon)}</div>
      <div class="mi-card-name" title="${icon.name}">${icon.name}</div>
      <div class="mi-card-source">${icon.sourceName}</div>
    </div>
  `;
}

const ITEMS_PER_PAGE = 60;
let currentRenderId = 0;

async function renderGrid() {
  const renderId = ++currentRenderId;
  saveFiltersLS();

  if (typeof window.populateIllustrationsFromAPI === "function") {
    const grid = $("#icon-grid");
    grid.className = `mi-grid density-${state.density}`;
    const resultsCountEl = $("#results-count");
    if (resultsCountEl) resultsCountEl.classList.add("mi-skeleton");
    grid.innerHTML = Array.from(
      { length: 48 },
      () =>
        `<div class="mi-card" style="min-height:120px;animation:skeleton-pulse 1.5s ease-in-out infinite;pointer-events:none;"></div>`,
    ).join("");

    try {
      const total = await window.populateIllustrationsFromAPI();
      if (renderId !== currentRenderId) return;
      const list = filterIcons();
      renderedIconsMap = new Map(list.map((ic) => [ic.id, ic]));
      renderGridContent(list, list.length, total);
    } catch (error) {
      console.error(
        "[renderGrid] Error loading illustrations from API:",
        error,
      );
      grid.innerHTML = `<div class="mi-empty"><h3>Failed to load illustrations</h3><p>${error.message}</p></div>`;
    }
    return;
  }

  // Fallback: filter local ICONS array
  const list = filterIcons();
  renderGridContent(list, list.length, list.length);
}

function renderGridContent(list, displayTotal, apiTotal) {
  const total = displayTotal;
  const grid = $("#icon-grid");
  grid.className = `mi-grid density-${state.density}`;

  if (!total) {
    grid.innerHTML = state.showSaved
      ? `<div class="mi-empty"><h3>No illustrations are saved</h3><p>Create a collection to see saved illustrations.</p></div>`
      : `<div class="mi-empty"><h3>No illustrations found</h3><p>Try clearing filters or a different search.</p></div>`;
    const pw = $("#pagination-wrapper");
    if (pw) pw.style.display = "none";
  } else {
    const totalPages = Math.ceil(apiTotal / ITEMS_PER_PAGE);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    localStorage.setItem("mill.page", state.page);

    // When using API loader the list is already paginated; fallback slices locally
    const paginatedList =
      typeof window.populateIllustrationsFromAPI === "function"
        ? list
        : list.slice(
            (state.page - 1) * ITEMS_PER_PAGE,
            state.page * ITEMS_PER_PAGE,
          );

    grid.innerHTML = paginatedList.map(iconCard).join("");
    renderPagination(apiTotal, totalPages);
  }

  const resultsCountEl = $("#results-count");
  if (resultsCountEl) {
    resultsCountEl.textContent = (apiTotal || total).toLocaleString();
    resultsCountEl.classList.remove("mi-skeleton");
  }
  $("#results-query").textContent = state.query ? `for "${state.query}"` : "";

  const strokeSection = $("#rp-stroke-section");
  const strokeDivider = $("#rp-stroke-divider");
  if (strokeSection) {
    const showStroke = list.some(
      (ic) =>
        (ic.style === "outline" || ic.style === "thin") &&
        ic.svg?.includes("stroke="),
    );
    strokeSection.style.display = showStroke ? "" : "none";
    if (strokeDivider) strokeDivider.style.display = showStroke ? "" : "none";
  }
}

function renderPagination(total, totalPages) {
  window.Pagination.render({
    page: state.page,
    totalPages,
    onPageChange(nextPage) {
      state.page = nextPage;
      renderGrid();
      $(".mi-main").scrollTop = 0;
    },
  });
}

function renderFilters() {
  const getSourceIcon = (label) => {
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel.includes("hero")) return "Heroicons.svg";
    if (normalizedLabel.includes("lucide")) return "Lucide.svg";
    if (normalizedLabel.includes("simple")) return "icons-brand.svg";
    if (normalizedLabel.includes("phosphor")) return "Phosphor.svg";
    if (normalizedLabel.includes("tabler")) return "Tabler Icons.svg";
    return null;
  };

  // Sources (Checkbox style)
  const buildSourceList = (containerId, items, setKey) => {
    const set = state[setKey];
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = items
      .map((it) => {
        const active = set.has(it.value);
        const icon = it.icon || "icons-basic.svg";

        return `
      <div class="mi-rp-item ${active ? "is-active" : ""}" data-val="${it.value}" style="cursor:pointer">
        <div class="mi-rp-check-custom"></div>
        <div class="mi-rp-item-label">
          ${setKey !== "licenseFilter" ? `<img src="ASSET/Icons/${icon}" alt=""/>` : ""}
          <span>${it.label}</span>
        </div>
        <span class="mi-rp-badge">${it.count}</span>
      </div>
    `;
      })
      .join("");

    if (!el._miWired) {
      el._miWired = true;
      el.addEventListener("click", (e) => {
        const item = e.target.closest(".mi-rp-item");
        if (!item) return;

        // FLIP: First
        const oldRects = new Map();
        el.querySelectorAll(".mi-rp-item").forEach((node) => {
          oldRects.set(node.dataset.val, node.getBoundingClientRect());
        });

        const v = item.dataset.val;
        if (set.has(v)) set.delete(v);
        else set.add(v);
        if (setKey === "sourceFilter" && state.styleFilter.size > 0) {
          const supportedStyles = new Set(
            [...state.sourceFilter]
              .flatMap((sourceId) => {
                const source = SOURCES.find((entry) => entry.id === sourceId);
                return source?.styles || [];
              })
              .map((style) => style.toLowerCase()),
          );
          if (supportedStyles.size > 0) {
            state.styleFilter.forEach((style) => {
              if (!supportedStyles.has(style)) state.styleFilter.delete(style);
            });
          }
        }
        state.page = 1;
        localStorage.setItem("mill.page", state.page);
        renderGrid();
        renderFilters();

        // FLIP: Last, Invert, Play
        el.querySelectorAll(".mi-rp-item").forEach((node) => {
          const oldRect = oldRects.get(node.dataset.val);
          if (oldRect) {
            const newRect = node.getBoundingClientRect();
            const deltaY = oldRect.top - newRect.top;
            if (deltaY !== 0) {
              node.style.transition = "none";
              node.style.transform = `translateY(${deltaY}px)`;
              // Force reflow
              node.offsetHeight;
              node.style.transition = "transform 0.3s ease";
              node.style.transform = "";
            }
          }
        });
      });
    }
  };

  // Styles (Pill style)
  const buildStyleList = (containerId, items, setKey) => {
    const set = state[setKey];
    const el = $(containerId);
    if (!el) return;
    const visibleItems = items.filter(
      (it) => it.count > 0 || set.has(it.value),
    );
    el.innerHTML = visibleItems
      .map((it) => {
        const active = set.has(it.value);
        let icon = "icons-basic.svg";
        if (it.label.toLowerCase().includes("duotone solid"))
          icon = "icons-duotone-solid.svg";
        else if (it.label.toLowerCase().includes("duotone"))
          icon = "icons-duotone.svg";
        else if (
          it.label.toLowerCase().includes("filled") ||
          it.label.toLowerCase().includes("solid")
        )
          icon = "icons-filled.svg";
        else if (
          it.label.toLowerCase().includes("brands") ||
          it.label.toLowerCase().includes("bold") ||
          it.label.toLowerCase() === "default"
        )
          icon = "icons-brand.svg";

        return `
      <div class="mi-rp-style-item ${active ? "is-active" : ""}" data-val="${it.value}" style="cursor:pointer">
        <div class="mi-rp-style-icon"><img src="ASSET/Icons/${icon}" alt=""/></div>
        <span>${it.label}</span>
      </div>
    `;
      })
      .join("");

    if (!el._miWired) {
      el._miWired = true;
      el.addEventListener("click", (e) => {
        const item = e.target.closest(".mi-rp-style-item");
        if (!item) return;
        const v = item.dataset.val;
        // Toggle: clicking active style clears filter
        if (set.has(v)) set.delete(v);
        else {
          set.clear();
          set.add(v);
        }
        state.page = 1;
        localStorage.setItem("mill.page", state.page);
        renderGrid();
        renderFilters();
      });
    }
  };

  // Generic List (e.g. License)
  const buildGenericList = (containerId, items, setKey) => {
    const set = state[setKey];
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = items
      .map((it) => {
        const active = set.has(it.value);
        return `
      <div class="mi-rp-item ${active ? "is-active" : ""}" data-val="${it.value}" style="cursor:pointer">
        <div class="mi-rp-check-custom"></div>
        <span class="mi-rp-item-text">${it.label}</span>
        <img class="mi-rp-chevron" src="ASSET/Icons/icons-navigate.svg" alt=""/>
      </div>
    `;
      })
      .join("");

    if (!el._miWired) {
      el._miWired = true;
      el.addEventListener("click", (e) => {
        const item = e.target.closest(".mi-rp-item");
        if (!item) return;
        const v = item.dataset.val;
        if (set.has(v)) set.delete(v);
        else set.add(v);
        state.page = 1;
        localStorage.setItem("mill.page", state.page);
        renderGrid();
        renderFilters();
      });
    }
  };

  const countBy = (key) => {
    if (window.ILLUSTRATION_STATS && window.getIllustrationFilterCounts) {
      return window.getIllustrationFilterCounts(key);
    }
    return ICONS.reduce(
      (m, ic) => ((m[ic[key]] = (m[ic[key]] || 0) + 1), m),
      {},
    );
  };
  const sc = countBy("source"),
    st = countBy("style"),
    lc = countBy("license"),
    cat = countBy("category");

  const fmtNum = (n) => (n || 0).toLocaleString();

  const allSourcesRaw = SOURCES.map((s) => ({
    value: s.id,
    label: s.name,
    count: fmtNum(sc[s.id] || 0),
    icon: getSourceIcon(s.name),
  }));
  const selectedSourceVals = Array.from(state.sourceFilter).reverse();
  const selectedSources = selectedSourceVals
    .map((val) => allSourcesRaw.find((s) => s.value === val))
    .filter(Boolean);
  const unselectedSources = allSourcesRaw
    .filter((s) => !state.sourceFilter.has(s.value))
    .sort((a, b) => Number(Boolean(b.icon)) - Number(Boolean(a.icon)));
  const allSources = [...selectedSources, ...unselectedSources];

  const visibleSources = allSources.slice(0, state.sourcesVisibleCount);
  buildSourceList("#filter-source", visibleSources, "sourceFilter");

  const moreBtn = $("#source-more-btn");
  if (moreBtn) {
    if (allSources.length > 5) {
      moreBtn.style.display = "";
      const isEnd = state.sourcesVisibleCount >= allSources.length;
      const remaining = allSources.length - state.sourcesVisibleCount;
      const moreBtnSpan = moreBtn.querySelector("span");
      moreBtnSpan.textContent = isEnd
        ? "Show less"
        : `+${remaining} more sources`;
      moreBtnSpan.classList.remove("mi-skeleton");

      const sourceList = $("#filter-source");
      const searchWrapper = $("#source-search-wrapper");

      if (isEnd && allSources.length > 5) {
        sourceList.classList.add("is-scrollable");
      } else {
        sourceList.classList.remove("is-scrollable");
      }

      if (searchWrapper && !searchWrapper._miWired) {
        searchWrapper._miWired = true;
        const searchInput = $("#source-search-input");
        const searchClear = $("#source-search-clear");

        if (searchInput) {
          // Auto-expand sources list when clicking into search
          searchInput.addEventListener("focus", () => {
            if (state.sourcesVisibleCount < allSources.length) {
              state.sourcesVisibleCount = allSources.length;
              renderFilters(); // Re-render to populate DOM with all sources
            }
          });

          searchInput.addEventListener("input", (e) => {
            const val = e.target.value.toLowerCase();
            const searchIcon = $("#source-search-icon");

            if (val) {
              searchInput.classList.add("has-text");
              if (searchIcon) searchIcon.classList.add("is-hidden");
              if (searchClear) searchClear.style.display = "block";
            } else {
              searchInput.classList.remove("has-text");
              if (searchIcon) searchIcon.classList.remove("is-hidden");
              if (searchClear) searchClear.style.display = "none";
            }

            // re-fetch items because DOM might have rebuilt
            const items = $("#filter-source").querySelectorAll(".mi-rp-item");
            items.forEach((item) => {
              const labelEl = item.querySelector(".mi-rp-item-label span");
              if (!labelEl) return;
              const text = labelEl.textContent.toLowerCase();
              item.style.display = text.includes(val) ? "" : "none";
            });
          });

          if (searchClear) {
            searchClear.addEventListener("click", () => {
              searchInput.value = "";
              searchInput.dispatchEvent(new Event("input"));
            });
          }
        }
      }

      if (!moreBtn._miWired) {
        moreBtn._miWired = true;
        moreBtn.addEventListener("click", () => {
          if (state.sourcesVisibleCount >= allSources.length) {
            state.sourcesVisibleCount = 5;
            // Clear search when collapsing
            const sInput = $("#source-search-input");
            if (sInput) {
              sInput.value = "";
              sInput.dispatchEvent(new Event("input"));
            }
          } else {
            state.sourcesVisibleCount = allSources.length;
          }
          renderFilters();
        });
      }
    } else {
      moreBtn.style.display = "none";
    }
  }

  const allStyles = Object.keys(st).filter((style) => st[style] > 0);
  let activeStylesList = allStyles;
  if (state.sourceFilter.size > 0) {
    const supportedStyles = new Set();
    state.sourceFilter.forEach((sourceId) => {
      const source = SOURCES.find((entry) => entry.id === sourceId);
      source?.styles?.forEach((style) =>
        supportedStyles.add(style.toLowerCase()),
      );
    });
    activeStylesList = allStyles.filter((style) => supportedStyles.has(style));
  }

  buildStyleList(
    "#filter-style",
    activeStylesList.map((s) => ({
      value: s,
      label: s[0].toUpperCase() + s.slice(1),
      count: st[s] || 0,
    })),
    "styleFilter",
  );
  buildSourceList(
    "#filter-license",
    [...new Set(SOURCES.map((s) => s.license))].map((l) => ({
      value: l,
      label: l,
      count: lc[l] || 0,
    })),
    "licenseFilter",
  );

  const licenseClearBtn = $("#clear-filters");
  if (licenseClearBtn) {
    if (state.licenseFilter.size > 0) {
      licenseClearBtn.classList.add("has-filters");
      licenseClearBtn.title = "Clear license filters";
    } else {
      licenseClearBtn.classList.remove("has-filters");
      licenseClearBtn.title = "Clear all filters";
    }
  }

  // Update Source All section dynamically based on selected sources
  const sourceAllTitle = document.querySelector(".mi-rp-all-title");
  const sourceAllAvatars = document.querySelector(".mi-rp-avatars");
  const badgeLg = document.querySelector(".mi-rp-badge-lg");
  const sourceAllContainer = document.querySelector(".mi-rp-source-all");

  if (sourceAllTitle && sourceAllAvatars && badgeLg) {
    if (sourceAllContainer && !sourceAllContainer._miWired) {
      sourceAllContainer._miWired = true;
      sourceAllContainer.addEventListener("click", () => {
        if (state.sourceFilter.size > 0) {
          state.sourceFilter.clear(); // Clear filters
          state.page = 1;
          localStorage.setItem("mill.page", state.page);
          renderGrid();
          renderFilters();
        }
      });
    }

    if (state.sourceFilter.size === 0) {
      sourceAllContainer.classList.remove("has-filters");
      sourceAllContainer.title = `Showing all sources: ${SOURCES.map((source) => source.name).join(", ")}`;
      sourceAllAvatars.innerHTML = `
        <div class="mi-rp-avatar" style="z-index: 3"><img src="ASSET/Icons/icons-brand.svg" alt=""/></div>
        <div class="mi-rp-avatar" style="z-index: 2; margin-left: -6px"><img src="ASSET/Icons/icons-basic.svg" alt=""/></div>
        <div class="mi-rp-avatar" style="z-index: 1; margin-left: -6px"><img src="ASSET/Icons/icons-filled.svg" alt=""/></div>
      `;
      sourceAllTitle.textContent = "All Sources";
      const totalIllustrations = window.ILLUSTRATION_STATS
        ? window.ILLUSTRATION_STATS.collections.reduce(
            (sum, c) => sum + c.total,
            0,
          )
        : ICONS.length;
      badgeLg.textContent = totalIllustrations.toLocaleString();
    } else {
      sourceAllContainer.classList.add("has-filters");
      sourceAllContainer.title = "Click to clear filters";
      const selectedSources = SOURCES.filter((s) =>
        state.sourceFilter.has(s.id),
      );
      const names = selectedSources.map((s) => s.name);

      const getSourceIcon = (label) => {
        let icon = "icons-basic.svg";
        const low = label.toLowerCase();
        if (
          low.includes("brand") ||
          low.includes("logo") ||
          low.includes("icon")
        )
          icon = "icons-brand.svg";
        return icon;
      };

      let avatarsHtml = "";
      selectedSources.slice(0, 3).forEach((s, idx) => {
        const z = 3 - idx;
        const ml = idx > 0 ? "margin-left: -6px;" : "";
        const iconSrc = getSourceIcon(s.name);
        avatarsHtml += `<div class="mi-rp-avatar" style="z-index: ${z}; ${ml}"><img src="ASSET/Icons/${iconSrc}" alt=""/></div>`;
      });

      sourceAllAvatars.innerHTML = avatarsHtml;
      sourceAllTitle.innerHTML = `<span class="mi-rp-title-text">${names.join(", ")}</span><span class="mi-rp-title-hover">Clear Filters</span>`;

      const sum = selectedSources.reduce((acc, s) => acc + (sc[s.id] || 0), 0);
      badgeLg.textContent = sum.toLocaleString();
    }
  }

  updateFilterBadge();
}

function updateFilterBadge() {
  const badge = $("#filter-badge");
  if (!badge) return;

  const count =
    state.sourceFilter.size + state.styleFilter.size + state.licenseFilter.size;

  if (count > 0) {
    badge.textContent = count;
    badge.hidden = false;

    // Build tooltip showing active filters
    const filterLines = [];

    // Add source filter names
    if (state.sourceFilter.size > 0) {
      const sourceNames = SOURCES.filter((s) =>
        state.sourceFilter.has(s.id),
      ).map((s) => s.name);
      if (sourceNames.length > 0) {
        filterLines.push("Sources: " + sourceNames.join(", "));
      }
    }

    // Add style filter names
    if (state.styleFilter.size > 0) {
      const styleNames = [...state.styleFilter].map(
        (s) => s[0].toUpperCase() + s.slice(1),
      );
      filterLines.push("Styles: " + styleNames.join(", "));
    }

    // Add license filter names
    if (state.licenseFilter.size > 0) {
      const licenseNames = [...state.licenseFilter];
      filterLines.push("Licenses: " + licenseNames.join(", "));
    }

    // Set tooltip attributes - use bullet points for better readability
    const tooltipText = filterLines.map((part) => "• " + part).join(" ");
    badge.setAttribute("data-tooltip", tooltipText);
    badge.setAttribute("data-tooltip-position", "bottom");
    badge.setAttribute("data-tooltip-color", "black");
    badge.setAttribute("data-tooltip-size", "large");

    // Refresh tooltip bindings if controller exists
    if (window.tooltipController) {
      window.tooltipController.refresh(badge);
    }
  } else {
    badge.hidden = true;
    badge.removeAttribute("data-tooltip");
  }
}

function renderCompareCount() {
  const btn = $("#compare-btn");
  const badge = $("#compare-count");
  badge.textContent = state.selected.size;
  btn.disabled = state.selected.size < 2;
}

// --------------------------------------------------------------------
// Editor / Detail modal
// --------------------------------------------------------------------
const DEFAULT_EDITOR = {
  size: 55,
  stroke: 1.75,
  color: "#0F1116",
  fillMode: "none",
  fillColor: "#0F1116",
  bg: "#FFFFFF",
  cap: "round",
  join: "round",
  pattern: "solid",
  rotation: 0,
  padding: 0,
  flip: "none",
  opacity: 100,
  shadow: 0,
  shape: "none",
  iconInset: 3,
  shapeRadius: 4,
  shapeColor: "#EEEAFB",
};

let editorBaseline = { ...DEFAULT_EDITOR };

function updateResetButton() {
  const resetButton = $("#btn-reset");
  if (!resetButton) return;
  resetButton.hidden = Object.keys(editorBaseline).every(
    (key) => state.editor[key] === editorBaseline[key],
  );
}

const PRESETS = {
  default: { ...DEFAULT_EDITOR },
  flat: {
    stroke: 2,
    cap: "butt",
    join: "miter",
    pattern: "solid",
    shape: "rounded",
    shapeRadius: 3,
    shapeColor: "#EEEAFB",
    iconInset: 4,
    opacity: 100,
    shadow: 0,
  },
  soft: {
    stroke: 1.5,
    cap: "round",
    join: "round",
    pattern: "solid",
    shape: "rounded",
    shapeRadius: 8,
    shapeColor: "#F5F5F7",
    iconInset: 4,
    opacity: 100,
    shadow: 4,
  },
  bold: {
    stroke: 2.75,
    cap: "round",
    join: "round",
    pattern: "solid",
    shape: "circle",
    shapeColor: "#0F1116",
    color: "#FFFFFF",
    iconInset: 5,
    opacity: 100,
    shadow: 0,
  },
  glass: {
    stroke: 1.5,
    cap: "round",
    join: "round",
    pattern: "solid",
    shape: "rounded",
    shapeRadius: 6,
    shapeColor: "#EEEAFB",
    color: "#5C4AE4",
    iconInset: 4,
    opacity: 90,
    shadow: 6,
  },
  neumorphic: {
    stroke: 1.75,
    cap: "round",
    join: "round",
    pattern: "solid",
    shape: "rounded",
    shapeRadius: 6,
    shapeColor: "#F5F5F7",
    color: "#5C4AE4",
    iconInset: 4,
    opacity: 100,
    shadow: 10,
  },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(state.editor, DEFAULT_EDITOR, p);
  syncEditorControls();
  renderCanvas();
  $$(".mi-presets button").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.preset === name),
  );
}

function updateBreadcrumbs(icon) {
  $("#crumb-name").textContent = icon.name;
  const catLink = $("#crumb-category");
  catLink.textContent = icon.category[0].toUpperCase() + icon.category.slice(1);
  catLink.dataset.category = icon.category;
}

function setFullPage(on, iconId) {
  document.body.classList.toggle("mi-full", on);
  const url = new URL(window.location.href);
  if (on && iconId) {
    url.searchParams.set("icon", iconId);
    history.replaceState({}, "", url);
  } else {
    url.searchParams.delete("icon");
    history.replaceState({}, "", url);
  }
}

function renderTagsRow(icon) {
  const tagsRow = $("#tags-row");
  if (!tagsRow) return;
  const tags = [...new Set([icon.category, icon.style, ...icon.tags])].slice(
    0,
    8,
  );
  tagsRow.innerHTML = tags
    .map((t) => `<button class="mi-tag-chip" data-tag="${t}">${t}</button>`)
    .join("");
}

function scrollDetailModalToTop() {
  const modal = $("#detail-modal");
  const startScrollTop = modal.scrollTop;
  if (!startScrollTop) return;

  if (modal._scrollAnimation) cancelAnimationFrame(modal._scrollAnimation);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    modal.scrollTop = 0;
    return;
  }

  const duration = 850;
  const startTime = performance.now();
  const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

  const animate = (currentTime) => {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    modal.scrollTop = startScrollTop * (1 - easeOutCubic(progress));
    if (progress < 1) {
      modal._scrollAnimation = requestAnimationFrame(animate);
    } else {
      modal._scrollAnimation = null;
    }
  };

  modal._scrollAnimation = requestAnimationFrame(animate);
}

function openDetail(icon) {
  state.editorIcon = icon;
  updateBreadcrumbs(icon);
  renderTagsRow(icon);
  // Mutate existing object so closures in wire() keep referencing the live editor state
  Object.assign(state.editor, DEFAULT_EDITOR, styleOpts(icon.style));
  // Carry global grid color, size, and stroke into the editor so the modal opens with the same settings
  if (state.globalColor && state.globalColor !== "currentColor") {
    state.editor.color = state.globalColor;
  }
  if (state.globalSize) {
    state.editor.size = state.globalSize;
  }
  if (state.globalStroke) {
    state.editor.stroke = state.globalStroke;
  }
  editorBaseline = { ...state.editor };
  syncEditorControls();
  renderCanvas();
  renderSimilar();
  renderMatchingIcons();
  const sourceObj =
    window.ILLUSTRATION_STATS?.collections?.find(
      (source) => source.id === icon.source,
    ) || SOURCES.find((source) => source.id === icon.source);
  const sourceName = sourceObj?.name || icon.sourceName || icon.source;
  const license = sourceObj?.license || icon.license || "Unknown";
  $("#detail-name").textContent = icon.name;
  $("#detail-source").textContent = sourceName;
  $("#detail-license").textContent = license;
  $("#attr-source").textContent = sourceName;
  $("#attr-license").textContent = license;
  if (sourceObj && sourceObj.licenseUrl) {
    $("#attr-license-link").href = sourceObj.licenseUrl;
  } else {
    $("#attr-license-link").removeAttribute("href");
  }

  let attrText = "Required";
  let commText = "Allowed";
  const l = license.toLowerCase();
  if (l.includes("cc0") || l === "free" || l === "wtfpl") {
    attrText = "Not required";
  } else if (
    l.includes("mit") ||
    l.includes("isc") ||
    l.includes("apache") ||
    l.includes("ofl") ||
    l.includes("zlib")
  ) {
    attrText = "Required (in source)";
  }
  if (
    l.includes("nc") ||
    l.includes("non-commercial") ||
    l.includes("noncommercial")
  ) {
    commText = "Not allowed";
  }

  if ($("#attr-attribution")) $("#attr-attribution").textContent = attrText;
  if ($("#attr-commercial")) $("#attr-commercial").textContent = commText;
  if ($("#attr-author")) $("#attr-author").textContent = icon.author;
  const detailModal = $("#detail-modal");
  detailModal.classList.add("is-open");
  updateEditModalSaveState();
  scrollDetailModalToTop();
  document.body.style.overflow = "hidden";
}

function navigateDetail(offset) {
  const currentIndex = ICONS.findIndex(
    (icon) => icon.id === state.editorIcon?.id,
  );
  if (currentIndex === -1) return;
  const nextIndex = (currentIndex + offset + ICONS.length) % ICONS.length;
  openDetail(ICONS[nextIndex]);
}

function closeModals() {
  $$(".mi-modal").forEach((m) => m.classList.remove("is-open"));
  document.body.style.overflow = "";
  if (document.body.classList.contains("mi-full")) setFullPage(false);
}

function syncSliderVisual(id) {
  const inp = $("#" + id);
  if (!inp) return;
  const fill = $("#" + id + "-fill");
  const thumb = $("#" + id + "-thumb");
  if (!fill && !thumb) return;
  const pct = ((+inp.value - +inp.min) / (+inp.max - +inp.min)) * 100;
  const pctStr = pct.toFixed(2) + "%";
  if (fill) fill.style.width = pctStr;
  if (thumb) thumb.style.left = pctStr;
}

function syncEditorControls() {
  const e = state.editor;
  $("#ctrl-size").value = e.size;
  $("#size-val").textContent = e.size;
  syncSliderVisual("ctrl-size");
  $("#ctrl-stroke").value = e.stroke;
  $("#stroke-val").textContent = e.stroke;
  syncSliderVisual("ctrl-stroke");
  $$("[data-size]").forEach((b) =>
    b.classList.toggle("is-active", +b.dataset.size === e.size),
  );
  $$("[data-stroke]").forEach((b) =>
    b.classList.toggle("is-active", +b.dataset.stroke === e.stroke),
  );

  // Hide stroke controls completely on the Logos page
  const strokeGrp = $("#grp-stroke-mode");
  if (strokeGrp) strokeGrp.style.display = "none";
  const strokeSec = $("#grp-stroke-section");
  if (strokeSec) strokeSec.style.display = "none";
  const strokeDiv = $("#grp-stroke-divider");
  if (strokeDiv) strokeDiv.style.display = "none";

  // Solid illustrations use a single editable color; source-color artwork retains its original palette.
  const colorGrp = $("#grp-color-mode");
  if (colorGrp)
    colorGrp.style.display = state.editorIcon?.style === "solid" ? "" : "none";

  $("#ctrl-color").value = e.color;
  $("#ctrl-color-hex").value = e.color;
  $("#ctrl-rot").value = e.rotation;
  $("#rot-val").textContent = e.rotation + "°";
  syncSliderVisual("ctrl-rot");
  $("#ctrl-pad").value = e.padding;
  $("#pad-val").textContent = e.padding;
  syncSliderVisual("ctrl-pad");
  $("#ctrl-opa").value = e.opacity;
  $("#opa-val").textContent = e.opacity + "%";
  syncSliderVisual("ctrl-opa");
  $("#ctrl-shd").value = e.shadow;
  $("#shd-val").textContent = e.shadow;
  syncSliderVisual("ctrl-shd");
  $("#ctrl-icon-inset").value = e.iconInset;
  $("#icon-inset-val").textContent = e.iconInset;
  syncSliderVisual("ctrl-icon-inset");
  $("#ctrl-shape-radius").value = e.shapeRadius;
  $("#shape-radius-val").textContent = e.shapeRadius;
  syncSliderVisual("ctrl-shape-radius");
  $("#ctrl-shape-color").value = e.shapeColor;
  $("#ctrl-shape-color-hex").value = e.shapeColor;
  $("#ctrl-fill-color").value = e.fillColor;
  $("#ctrl-fill-color-hex").value = e.fillColor;
  $$("[data-fill]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.fill === e.fillMode),
  );
  const fillGrp = $("#grp-fill-mode");
  if (fillGrp) fillGrp.style.display = "none";
  const fillColorGrp = $("#grp-fill-color");
  if (fillColorGrp)
    fillColorGrp.style.display = e.fillMode === "solid" ? "flex" : "none";
  $$("[data-cap]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.cap === e.cap),
  );
  $$("[data-join]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.join === e.join),
  );
  $$("[data-pattern]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.pattern === e.pattern),
  );
  $$("[data-flip]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.flip === e.flip),
  );
  $("#ctrl-bg").value = e.bg === "transparent" ? "#FFFFFF" : e.bg;
  $("#ctrl-bg-hex").value = e.bg === "transparent" ? "#FFFFFF" : e.bg;
  $$("[data-bg]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.bg === e.bg),
  );
  $$("[data-color]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.color === e.color),
  );
  $$("[data-shape]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.shape === e.shape),
  );
  updateShapeControlsVisibility();
}

function updateShapeControlsVisibility() {
  const e = state.editor;
  const hasShape = e.shape !== "none";
  const isRounded = e.shape === "rounded";
  const iconInsetGrp = $("#grp-icon-inset");
  if (iconInsetGrp) iconInsetGrp.style.display = hasShape ? "" : "none";
  const shapeColorGrp = $("#grp-shape-color");
  if (shapeColorGrp) shapeColorGrp.style.display = hasShape ? "" : "none";
  const shapeRadiusGrp = $("#grp-shape-radius");
  if (shapeRadiusGrp) shapeRadiusGrp.style.display = isRounded ? "" : "none";
}

function editorRenderOpts(sizeOverride) {
  const e = state.editor;
  return {
    viewBox: state.editorIcon?.viewBox,
    iconStyle: state.editorIcon?.style,
    size: sizeOverride ?? e.size,
    stroke: e.stroke,
    color: e.color,
    cap: e.cap,
    join: e.join,
    pattern: e.pattern,
    fillMode: e.fillMode,
    fillColor: e.fillColor,
    rotation: e.rotation,
    flip: e.flip,
    opacity: e.opacity,
    shadow: e.shadow,
    shape: e.shape,
    iconInset: e.iconInset,
    shapeRadius: e.shapeRadius,
    shapeColor: e.shapeColor,
  };
}

function renderCanvas() {
  if (!state.editorIcon) return;
  updateResetButton();
  const e = state.editor;
  // Scale visual preview more aggressively than export size so the icon fills the canvas nicely.
  const visualSize = Math.max(96, Math.min(e.size * 8, 280));
  const inner = $("#canvas-inner");
  if (state.editorIcon.imageUrl) {
    const src = state.editorIcon.imageUrl || nativeSvgDataUrl(state.editorIcon);
    inner.innerHTML = `<img src="${src}" alt="${String(state.editorIcon.name).replace(/[&"<>]/g, (character) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character])}" style="display:block;width:${visualSize}px;height:${visualSize}px;max-width:100%;object-fit:contain">`;
  } else {
    inner.innerHTML = renderSvg(state.editorIcon.svg, editorRenderOpts());
    const svgEl = inner.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("width", visualSize);
      svgEl.setAttribute("height", visualSize);
    }
  }
  inner.style.padding = e.padding + "px";

  const canvas = $("#canvas");
  const canvasGrid = $(".mi-new-canvas-grid");
  if (e.bg === "transparent") {
    canvas.style.backgroundColor = "";
    canvas.style.backgroundImage = "";
    canvas.style.background = "";
    canvas.style.backgroundSize = "20px 20px";
    canvas.style.backgroundImage =
      "linear-gradient(45deg, #F5F5F7 25%, transparent 25%),linear-gradient(-45deg, #F5F5F7 25%, transparent 25%),linear-gradient(45deg, transparent 75%, #F5F5F7 75%),linear-gradient(-45deg, transparent 75%, #F5F5F7 75%)";
    canvas.style.backgroundPosition = "0 0, 0 10px, 10px -10px, -10px 0";
    canvas.style.backgroundColor = "#fff";
    if (canvasGrid)
      canvasGrid.style.setProperty("--canvas-grid-color", "transparent");
  } else {
    canvas.style.backgroundImage = "none";
    canvas.style.backgroundColor = e.bg;
    if (canvasGrid) {
      let hex = e.bg.replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      const r = parseInt(hex.substring(0, 2), 16) || 255;
      const g = parseInt(hex.substring(2, 4), 16) || 255;
      const b = parseInt(hex.substring(4, 6), 16) || 255;
      const isDark = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
      canvasGrid.style.setProperty(
        "--canvas-grid-color",
        isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 17, 22, 0.08)",
      );
    }
  }

  updateCodePreview();
}

function renderSimilar() {
  const ic = state.editorIcon;
  if (!ic) return;
  // Find similar: same category first, then same name across sources
  const others = ICONS.filter((x) => x.id !== ic.id);
  const scored = others
    .map((x) => {
      let s = 0;
      if (x.name === ic.name) s += 100;
      if (x.category === ic.category) s += 40;
      if (x.style === ic.style) s += 20;
      x.tags.forEach((t) => {
        if (ic.tags.includes(t)) s += 4;
      });
      return { x, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);

  $("#similar-row").innerHTML = scored
    .map(({ x, s }) => {
      const pct = Math.min(99, 70 + Math.round(s / 3));
      return `<div class="mi-similar-item" data-id="${x.id}" title="${x.name} — ${x.sourceName}">
      ${renderStyled(x, { size: 24, color: "#0F1116" })}
      <span class="mi-similar-match">${pct}%</span>
    </div>`;
    })
    .join("");
}

function renderMatchingIcons() {
  const icon = state.editorIcon;
  const grid = $("#matching-icons-grid");
  if (!icon || !grid) return;

  const query = (state.query.trim() || icon.name).toLowerCase();
  const terms = query.split(/[\s_-]+/).filter(Boolean);
  const matches = ICONS.filter((candidate) => candidate.id !== icon.id)
    .map((candidate) => {
      const name = candidate.name.toLowerCase();
      const tags = (candidate.tags || []).map((tag) => tag.toLowerCase());
      let score = candidate.name === icon.name ? 1000 : 0;

      terms.forEach((term) => {
        if (name === term) score += 500;
        else if (name.startsWith(term)) score += 200;
        else if (name.includes(term)) score += 100;
        if (tags.some((tag) => tag.includes(term))) score += 60;
      });
      if (candidate.category === icon.category) score += 40;
      if (candidate.style === icon.style) score += 20;
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.candidate.popularity - a.candidate.popularity,
    )
    .slice(0, 18)
    .map(({ candidate }) => candidate);

  $("#matching-icons-title").textContent = `More icons matching "${query}"`;
  grid.innerHTML = matches
    .map(
      (candidate) => `
    <button class="mi-card" type="button" data-id="${candidate.id}" title="${candidate.name} - ${candidate.sourceName}">
      <span class="mi-card-actions">
        <span class="mi-card-act" data-act="copy" title="Copy SVG">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </span>
        <span class="mi-card-act ${isIconSaved(candidate.id) ? "is-active" : ""}" data-act="save" title="Save">
          <svg viewBox="0 0 24 24" fill="${isIconSaved(candidate.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </span>
      </span>
      <div class="mi-card-preview">${renderStyled(candidate, { size: 42 })}</div>
      <div class="mi-card-name">${candidate.name}</div>
      <div class="mi-card-source">${candidate.sourceName}</div>
    </button>
  `,
    )
    .join("");
}

// --------------------------------------------------------------------
// Export
// --------------------------------------------------------------------
function currentSvgString() {
  if (!state.editorIcon) return "";
  return renderSvg(state.editorIcon.svg, editorRenderOpts());
}
function toJsx(svg) {
  return svg
    .replace(/stroke-width/g, "strokeWidth")
    .replace(/stroke-linecap/g, "strokeLinecap")
    .replace(/stroke-linejoin/g, "strokeLinejoin")
    .replace(/stroke-dasharray/g, "strokeDasharray")
    .replace(/flood-color/g, "floodColor")
    .replace(/flood-opacity/g, "floodOpacity")
    .replace(/xmlns="[^"]+"\s?/, "");
}
function toDataUrl(svg) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function toCssMask(svg) {
  const name = state.editorIcon ? state.editorIcon.name : "icon";
  return `.icon-${name} {\n  -webkit-mask: url("${toDataUrl(svg)}") no-repeat center / contain;\n          mask: url("${toDataUrl(svg)}") no-repeat center / contain;\n  background-color: currentColor;\n  width: ${state.editor.size}px; height: ${state.editor.size}px;\n}`;
}
function toHtmlImg(svg) {
  const name = state.editorIcon ? state.editorIcon.name : "icon";
  return `<img src="${toDataUrl(svg)}" width="${state.editor.size}" height="${state.editor.size}" alt="${name}" />`;
}
function toVue(svg) {
  return `<template>\n  ${svg}\n</template>\n\n<script setup>\n</script>`;
}
async function toBase64Png() {
  return rasterizePng(state.pngSize || 512);
}
async function payloadFor(fmt) {
  const svg = currentSvgString();
  switch (fmt) {
    case "svg":
      return svg;
    case "jsx":
      return toJsx(svg);
    case "vue":
      return toVue(svg);
    case "html":
      return toHtmlImg(svg);
    case "css":
      return toCssMask(svg);
    case "dataurl":
      return toDataUrl(svg);
    case "base64":
      return await toBase64Png();
    default:
      return svg;
  }
}

async function updateCodePreview() {
  if (!state.editorIcon) return;
  const fmt = state.copyFmt || "svg";

  // Figma design color tokens
  const C = {
    tag: "#22863a", // tag names  <svg
    attr: "#6f42c1", // attribute names  width=
    str: "#032f62", // string values  "24"
    kw: "#d73a49", // keywords  import, from
  };

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function s(color, text) {
    return '<span style="color:' + color + '">' + text + "</span>";
  }

  // Single-pass XML/SVG tokenizer — matches one token at a time so
  // injected <span> tags are never re-processed by subsequent passes.
  function highlightXml(raw, kwList) {
    const escaped = esc(raw);
    // One combined regex: tag-open, tag-close, attr name, quoted value
    return escaped.replace(
      /(&lt;\/?)([a-zA-Z0-9:_-]+)|([a-zA-Z_:][a-zA-Z0-9:_.-]*)(?==)|("(?:[^"\\]|\\.)*")/g,
      function (match, tagPre, tagName, attrName, strVal) {
        if (tagName) return (tagPre || "") + s(C.tag, tagName);
        if (attrName) return s(C.attr, attrName);
        if (strVal) return s(C.str, strVal);
        return match;
      },
    );
  }

  // XML + keyword highlighting for JSX / Vue
  function highlightXmlKw(raw, kwList) {
    let out = highlightXml(raw);
    // keyword pass runs on the already-highlighted string but only matches
    // plain text (not inside existing span tags) — word-boundary is safe here
    kwList.forEach((kw) => {
      // Replace the keyword only when it appears as a whole word outside a span
      out = out.replace(
        new RegExp('(?<![>"])\\b(' + kw + ")\\b(?![^<]*>)", "g"),
        (m, w) => s(C.kw, w),
      );
    });
    return out;
  }

  // CSS: single-pass — selector, property, value
  function highlightCss(raw) {
    const e = raw.replace(/&/g, "&amp;");
    return e.replace(
      /(\.[\w-]+(?=\s*\{))|([\w-]+)(?=\s*:)|(url\([^)]*\)|"[^"]*"|'[^']*'|\d[\d.]*(?:px|%|em|rem|s)?)/g,
      function (match, sel, prop, val) {
        if (sel) return s(C.attr, sel);
        if (prop) return s(C.attr, prop);
        if (val) return s(C.str, val);
        return match;
      },
    );
  }

  // Data URL: color the mime prefix only
  function highlightDataUrl(raw) {
    if (!raw.startsWith("data:")) return raw.replace(/&/g, "&amp;");
    const semi = raw.indexOf(";");
    const prefix = raw.slice(0, 5); // "data:"
    const mime = raw.slice(5, semi); // "image/svg+xml"
    const rest = raw.slice(semi);
    return s(C.kw, prefix) + s(C.tag, mime) + rest.replace(/&/g, "&amp;");
  }

  const payload = await payloadFor(fmt);
  let highlighted;

  switch (fmt) {
    case "svg":
      highlighted = highlightXml(payload);
      break;
    case "jsx":
      highlighted = highlightXmlKw(payload, [
        "import",
        "export",
        "from",
        "default",
        "const",
        "let",
        "var",
        "return",
      ]);
      break;
    case "vue":
      highlighted = highlightXmlKw(payload, [
        "import",
        "export",
        "from",
        "default",
        "const",
        "let",
        "var",
        "return",
        "setup",
        "defineComponent",
      ]);
      break;
    case "html":
      highlighted = highlightXml(payload);
      break;
    case "css":
      highlighted = highlightCss(payload);
      break;
    case "dataurl":
      highlighted = highlightDataUrl(payload);
      break;
    case "base64":
      highlighted = payload.replace(/&/g, "&amp;");
      break;
    default:
      highlighted = highlightXml(payload);
  }

  const codeEl = $("#code-preview") && $("#code-preview").querySelector("code");
  if (codeEl) codeEl.innerHTML = highlighted;

  const titleEl = $("#code-preview-title");
  if (titleEl) {
    const titles = {
      svg: "SVG",
      jsx: "JSX / React",
      vue: "Vue",
      html: "HTML",
      css: "CSS mask",
      dataurl: "Data URL",
      base64: "Base64 PNG",
    };
    titleEl.textContent = (titles[fmt] || "SVG") + " code";
  }
}
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}
function download(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function requireLoginToDownload() {
  if (window.FirebaseAuthService) {
    const user = window.FirebaseAuthService.getCurrentUser();
    if (!user || user.isAnonymous) {
      if (window.AuthModal) {
        window.AuthModal.open("login");
      }
      return false;
    }
    return true;
  }
  return true;
}

function downloadSvg() {
  if (!requireLoginToDownload()) return;
  const s = currentSvgString();
  download(
    `${state.editorIcon.name}.svg`,
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s),
  );
  window.StackToast?.show("SVG downloaded");
}
function rasterizePng(size) {
  return new Promise((resolve, reject) => {
    const svgAt = renderSvg(state.editorIcon.svg, {
      ...editorRenderOpts(),
      size,
    });
    const img = new Image();
    const blob = new Blob([svgAt], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      // Composite the chosen background color so PNG matches what's on screen
      const bg = state.editor.bg;
      if (bg && bg !== "transparent") {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("png"));
    };
    img.src = url;
  });
}

async function downloadPng() {
  if (!requireLoginToDownload()) return;
  if (!state.editorIcon) return;
  const size = state.pngSize || 512;
  try {
    const dataUrl = await rasterizePng(size);
    download(`${state.editorIcon.name}-${size}.png`, dataUrl);
    window.StackToast?.show("PNG downloaded");
  } catch {
    toast("PNG export failed");
  }
}

// --------------------------------------------------------------------
// Compare
// --------------------------------------------------------------------
function iconStats(icon) {
  // Compute real per-icon metrics via off-DOM measurement.
  const tmp = document.createElement("div");
  tmp.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;visibility:hidden;";
  tmp.innerHTML = renderSvg(icon.svg, { color: "#000" });
  document.body.appendChild(tmp);
  const svg = tmp.querySelector("svg");
  const elems = svg.querySelectorAll(
    "path, line, circle, rect, polyline, polygon, ellipse",
  );
  let totalLen = 0;
  elems.forEach((el) => {
    try {
      if (el.getTotalLength) totalLen += el.getTotalLength();
    } catch {}
  });
  let bbox = { width: 24, height: 24 };
  try {
    bbox = svg.getBBox();
  } catch {}
  tmp.remove();
  return {
    shapes: elems.length,
    length: Math.round(totalLen),
    bbox: `${Math.round(bbox.width)} × ${Math.round(bbox.height)}`,
  };
}

function openCompare() {
  const items = [...state.selected]
    .map((id) => ICONS.find((x) => x.id === id))
    .filter(Boolean);
  if (items.length < 2) return;
  $("#compare-grid").innerHTML = items
    .map((ic) => {
      const s = iconStats(ic);
      return `
      <div class="mi-compare-item">
        <div class="mi-compare-item-preview">${renderStyled(ic, { size: 48, color: "#0F1116" })}</div>
        <div style="font-weight:600;margin-bottom:8px;">${ic.name}</div>
        <div class="mi-compare-attr"><span>Source</span><span>${ic.sourceName}</span></div>
        <div class="mi-compare-attr"><span>Style</span><span>${ic.style}</span></div>
        <div class="mi-compare-attr"><span>Shapes</span><span>${s.shapes}</span></div>
        <div class="mi-compare-attr"><span>Path len</span><span>${s.length}</span></div>
        <div class="mi-compare-attr"><span>BBox</span><span>${s.bbox}</span></div>
        <div class="mi-compare-attr"><span>License</span><span>${ic.license}</span></div>
      </div>
    `;
    })
    .join("");
  $("#compare-modal").classList.add("is-open");
  document.body.style.overflow = "hidden";
}

// --------------------------------------------------------------------
// Sections
// --------------------------------------------------------------------
function renderIconOfDay() {
  if (!ICONS.length) return;
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const seed = ((doy * 41) ^ (now.getFullYear() * 13)) >>> 0;
  const ic = ICONS[seed % ICONS.length];
  $("#icon-of-day").innerHTML = `
    <div class="mi-iotd-preview">${renderStyled(ic, { size: 96, color: "#5C4AE4" })}</div>
    <div class="mi-iotd-body">
      <h3>${ic.name}</h3>
      <p>Today's pick — a versatile ${ic.category} icon from ${ic.sourceName}. Customize size, stroke and color to fit your interface.</p>
      <div class="mi-iotd-tags">
        <span class="mi-iotd-tag">${ic.sourceName}</span>
        <span class="mi-iotd-tag">${ic.style}</span>
        <span class="mi-iotd-tag">${ic.category}</span>
        <span class="mi-iotd-tag">${ic.license}</span>
      </div>
      <div class="mi-iotd-actions">
        <button class="mi-btn-primary" data-open-id="${ic.id}">Customize</button>
        <button class="mi-btn-secondary" data-copy-id="${ic.id}">Copy SVG</button>
      </div>
    </div>
  `;
  $("#icon-of-day").addEventListener("click", (e) => {
    const openId = e.target.closest("[data-open-id]");
    const copyId = e.target.closest("[data-copy-id]");
    if (openId) {
      const ic = ICONS.find((x) => x.id === openId.dataset.openId);
      if (ic) openDetail(ic);
    }
    if (copyId) {
      const ic = ICONS.find((x) => x.id === copyId.dataset.copyId);
      if (ic)
        copyText(renderSvg(ic.svg)).then((ok) =>
          toast(ok ? "Copied SVG" : "Copy failed"),
        );
    }
  });
}

function renderCollections() {
  const seeds = [
    {
      name: "SaaS Dashboard",
      author: "@motvin",
      tag: "dashboard",
      desc: "Essential icons for admin dashboards.",
    },
    {
      name: "AI Product",
      author: "@designer",
      tag: "ai",
      desc: "For AI assistants, agents and inference.",
    },
    {
      name: "Mobile App",
      author: "@mobile",
      tag: "device",
      desc: "Bottom nav & core mobile icons.",
    },
    {
      name: "Fintech",
      author: "@finance",
      tag: "business",
      desc: "Payments, revenue, cards.",
    },
    {
      name: "E-commerce",
      author: "@shop",
      tag: "business",
      desc: "Cart, checkout, delivery.",
    },
    {
      name: "Empty States",
      author: "@ux",
      tag: "file",
      desc: "Beautiful empty-state visuals.",
    },
  ];
  $("#collections-grid").innerHTML = seeds
    .map((c) => {
      const preview = ICONS.filter((ic) => ic.category === c.tag).slice(0, 8);
      return `
      <div class="mi-coll-card" data-coll="${c.tag}">
        <div class="mi-coll-preview">
          ${preview
            .slice(0, 8)
            .map(
              (ic) =>
                `<div>${renderStyled(ic, { size: 22, color: "#0F1116" })}</div>`,
            )
            .join("")}
        </div>
        <div class="mi-coll-name">${c.name}</div>
        <div class="mi-coll-meta">
          <span class="mi-coll-author">${c.author}</span>
          <span>${preview.length}+ icons</span>
        </div>
      </div>
    `;
    })
    .join("");
  $("#collections-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".mi-coll-card");
    if (!card) return;
    state.categoryFilter.clear();
    state.categoryFilter.add(card.dataset.coll);
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderFilters();
    renderGrid();
    document
      .querySelector(".mi-results-wrap")
      .scrollIntoView({ behavior: "smooth" });
  });
}

function renderCategoriesSection() {
  // Obsolete: previously rendered mock categories.
}

// --------------------------------------------------------------------
// Global recolor
// --------------------------------------------------------------------
// color name lookup for preset swatches
const COLOR_NAMES = {
  "#0F1116": "Near Black",
  "#5C4AE4": "Accent",
  "#2563EB": "Blue",
  "#16A34A": "Green",
  "#DC2626": "Red",
  "#D97706": "Amber",
  "#6B7280": "Grey",
  "#FFFFFF": "White",
};

function applyGlobalColor(hex) {
  state.globalColor = hex || "currentColor";
  localStorage.setItem("mill.globalColor", state.globalColor);

  const isDefault = state.globalColor === "currentColor";
  const wheel = $("#recolor-wheel");
  const label = $("#recolor-label");
  const resetBtn = $("#btn-recolor-reset-inline");

  // Swap color-wheel image: default SVG or a filled circle in the chosen color
  if (wheel) {
    if (isDefault) {
      wheel.src = "ASSET/Icons/icon-color-wheel.svg";
    } else {
      const circleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${state.globalColor}"/><circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/></svg>`;
      wheel.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(circleSvg)}`;
    }
  }

  // Update label to color name or hex
  if (label) {
    label.textContent = isDefault
      ? "Recolor"
      : COLOR_NAMES[state.globalColor.toUpperCase()] || state.globalColor;
  }

  // Show/hide inline reset button; it sits in the flex flow right after the label
  if (resetBtn) resetBtn.hidden = isDefault;

  // Highlight the matching preset swatch
  document.querySelectorAll(".mi-recolor-swatch-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.color === state.globalColor);
  });

  renderGrid();
}

function initRecolor() {
  const btn = $("#btn-recolor");
  const dropdown = $("#recolor-dropdown");
  const colorInput = $("#recolor-color-input");
  const hexInput = $("#recolor-hex-input");
  if (!btn || !dropdown) return;

  // Restore persisted color
  const savedColor = state.globalColor;
  if (savedColor && savedColor !== "currentColor") {
    colorInput.value = savedColor;
    hexInput.value = savedColor;
  }
  applyGlobalColor(savedColor);

  // Toggle dropdown on click or keyboard (div role=button needs keydown)
  btn.addEventListener("click", (e) => {
    if (e.target.closest("#btn-recolor-reset-inline")) return;
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dropdown.hidden = !dropdown.hidden;
    }
  });

  // Inline reset button inside the toolbar button
  const inlineReset = $("#btn-recolor-reset-inline");
  if (inlineReset) {
    inlineReset.addEventListener("click", (e) => {
      e.stopPropagation();
      colorInput.value = "#0F1116";
      hexInput.value = "#0F1116";
      dropdown.hidden = true;
      applyGlobalColor("currentColor");
    });
  }

  // Native color picker
  colorInput.addEventListener("input", () => {
    const hex = colorInput.value;
    hexInput.value = hex;
    applyGlobalColor(hex);
  });

  // Hex text input
  hexInput.addEventListener("input", () => {
    const val = hexInput.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      colorInput.value = val;
      applyGlobalColor(val);
    }
  });

  // Preset swatches
  document.querySelectorAll(".mi-recolor-swatch-btn").forEach((swatchBtn) => {
    swatchBtn.addEventListener("click", () => {
      const hex = swatchBtn.dataset.color;
      colorInput.value = hex;
      hexInput.value = hex;
      applyGlobalColor(hex);
    });
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!dropdown.hidden && !btn.closest("#recolor-wrap").contains(e.target)) {
      dropdown.hidden = true;
    }
  });
}

// --------------------------------------------------------------------
// Event wiring
// --------------------------------------------------------------------
function wire() {
  const searchInput = $("#search-input");
  const searchClear = $("#search-clear");
  const searchIcon = $(".mi-search-icon");
  const debounced = debounce(() => {
    state.query = searchInput.value;
    localStorage.setItem("mill.query", state.query);
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderGrid();
  }, 120);

  if (state.query) {
    searchInput.value = state.query;
    if (searchClear) searchClear.style.display = "flex";
    if (searchIcon) searchIcon.style.display = "none";
  }

  searchInput.addEventListener("input", (e) => {
    if (searchClear)
      searchClear.style.display = searchInput.value ? "flex" : "none";
    if (searchIcon)
      searchIcon.style.display = searchInput.value ? "none" : "flex";

    // Clear category highlight if user edits the search query away from the category
    if (
      state.categoryFilter.size > 0 &&
      searchInput.value !== [...state.categoryFilter][0]
    ) {
      state.categoryFilter.clear();
      localStorage.setItem(
        "mill.categoryFilter",
        JSON.stringify([...state.categoryFilter]),
      );
      buildCategoryList();
    }

    debounced(e);
  });

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.style.display = "none";
      if (searchIcon) searchIcon.style.display = "flex";
      state.query = "";
      localStorage.setItem("mill.query", "");

      if (state.categoryFilter.size > 0) {
        state.categoryFilter.clear();
        localStorage.setItem(
          "mill.categoryFilter",
          JSON.stringify([...state.categoryFilter]),
        );
        buildCategoryList();
      }

      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
      searchInput.focus();
    });
  }

  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.query = searchInput.value;
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderGrid();
  });

  // Chips
  $$(".mi-chip").forEach((c) =>
    c.addEventListener("click", () => {
      searchInput.value = c.dataset.q;
      state.query = c.dataset.q;
      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
      document
        .querySelector(".mi-results-wrap")
        .scrollIntoView({ behavior: "smooth" });
    }),
  );

  // Explore quick sorts
  $$(".mi-explore-item").forEach((b) =>
    b.addEventListener("click", () => {
      const mode = b.dataset.explore;
      if (["trending", "popular", "new"].includes(mode)) {
        state.sort = mode;
        $("#sort-select").value = mode;
      } else if (mode === "collections") {
        document
          .getElementById("collections")
          .scrollIntoView({ behavior: "smooth" });
        return;
      } else if (mode === "categories") {
        document
          .getElementById("categories")
          .scrollIntoView({ behavior: "smooth" });
        return;
      } else if (mode === "styles") {
        state.styleFilter.clear();
        state.styleFilter.add("outline");
        renderFilters();
      }
      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
      document
        .querySelector(".mi-results-wrap")
        .scrollIntoView({ behavior: "smooth" });
    }),
  );

  // AI button
  $("#btn-ai").addEventListener("click", () => {
    const q =
      searchInput.value.trim() ||
      "an icon for an AI assistant sending a notification";
    const words = q.toLowerCase().replace(/[.,]/g, "").split(/\s+/);
    let matched = null;
    for (const w of words) {
      if (SYNONYMS[w]) {
        matched = SYNONYMS[w][0];
        break;
      }
      if (false) {
        matched = w;
        break;
      }
    }
    if (!matched) matched = "sparkles";
    searchInput.value = matched;
    state.query = matched;
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderGrid();
    toast(`AI suggests: ${matched}`);
    document
      .querySelector(".mi-results-wrap")
      .scrollIntoView({ behavior: "smooth" });
  });

  // Density
  $$(".mi-view-tabs [data-density]").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.density === state.density);
    b.addEventListener("click", () => {
      $$(".mi-view-tabs [data-density]").forEach((x) =>
        x.classList.remove("is-active"),
      );
      b.classList.add("is-active");
      state.density = b.dataset.density;
      renderGrid();
    });
  });

  // Global Size Panel
  const globalSizeSlider = $("#ctrl-size-panel");
  if (globalSizeSlider) {
    globalSizeSlider.value = state.globalSize;
    $("#size-panel-val").textContent = state.globalSize;
    const initialSizePct = ((state.globalSize - 12) / (64 - 12)) * 100;
    $("#size-panel-fill").style.width = initialSizePct + "%";
    $("#size-panel-thumb").style.left = initialSizePct + "%";
    $$(".mi-size-q-btn").forEach((b) => {
      b.classList.toggle(
        "is-active",
        parseInt(b.dataset.panelSize) === state.globalSize,
      );
    });

    globalSizeSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      state.globalSize = val;
      localStorage.setItem("mill.globalSize", val);
      $("#size-panel-val").textContent = val;
      const pct = ((val - 12) / (64 - 12)) * 100;
      $("#size-panel-fill").style.width = pct + "%";
      $("#size-panel-thumb").style.left = pct + "%";
      renderGrid();

      $$(".mi-size-q-btn").forEach((b) => {
        b.classList.toggle("is-active", parseInt(b.dataset.panelSize) === val);
      });
    });

    $$(".mi-size-q-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const val = parseInt(b.dataset.panelSize);
        globalSizeSlider.value = val;
        globalSizeSlider.dispatchEvent(new Event("input"));
      });
    });
  }

  // Global Stroke Panel
  const globalStrokeSlider = $("#ctrl-stroke-panel");
  if (globalStrokeSlider) {
    globalStrokeSlider.value = state.globalStroke;
    $("#stroke-panel-val").textContent = state.globalStroke;
    const initialStrokePct = ((state.globalStroke - 1) / (2 - 1)) * 100;
    $("#stroke-panel-fill").style.width = initialStrokePct + "%";
    $("#stroke-panel-thumb").style.left = initialStrokePct + "%";
    $$(".mi-stroke-q-btn").forEach((b) => {
      b.classList.toggle(
        "is-active",
        parseFloat(b.dataset.panelStroke) === state.globalStroke,
      );
    });

    globalStrokeSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.globalStroke = val;
      localStorage.setItem("mill.globalStroke", val);
      $("#stroke-panel-val").textContent = val;
      const pct = ((val - 1) / (2 - 1)) * 100;
      $("#stroke-panel-fill").style.width = pct + "%";
      $("#stroke-panel-thumb").style.left = pct + "%";
      renderGrid();

      $$(".mi-stroke-q-btn").forEach((b) => {
        b.classList.toggle(
          "is-active",
          parseFloat(b.dataset.panelStroke) === val,
        );
      });
    });

    $$(".mi-stroke-q-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const val = parseFloat(b.dataset.panelStroke);
        globalStrokeSlider.value = val;
        globalStrokeSlider.dispatchEvent(new Event("input"));
      });
    });
  }

  // Sort
  if ($("#sort-select")) {
    $("#sort-select").value = state.sort;
    $("#sort-select").addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderGrid();
    });
  }

  // Clear filters
  $("#clear-filters").addEventListener("click", () => {
    state.sourceFilter.clear();
    state.styleFilter.clear();
    state.licenseFilter.clear();
    state.categoryFilter.clear();
    state.query = "";
    searchInput.value = "";
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderFilters();
    renderGrid();
  });

  // Grid clicks
  $("#icon-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".mi-card");
    if (!card) return;
    const icon =
      renderedIconsMap.get(card.dataset.id) ||
      ICONS.find((x) => x.id === card.dataset.id);
    if (!icon) return;
    if (e.target.closest("[data-cmp]")) {
      if (state.selected.has(icon.id)) state.selected.delete(icon.id);
      else state.selected.add(icon.id);
      card.classList.toggle("is-selected");
      renderCompareCount();
      return;
    }
    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "copy") {
        if (!requireLoginToDownload()) return;
        copyText(renderStyled(icon)).then((ok) =>
          toast(ok ? "Copied SVG" : "Copy failed"),
        );
      } else if (act.dataset.act === "copy-name") {
        copyText(icon.name).then((ok) =>
          toast(ok ? `Copied "${icon.name}"` : "Copy failed"),
        );
      } else if (act.dataset.act === "save") {
        window.CollectionManager.openModal(icon.id, icon);
      }
      return;
    }
    openDetail(icon);
  });

  // Load more

  // Compare
  $("#compare-btn").addEventListener("click", openCompare);

  // Modal close
  $("#btn-detail-previous").addEventListener("click", () => navigateDetail(-1));
  $("#btn-detail-next").addEventListener("click", () => navigateDetail(1));
  $("#detail-modal .mi-modal-backdrop").addEventListener(
    "wheel",
    (event) => {
      $("#detail-modal").scrollBy({ top: event.deltaY, left: event.deltaX });
      event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close]") || e.target.closest("[data-close]"))
      closeModals();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    // Editor-scoped single-key shortcuts (only when editor is open and no input focused)
    const inEditor = $("#detail-modal").classList.contains("is-open");
    const tag = (
      (document.activeElement && document.activeElement.tagName) ||
      ""
    ).toLowerCase();
    if (
      !inEditor ||
      tag === "input" ||
      tag === "textarea" ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    if (e.key === "ArrowLeft") {
      navigateDetail(-1);
      return;
    }
    if (e.key === "ArrowRight") {
      navigateDetail(1);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "c") {
      $("#btn-copy-svg").click();
    } else if (k === "d") {
      $("#btn-download-svg").click();
    } else if (k === "p") {
      $("#btn-download-png").click();
    } else if (k === "s") {
      $("#btn-save-collection").click();
    } else if (k === "f") {
      $("#btn-find-similar").click();
    } else if (k === "e") {
      $("#btn-expand").click();
    } else if (k === "g") {
      $("#btn-toggle-grid").click();
    } else if (k === "r") {
      $("#btn-reset").click();
    } else if (e.key === "?" || (e.shiftKey && k === "/")) {
      $("#btn-help").click();
    }
  });

  // syncSliderVisual logic moved to global scope

  // Editor controls
  const editor = state.editor;
  $("#ctrl-size").addEventListener("input", (e) => {
    editor.size = +e.target.value;
    $("#size-val").textContent = editor.size;
    syncSliderVisual("ctrl-size");
    $$("[data-size]").forEach((b) =>
      b.classList.toggle("is-active", +b.dataset.size === editor.size),
    );
    renderCanvas();
  });
  $("#ctrl-stroke").addEventListener("input", (e) => {
    editor.stroke = +e.target.value;
    $("#stroke-val").textContent = editor.stroke;
    syncSliderVisual("ctrl-stroke");
    $$("[data-stroke]").forEach((b) =>
      b.classList.toggle("is-active", +b.dataset.stroke === editor.stroke),
    );
    renderCanvas();
  });
  $("#ctrl-color").addEventListener("input", (e) => {
    editor.color = e.target.value;
    $("#ctrl-color-hex").value = editor.color;
    renderCanvas();
  });
  $("#ctrl-color-hex").addEventListener("input", (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      editor.color = v;
      $("#ctrl-color").value = v;
      renderCanvas();
    }
  });
  $("#ctrl-rot").addEventListener("input", (e) => {
    editor.rotation = +e.target.value;
    $("#rot-val").textContent = editor.rotation + "°";
    syncSliderVisual("ctrl-rot");
    renderCanvas();
  });
  $("#ctrl-pad").addEventListener("input", (e) => {
    editor.padding = +e.target.value;
    $("#pad-val").textContent = editor.padding;
    syncSliderVisual("ctrl-pad");
    renderCanvas();
  });
  $$("[data-size]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.size = +b.dataset.size;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-stroke]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.stroke = +b.dataset.stroke;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-color]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.color = b.dataset.color;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-cap]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.cap = b.dataset.cap;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-join]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.join = b.dataset.join;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-flip]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.flip = b.dataset.flip;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-bg]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.bg = b.dataset.bg;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $("#ctrl-bg").addEventListener("input", (e) => {
    editor.bg = e.target.value;
    $("#ctrl-bg-hex").value = editor.bg;
    renderCanvas();
  });
  $("#ctrl-bg-hex").addEventListener("input", (e) => {
    const value = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      editor.bg = value;
      $("#ctrl-bg").value = value;
      renderCanvas();
    }
  });

  // Effects: opacity, shadow. Stroke pattern. Shape controls.
  $("#ctrl-opa").addEventListener("input", (e) => {
    editor.opacity = +e.target.value;
    $("#opa-val").textContent = editor.opacity + "%";
    syncSliderVisual("ctrl-opa");
    renderCanvas();
  });
  $("#ctrl-shd").addEventListener("input", (e) => {
    editor.shadow = +e.target.value;
    $("#shd-val").textContent = editor.shadow;
    syncSliderVisual("ctrl-shd");
    renderCanvas();
  });
  $$("[data-pattern]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.pattern = b.dataset.pattern;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $$("[data-shape]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.shape = b.dataset.shape;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $("#ctrl-icon-inset").addEventListener("input", (e) => {
    editor.iconInset = +e.target.value;
    $("#icon-inset-val").textContent = editor.iconInset;
    syncSliderVisual("ctrl-icon-inset");
    renderCanvas();
  });
  $("#ctrl-shape-radius").addEventListener("input", (e) => {
    editor.shapeRadius = +e.target.value;
    $("#shape-radius-val").textContent = editor.shapeRadius;
    syncSliderVisual("ctrl-shape-radius");
    renderCanvas();
  });
  $("#ctrl-shape-color").addEventListener("input", (e) => {
    editor.shapeColor = e.target.value;
    $("#ctrl-shape-color-hex").value = editor.shapeColor;
    renderCanvas();
  });
  $("#ctrl-shape-color-hex").addEventListener("input", (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      editor.shapeColor = v;
      $("#ctrl-shape-color").value = v;
      renderCanvas();
    }
  });
  $$("[data-shape-color]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.shapeColor = b.dataset.shapeColor;
      syncEditorControls();
      renderCanvas();
    }),
  );

  // Breadcrumbs: expand-to-page + category jump
  $("#btn-expand").addEventListener("click", () => {
    if (!state.editorIcon) return;
    const nowFull = !document.body.classList.contains("mi-full");
    setFullPage(nowFull, state.editorIcon.id);
    // Keep modal open in both modes; recompute canvas since dimensions change
    setTimeout(renderCanvas, 50);
  });
  $("#crumb-category").addEventListener("click", (e) => {
    e.preventDefault();
    const cat = e.currentTarget.dataset.category;
    if (!cat) return;
    closeModals();
    state.categoryFilter.clear();
    state.categoryFilter.add(cat);
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderFilters();
    renderGrid();
    document
      .querySelector(".mi-results-wrap")
      .scrollIntoView({ behavior: "smooth" });
  });

  // Presets & Reset
  $$(".mi-presets button").forEach((b) =>
    b.addEventListener("click", () => applyPreset(b.dataset.preset)),
  );
  $("#btn-reset").addEventListener("click", () => {
    Object.assign(state.editor, editorBaseline);
    syncEditorControls();
    renderCanvas();
    $$(".mi-presets button").forEach((b) => b.classList.remove("is-active"));
    toast("Reset to defaults");
  });

  // PNG size dropdown
  const pngBtn = $("#btn-png-size");
  const pngDd = $("#png-dropdown");
  const closeDd = () => {
    pngDd.classList.remove("is-open");
    pngBtn.classList.remove("is-open");
    pngBtn.setAttribute("aria-expanded", "false");
  };
  pngBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = pngDd.classList.toggle("is-open");
    pngBtn.classList.toggle("is-open", open);
    pngBtn.setAttribute("aria-expanded", String(open));
  });
  pngDd.addEventListener("click", (e) => {
    const item = e.target.closest(".mi-category-menu-item");
    if (!item) return;
    state.pngSize = +item.dataset.png;
    $("#png-size-label").textContent = state.pngSize + "px";
    $$("#png-dropdown .mi-category-menu-item").forEach((x) =>
      x.classList.toggle("is-active", x === item),
    );
    closeDd();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".mi-png-group")) closeDd();
  });

  // Fill controls
  $$("[data-fill]").forEach((b) =>
    b.addEventListener("click", () => {
      editor.fillMode = b.dataset.fill;
      syncEditorControls();
      renderCanvas();
    }),
  );
  $("#ctrl-fill-color").addEventListener("input", (e) => {
    editor.fillColor = e.target.value;
    $("#ctrl-fill-color-hex").value = editor.fillColor;
    renderCanvas();
  });
  $("#ctrl-fill-color-hex").addEventListener("input", (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      editor.fillColor = v;
      $("#ctrl-fill-color").value = v;
      renderCanvas();
    }
  });

  // Tags row → search
  $("#tags-row")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".mi-tag-chip");
    if (!chip) return;
    closeModals();
    state.query = chip.dataset.tag;
    $("#search-input").value = state.query;
    state.page = 1;
    localStorage.setItem("mill.page", state.page);
    renderGrid();
    document
      .querySelector(".mi-results-wrap")
      .scrollIntoView({ behavior: "smooth" });
  });

  // Canvas grid overlay
  $("#btn-toggle-grid").addEventListener("click", () => {
    state.gridOn = !state.gridOn;
    $("#canvas").classList.toggle("is-grid", state.gridOn);
    $("#btn-toggle-grid").setAttribute("aria-pressed", String(state.gridOn));
  });

  // Copy-format dropdown
  // Copy-format dropdown
  const cpBtn = $("#btn-copy-fmt");
  if (cpBtn) {
    cpBtn.addEventListener("click", async () => {
      if (!requireLoginToDownload()) return;
      if (!state.editorIcon) return;
      const size = state.pngSize || 512;
      try {
        cpBtn.style.opacity = "0.5";
        const dataUrl = await rasterizePng(size);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast("Copied PNG image");
      } catch (e) {
        console.error(e);
        toast("Failed to copy PNG image");
      } finally {
        cpBtn.style.opacity = "1";
      }
    });
  }

  // SVG-format dropdown
  const svgFmtBtn = $("#btn-svg-format");
  const svgFmtDd = $("#svg-dropdown");
  const closeSvgFmtDd = () => {
    if (svgFmtDd) {
      svgFmtDd.classList.remove("is-open");
      svgFmtBtn.classList.remove("is-open");
      svgFmtBtn.setAttribute("aria-expanded", "false");
    }
  };
  if (svgFmtBtn && svgFmtDd) {
    svgFmtBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = svgFmtDd.classList.toggle("is-open");
      svgFmtBtn.classList.toggle("is-open", open);
      svgFmtBtn.setAttribute("aria-expanded", String(open));
    });
    svgFmtDd.addEventListener("click", (e) => {
      const item = e.target.closest(".mi-category-menu-item");
      if (!item) return;
      state.copyFmt = item.dataset.fmt;
      // Update label on main button
      const formatText = item.textContent.trim();
      // If it's a long text like "JSX / React", maybe just use a shorthand, or exactly what's there
      let labelText = formatText;
      if (formatText.includes("HTML")) labelText = "HTML";
      if (formatText.includes("CSS")) labelText = "CSS";
      if (formatText.includes("Base64")) labelText = "Base64";
      if (formatText.includes("JSX")) labelText = "JSX";

      const labelEl = $("#svg-fmt-label");
      if (labelEl) labelEl.textContent = "Copy " + labelText;

      $$("#svg-dropdown .mi-category-menu-item").forEach((x) =>
        x.classList.toggle("is-active", x === item),
      );
      closeSvgFmtDd();
      updateCodePreview();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".mi-svg-group")) closeSvgFmtDd();
    });
  }

  // Share
  $("#btn-share").addEventListener("click", async () => {
    if (!state.editorIcon) return;
    const url = new URL(window.location.href);
    url.searchParams.set("icon", state.editorIcon.id);
    const link = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Motvin Icons — ${state.editorIcon.name}`,
          url: link,
        });
        return;
      } catch {}
    }
    const ok = await copyText(link);
    toast(ok ? "Share link copied" : "Copy failed");
  });

  // Help modal
  $("#btn-help").addEventListener("click", () => {
    $("#help-modal").classList.add("is-open");
  });

  // Export actions
  $("#btn-copy-svg").addEventListener("click", async () => {
    if (!requireLoginToDownload()) return;
    const fmt = state.copyFmt || "svg";
    try {
      const payload = await payloadFor(fmt);
      const ok = await copyText(payload);
      if (ok) copyStackToast(`${fmt.toUpperCase()} copied`);
      else toast("Copy failed");
    } catch {
      toast("Copy failed");
    }
  });
  $("#btn-download-svg").addEventListener("click", downloadSvg);
  $("#btn-download-png").addEventListener("click", downloadPng);
  $("#btn-copy-jsx").addEventListener("click", async () => {
    if (!requireLoginToDownload()) return;
    const ok = await copyText(toJsx(currentSvgString()));
    toast(ok ? "Copied JSX" : "Copy failed");
  });
  $("#btn-copy-code").addEventListener("click", async () => {
    if (!requireLoginToDownload()) return;
    const fmt = state.copyFmt || "svg";
    try {
      const payload = await payloadFor(fmt);
      const ok = await copyText(payload);
      toast(ok ? `Copied ${fmt.toUpperCase()}` : "Copy failed");
    } catch {
      toast("Copy failed");
    }
  });

  // Dynamic scroll-aware mask for #code-preview
  (function () {
    const pre = $("#code-preview");
    if (!pre) return;

    function updateMask() {
      const atTop = pre.scrollTop === 0;
      const atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 1;
      const canScroll = pre.scrollHeight > pre.clientHeight;

      if (!canScroll) {
        pre.style.webkitMaskImage = "none";
        pre.style.maskImage = "none";
      } else if (atTop) {
        // Fade bottom only
        pre.style.webkitMaskImage =
          "linear-gradient(to bottom, black 70%, transparent 100%)";
        pre.style.maskImage =
          "linear-gradient(to bottom, black 70%, transparent 100%)";
      } else if (atBottom) {
        // Fade top only
        pre.style.webkitMaskImage =
          "linear-gradient(to top, black 70%, transparent 100%)";
        pre.style.maskImage =
          "linear-gradient(to top, black 70%, transparent 100%)";
      } else {
        // Fade both ends
        pre.style.webkitMaskImage =
          "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)";
        pre.style.maskImage =
          "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)";
      }
    }

    pre.addEventListener("scroll", updateMask);
    // Also update whenever code preview content changes (observe mutations)
    const observer = new MutationObserver(updateMask);
    observer.observe(pre, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    updateMask();
  })();
  const figmaButton = $("#btn-figma");
  if (figmaButton) {
    figmaButton.addEventListener("click", async () => {
      const ok = await copyText(currentSvgString());
      toast(ok ? "SVG copied — paste in Figma with ⌘V" : "Copy failed");
    });
  }
  $("#btn-save-collection").addEventListener("click", () => {
    if (!state.editorIcon) return;
    window.CollectionManager.openModal(state.editorIcon.id, state.editorIcon);
  });
  $("#btn-find-similar").addEventListener("click", () => {
    if (!state.editorIcon) return;
    document
      .querySelector(".mi-similar")
      .scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast("Showing visually similar icons");
  });

  $("#similar-row").addEventListener("click", (e) => {
    const item = e.target.closest(".mi-similar-item");
    if (!item) return;
    const icon = ICONS.find((x) => x.id === item.dataset.id);
    if (icon) openDetail(icon);
  });

  $("#matching-icons-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".mi-card");
    if (!card) return;
    const icon = ICONS.find((x) => x.id === card.dataset.id);
    if (!icon) return;
    const action = e.target.closest("[data-act]");
    if (action) {
      if (action.dataset.act === "copy") {
        if (!requireLoginToDownload()) return;
        copyText(renderStyled(icon)).then((ok) =>
          toast(ok ? "Copied SVG" : "Copy failed"),
        );
      } else if (action.dataset.act === "save") {
        window.CollectionManager.openModal(icon.id, icon);
      }
      return;
    }
    openDetail(icon);
  });

  // Header actions
  $("#btn-collections").addEventListener("click", () => {
    document
      .getElementById("collections")
      .scrollIntoView({ behavior: "smooth" });
  });
  $("#btn-make-consistent").addEventListener("click", () => {
    if (state.selected.size < 2) {
      toast("Select 2+ icons to make consistent");
      return;
    }
    // Show a "Make Consistent" preview: same size/stroke across sources
    openCompare();
    toast("Normalized to 24px / 1.75px stroke");
  });
  $("#btn-new-system").addEventListener("click", () => {
    $("#sys-count").textContent = getActiveFolderIconIds().length;
    $("#sys-name").value = "";
    $("#sys-desc").value = "";
    $("#system-modal").classList.add("is-open");
    setTimeout(() => $("#sys-name").focus(), 60);
  });
  $("#sys-create").addEventListener("click", () => {
    const name = $("#sys-name").value.trim();
    if (!name) {
      $("#sys-name").focus();
      return;
    }
    state.collections.push({
      name,
      description: $("#sys-desc").value.trim(),
      preset: $("#sys-preset").value,
      size: +$("#sys-size").value || 24,
      stroke: +$("#sys-stroke").value || 1.75,
      color: $("#sys-color").value,
      createdAt: Date.now(),
      icons: getActiveFolderIconIds(),
    });
    saveLS();
    closeModals();
    $("#sys-name").value = "";
    $("#system-modal").classList.remove("is-open");
    renderCollections();
    toast(`Created "${name}" with ${getActiveFolderIconIds().length} icons`);
  });
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// --------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------
function renderHeroStats() {
  const totalMarket = 319252; // Hardcoded per user request
  const totalStyles =
    Object.keys(window.ILLUSTRATION_STATS?.byStyle || {}).length || 2;
  const fmt = (n) =>
    n >= 1e6
      ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M"
      : n >= 1e3
        ? (n / 1e3).toFixed(0) + "k"
        : String(n);
  $("#stat-icons").textContent = fmt(totalMarket) + "+";
  $("#stat-libraries").textContent = SOURCES.length;
  $("#stat-styles").textContent = totalStyles;

  const searchInput = $("#search-input");
  if (searchInput) {
    searchInput.placeholder = `Search ${ICONS.length.toLocaleString()}+ icons...`;
  }
}

// --------------------------------------------------------------------
// Sidebar and Categories
// --------------------------------------------------------------------
function setupSidebarTabs() {
  const tabs = document.querySelectorAll(".mi-sidebar-item");
  const title = document.getElementById("rp-header-title");
  const panels = {
    filters: document.getElementById("rp-tab-filters"),
    categories: document.getElementById("rp-tab-categories"),
    saved: document.getElementById("rp-tab-saved"),
    plugins: document.getElementById("rp-tab-plugins"),
    help: document.getElementById("rp-tab-help"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Update active tab styling
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      const target = tab.dataset.sidebar;
      if (!target) return; // e.g. favorites might use id instead, but we added data-sidebar="saved"

      // Update right panel header
      if (title) {
        title.textContent = tab.querySelector(".mi-sidebar-label").textContent;
      }

      // Toggle panels
      Object.entries(panels).forEach(([key, el]) => {
        if (el) {
          el.style.display = key === target ? "block" : "none";
        }
      });

      const innerPanel = document.querySelector(".mi-right-panel-inner");
      if (innerPanel && target) {
        Object.keys(panels).forEach((key) =>
          innerPanel.classList.remove(`mi-rp-${key}`),
        );
        innerPanel.classList.add(`mi-rp-${target}`);
      }

      // Update global state and filter grid
      state.showSaved = target === "saved";
      localStorage.setItem("mill.sidebarTab", target);

      // If categories tab is opened, make sure list is rendered
      if (target === "categories") {
        buildCategoryList();
      }

      if (target === "saved") {
        renderSavedPanel();
      }

      // Re-render grid to reflect saved vs all icons
      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
    });
  });
}
function buildTopCategoryDropdown() {
  const menuList = document.getElementById("cat-menu-list");
  const catDropdown = document.getElementById("cat-dropdown");
  const catMenu = document.getElementById("cat-menu");
  const catDropdownVal = document.getElementById("cat-dropdown-val");

  if (!menuList || !catDropdown || !catMenu) return;

  const catCounts =
    (window.ILLUSTRATION_STATS && window.ILLUSTRATION_STATS.byCategory) || {};

  const cats = Object.keys(catCounts).sort((a, b) => {
    if (a === "Others") return 1;
    if (b === "Others") return -1;
    return a.localeCompare(b);
  });

  const isAllActive = state.categoryFilter.size === 0;
  let html = `
    <div class="mi-category-menu-item ${isAllActive ? "is-active" : ""}" data-cat="all">
      <span class="mi-category-menu-label">All Illustrations</span>
      <span class="mi-category-menu-badge">${getTotalIllustrationCount().toLocaleString()}</span>
    </div>
  `;

  cats.forEach((c) => {
    const isActive = state.categoryFilter.has(c);
    html += `
      <div class="mi-category-menu-item ${isActive ? "is-active" : ""}" data-cat="${c}">
        <span class="mi-category-menu-label">${c}</span>
        <span class="mi-category-menu-badge">${catCounts[c].toLocaleString()}</span>
      </div>
    `;
  });

  menuList.innerHTML = html;

  // Update label
  if (state.categoryFilter.size === 0) {
    if (catDropdownVal) catDropdownVal.textContent = "All Illustrations";
  } else {
    const arr = Array.from(state.categoryFilter);
    if (catDropdownVal) catDropdownVal.textContent = arr[0];
  }

  // Handle item clicks
  menuList.querySelectorAll(".mi-category-menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const cat = item.dataset.cat;
      state.categoryFilter.clear();

      if (cat !== "all") {
        state.categoryFilter.add(cat);
      }

      localStorage.setItem(
        "mill.categoryFilter",
        JSON.stringify([...state.categoryFilter]),
      );

      catMenu.classList.remove("is-open");
      buildTopCategoryDropdown();
      buildCategoryList();

      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
    });
  });

  // Toggle menu
  catDropdown.onclick = (e) => {
    e.stopPropagation();
    catMenu.classList.toggle("is-open");
  };

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!catDropdown.contains(e.target) && !catMenu.contains(e.target)) {
      catMenu.classList.remove("is-open");
    }
  });
}

function buildCategoryList() {
  buildTopCategoryDropdown();
  const container = document.getElementById("categories-list-container");
  if (!container) return;

  const catCounts =
    (window.ILLUSTRATION_STATS && window.ILLUSTRATION_STATS.byCategory) || {};

  const cats = Object.keys(catCounts).sort((a, b) => {
    if (a === "Others") return 1;
    if (b === "Others") return -1;
    return a.localeCompare(b);
  });

  const isAllActive = state.categoryFilter.size === 0;
  let html = `
    <div class="mi-rp-cat-item ${isAllActive ? "is-active" : ""}" data-cat="all">
      <span class="mi-rp-cat-label">All</span>
      <span class="mi-rp-cat-count">${getTotalIllustrationCount().toLocaleString()}</span>
    </div>
  `;

  cats.forEach((c) => {
    const isActive = state.categoryFilter.has(c);
    html += `
      <div class="mi-rp-cat-item ${isActive ? "is-active" : ""}" data-cat="${c}">
        <span class="mi-rp-cat-label">${c}</span>
        <span class="mi-rp-cat-count">${catCounts[c].toLocaleString()}</span>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind clicks
  container.querySelectorAll(".mi-rp-cat-item").forEach((item) => {
    item.addEventListener("click", () => {
      const cat = item.dataset.cat;
      state.categoryFilter.clear();
      if (cat !== "all") {
        state.categoryFilter.add(cat);
      }

      localStorage.setItem(
        "mill.categoryFilter",
        JSON.stringify([...state.categoryFilter]),
      );

      const searchInput = document.getElementById("search-input");
      const searchClear = document.getElementById("search-clear");
      const searchIcon = document.querySelector(".mi-search-icon");
      if (searchClear && searchInput)
        searchClear.style.display = searchInput.value ? "flex" : "none";
      if (searchIcon && searchInput)
        searchIcon.style.display = searchInput.value ? "none" : "flex";

      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
      buildCategoryList(); // re-render to update active styling
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".mi-rp-badge-lg")?.classList.remove("mi-skeleton");
});

document.addEventListener("DOMContentLoaded", () => {
  const PROMO_KEY = "motvin_promo_hidden_until";
  const banner = document.querySelector(".mi-new-banner");

  if (banner) {
    const hiddenUntil = localStorage.getItem(PROMO_KEY);
    if (hiddenUntil && Date.now() < parseInt(hiddenUntil, 10)) {
      banner.setAttribute("hidden", "");
    } else {
      document
        .querySelector(".mi-new-banner-close")
        ?.addEventListener("click", () => {
          banner.setAttribute("hidden", "");
          // 2 days in milliseconds: 2 * 24 * 60 * 60 * 1000 = 172800000
          localStorage.setItem(PROMO_KEY, (Date.now() + 172800000).toString());
        });
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Initialize tooltip system
  if (typeof TooltipController !== "undefined") {
    window.tooltipController = new TooltipController();
    window.tooltipController.init();
  }

  renderHeroStats();
  renderFilters();

  // Restore sidebar tab state BEFORE first renderGrid so state.showSaved is correct
  const savedTab = localStorage.getItem("mill.sidebarTab");
  if (savedTab && savedTab !== "filters") {
    state.showSaved = savedTab === "saved";
  }

  renderGrid();
  renderCompareCount();
  renderIconOfDay();
  renderCollections();
  renderCategoriesSection();
  setupSidebarTabs();
  buildCategoryList();
  wire();
  initRecolor();

  // Apply saved tab UI after DOM is ready (panels, button highlight, saved panel)
  if (savedTab && savedTab !== "filters") {
    const panels = {
      filters: document.getElementById("rp-tab-filters"),
      categories: document.getElementById("rp-tab-categories"),
      saved: document.getElementById("rp-tab-saved"),
      plugins: document.getElementById("rp-tab-plugins"),
      help: document.getElementById("rp-tab-help"),
    };
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.style.display = key === savedTab ? "block" : "none";
    });
    const innerPanel = document.querySelector(".mi-right-panel-inner");
    if (innerPanel) {
      Object.keys(panels).forEach((key) =>
        innerPanel.classList.remove(`mi-rp-${key}`),
      );
      innerPanel.classList.add(`mi-rp-${savedTab}`);
    }
    const activeTabBtn = document.querySelector(
      `.mi-sidebar-item[data-sidebar="${savedTab}"]`,
    );
    if (activeTabBtn) {
      document
        .querySelectorAll(".mi-sidebar-item")
        .forEach((t) => t.classList.remove("is-active"));
      activeTabBtn.classList.add("is-active");
      const title = document.getElementById("rp-header-title");
      if (title)
        title.textContent =
          activeTabBtn.querySelector(".mi-sidebar-label")?.textContent || "";
    }
    if (savedTab === "saved" && typeof renderSavedPanel === "function")
      renderSavedPanel();
    if (savedTab === "categories") buildCategoryList();
  }

  // Dynamically update the overall live icons count in the sidebar
  const badgeLg = document.querySelector(".mi-rp-badge-lg");
  if (badgeLg) {
    badgeLg.textContent = ICONS.length.toLocaleString();
    badgeLg.classList.remove("mi-skeleton");
  }

  // Remove skeleton loaders from sort tabs
  document.querySelectorAll(".mi-sort-tab.mi-skeleton").forEach((tab) => {
    tab.classList.remove("mi-skeleton");
  });

  document.querySelectorAll(".mi-sort-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.sort = tab.dataset.sort;
      state.page = 1;
      document.querySelectorAll(".mi-sort-tab").forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
      });
      const select = $("#sort-select");
      if (select) select.value = state.sort;
      renderGrid();
    });
  });
  document.querySelectorAll(".mi-sort-tab").forEach((tab) => {
    const isActive = tab.dataset.sort === state.sort;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  // Deep-link: open the icon requested via ?icon=<id> as a full-page view
  const params = new URLSearchParams(window.location.search);
  const iconId = params.get("icon");
  if (iconId) {
    const ic = ICONS.find((x) => x.id === iconId);
    if (ic) {
      openDetail(ic);
      setFullPage(true, ic.id);
    }
  }

  // Sidebar Resizer Logic
  const resizer = document.getElementById("rp-resizer");
  if (resizer) {
    let isResizing = false;
    let startX;
    let startWidth;

    resizer.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--right-panel-w",
          ),
        ) || 380;
      document.body.classList.add("is-resizing-rp");
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const dx = startX - e.clientX;
      let newWidth = startWidth + dx;

      // Constraints
      if (newWidth < 330) newWidth = 330;
      if (newWidth > 730) newWidth = 730;

      document.documentElement.style.setProperty(
        "--right-panel-w",
        newWidth + "px",
      );
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.classList.remove("is-resizing-rp");
      }
    });
  }

  // Detach / Floating Panel Logic
  const detachBtn = document.getElementById("rp-detach-btn");
  const rightPanel = document.querySelector(".mi-right-panel");
  const rpHeader = document.querySelector(".mi-rp-header");

  if (detachBtn && rightPanel && rpHeader) {
    let isFloating = false;

    // Toggle floating state
    detachBtn.addEventListener("click", () => {
      isFloating = !isFloating;
      if (isFloating) {
        document.body.classList.add("is-panel-floating");

        const mainRect = document
          .querySelector(".mi-main")
          .getBoundingClientRect();
        const PADDING = 20;
        const defaultWidth = 360;
        const defaultHeight = 600;

        rightPanel.style.width = defaultWidth + "px";
        rightPanel.style.height = defaultHeight + "px";
        rightPanel.style.left = mainRect.right - PADDING - defaultWidth + "px";
        rightPanel.style.top = mainRect.top + PADDING + "px";
        rightPanel.style.right = "auto";

        detachBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`;
        detachBtn.title = "Dock Panel";
      } else {
        document.body.classList.remove("is-panel-floating");
        rightPanel.style.top = "";
        rightPanel.style.right = "";
        rightPanel.style.left = "";
        rightPanel.style.width = "";
        rightPanel.style.height = "";
        detachBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        detachBtn.title = "Detach Panel";
      }
      savePanelState();
    });

    // Dragging logic for the panel when floating
    let isDragging = false;
    let isEdgeResizing = false;
    let resizeDir = "";
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let initialWidth = 0;
    let initialHeight = 0;

    const rpInner = document.querySelector(".mi-right-panel-inner");
    const edgeResizers = document.querySelectorAll(".mi-rp-edge-resizer");

    edgeResizers.forEach((resizer) => {
      resizer.addEventListener("mousedown", (e) => {
        if (!isFloating) return;
        e.stopPropagation(); // prevent drag
        isEdgeResizing = true;
        resizeDir = resizer.getAttribute("data-resize");
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = rightPanel.getBoundingClientRect();
        initialWidth = rect.width;
        initialHeight = rect.height;
        initialLeft = rect.left;
        initialTop = rect.top;

        // Ensure absolute positioning is set correctly before resize starts
        rightPanel.style.left = initialLeft + "px";
        rightPanel.style.top = initialTop + "px";
        rightPanel.style.right = "auto";

        document.body.style.userSelect = "none";
      });
    });

    if (rpInner) {
      rpInner.addEventListener("mousedown", (e) => {
        if (!isFloating) return;

        const target = e.target;
        if (
          target.closest("#rp-detach-btn") ||
          target.closest("input") ||
          target.closest(".mi-rp-checkbox") ||
          target.closest(".mi-rp-item-label") ||
          target.closest(".mi-rp-more") ||
          target.closest(".mi-rp-slider-wrapper") ||
          target.closest(".mi-rp-seg-item") ||
          target.closest(".mi-rp-license-active") ||
          target.closest(".mi-rp-edge-resizer") ||
          target.closest("button")
        ) {
          return;
        }

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const rect = rightPanel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        rightPanel.style.left = initialLeft + "px";
        rightPanel.style.right = "auto";
        rightPanel.style.top = initialTop + "px";

        document.body.style.userSelect = "none";
      });
    }

    document.addEventListener("mousemove", (e) => {
      if (!isDragging && !isEdgeResizing) return;

      const mainRect = document
        .querySelector(".mi-main")
        .getBoundingClientRect();
      const PADDING = 20;
      const boundLeft = mainRect.left + PADDING;
      const boundRight = mainRect.right - PADDING;
      const boundTop = mainRect.top + PADDING;
      const boundBottom = mainRect.bottom - PADDING;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (isDragging) {
        let newL = initialLeft + dx;
        let newT = initialTop + dy;
        const panelW = rightPanel.offsetWidth;
        const panelH = rightPanel.offsetHeight;

        newL = Math.max(boundLeft, Math.min(newL, boundRight - panelW));
        newT = Math.max(boundTop, Math.min(newT, boundBottom - panelH));

        rightPanel.style.left = newL + "px";
        rightPanel.style.top = newT + "px";
      } else if (isEdgeResizing) {
        let newW = initialWidth;
        let newH = initialHeight;
        let newL = initialLeft;
        let newT = initialTop;

        const MIN_W = 330;
        const MAX_W = 730;
        const MIN_H = 400;
        const MAX_H = 1200;

        if (resizeDir.includes("r")) {
          newW = Math.max(MIN_W, Math.min(MAX_W, initialWidth + dx));
          if (newL + newW > boundRight) newW = boundRight - newL;
          if (newW < MIN_W) newW = MIN_W;
        }
        if (resizeDir.includes("l")) {
          newW = Math.max(MIN_W, Math.min(MAX_W, initialWidth - dx));
          newL = initialLeft + (initialWidth - newW);
          if (newL < boundLeft) {
            newL = boundLeft;
            newW = initialLeft + initialWidth - newL;
          }
          if (newW < MIN_W) {
            newW = MIN_W;
            newL = initialLeft + initialWidth - newW;
          }
        }
        if (resizeDir.includes("b")) {
          newH = Math.max(MIN_H, Math.min(MAX_H, initialHeight + dy));
          if (newT + newH > boundBottom) newH = boundBottom - newT;
          if (newH < MIN_H) newH = MIN_H;
        }
        if (resizeDir.includes("t")) {
          newH = Math.max(MIN_H, Math.min(MAX_H, initialHeight - dy));
          newT = initialTop + (initialHeight - newH);
          if (newT < boundTop) {
            newT = boundTop;
            newH = initialTop + initialHeight - newT;
          }
          if (newH < MIN_H) {
            newH = MIN_H;
            newT = initialTop + initialHeight - newH;
          }
        }

        rightPanel.style.width = newW + "px";
        rightPanel.style.height = newH + "px";
        rightPanel.style.left = newL + "px";
        rightPanel.style.top = newT + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      if (isDragging || isEdgeResizing) {
        isDragging = false;
        isEdgeResizing = false;
        document.body.style.userSelect = "";
        savePanelState();
      }
    });

    const PANEL_LS_KEY = "ml_panel_layout";
    function savePanelState() {
      if (!isFloating) {
        localStorage.removeItem(PANEL_LS_KEY);
      } else {
        localStorage.setItem(
          PANEL_LS_KEY,
          JSON.stringify({
            w: rightPanel.style.width,
            h: rightPanel.style.height,
            l: rightPanel.style.left,
            t: rightPanel.style.top,
          }),
        );
      }
    }

    function loadPanelState() {
      const saved = localStorage.getItem(PANEL_LS_KEY);
      if (saved) {
        try {
          const st = JSON.parse(saved);
          isFloating = true;
          document.body.classList.add("is-panel-floating");
          rightPanel.style.width = st.w;
          rightPanel.style.height = st.h;
          rightPanel.style.left = st.l;
          rightPanel.style.top = st.t;
          rightPanel.style.right = "auto";
          detachBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`;
          detachBtn.title = "Dock Panel";
        } catch (e) {}
      }
    }

    loadPanelState();
  }

  window.CollectionManager.init({
    appType: "illustrations",
    getItems: () => ICONS,
    saveLS: saveLS,
    onUpdate: () => {
      saveLS();
      if (typeof renderSavedPanel === "function") renderSavedPanel();
      if (typeof renderGrid === "function") renderGrid();
      updateEditModalSaveState();
    },
  });
});

function updateEditModalSaveState() {
  if (
    !state.editorIcon ||
    !window.EditModalManager ||
    !window.EditModalManager.updateSaveState
  )
    return;
  const isSaved =
    state.folders &&
    state.folders.some((f) => f.iconIds.includes(state.editorIcon.id));
  window.EditModalManager.updateSaveState(isSaved);
}

function renderSavedPanel() {
  const container = document.getElementById("collections-list-container");
  if (!container) return;

  const allCount = state.folders.reduce((acc, f) => {
    f.iconIds.forEach((id) => acc.add(id));
    return acc;
  }, new Set()).size;

  let html = `
    <div class="mi-rp-cat-item ${!state.activeFolderId ? "is-active" : ""}" data-folder="all" style="background: white; box-shadow: 0px 4px 4px rgba(96,96,96,0.15), 0px 0px 0.5px rgba(96,96,96,0.31)${!state.activeFolderId ? ", 0 0 0 3px var(--mi-focus)" : ""}; height: 84px; display: flex; flex-direction: column; justify-content: space-between; padding: 16px 16px 12px 16px; border-radius: 8px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: ${!state.activeFolderId ? "1px solid var(--mi-accent)" : "1px solid transparent"};">
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 15px; color: rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">All Saved</span>
        <span style="font-family: 'Inter', sans-serif; font-size: 14px; color: rgba(0,0,0,0.4);">${allCount}</span>
      </div>
    </div>
  `;

  state.folders.forEach((f) => {
    const isActive = state.activeFolderId === f.id;
    html += `
      <div class="mi-rp-cat-item ${isActive ? "is-active" : ""}" data-folder="${f.id}" style="background: white; box-shadow: 0px 4px 4px rgba(96,96,96,0.15), 0px 0px 0.5px rgba(96,96,96,0.31)${isActive ? ", 0 0 0 3px var(--mi-focus)" : ""}; height: 84px; display: flex; flex-direction: column; justify-content: space-between; padding: 16px 16px 12px 16px; border-radius: 8px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: ${isActive ? "1px solid var(--mi-accent)" : "1px solid transparent"}; position: relative;">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 15px; color: rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.name}</span>
          <span style="font-family: 'Inter', sans-serif; font-size: 14px; color: rgba(0,0,0,0.4);">${f.iconIds.length}</span>
        </div>
        <button class="mi-folder-del" data-del="${f.id}" title="Delete Collection" style="position: absolute; bottom: 12px; right: 16px; background: none; border: none; cursor: pointer; padding: 0; color: #E53935; display: flex; opacity: 0; transition: opacity 0.2s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

document
  .getElementById("collections-list-container")
  ?.addEventListener("click", (e) => {
    const delBtn = e.target.closest(".mi-folder-del");
    if (delBtn) {
      e.stopPropagation();
      const folderId = delBtn.dataset.del;
      if (confirm("Are you sure you want to delete this collection?")) {
        state.folders = state.folders.filter((f) => f.id !== folderId);
        window.CollectionManager?.forgetDirectoryHandle(folderId);
        if (state.activeFolderId === folderId) state.activeFolderId = null;
        saveLS();
        renderSavedPanel();
        renderGrid();
      }
      return;
    }

    const item = e.target.closest(".mi-rp-cat-item");
    if (item) {
      const folderId =
        item.dataset.folder === "all" ? null : item.dataset.folder;
      state.activeFolderId = folderId;
      renderSavedPanel();
      state.page = 1;
      localStorage.setItem("mill.page", state.page);
      renderGrid();
    }
  });

document
  .getElementById("rp-coll-new-btn-figma")
  ?.addEventListener("click", () => {
    const modal = document.getElementById("local-folder-modal");
    if (modal) modal.classList.add("is-open");
  });

// --- Authentication UI Sync ---
