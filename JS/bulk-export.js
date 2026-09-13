/**
 * Bulk export helpers for the multi-select actions strip.
 *
 * Both bulk actions used to hand the browser one thing per selected item, and
 * the browser only honoured the first one:
 *   - Copy pushed N `<svg>` roots into the clipboard separated by blank lines.
 *     That is not a single SVG document, so Figma / Illustrator / a saved .svg
 *     keep the first root and drop the rest.
 *   - Download fired N `<a download>` clicks from one user gesture. Chrome
 *     gates repeated programmatic downloads behind the "download multiple
 *     files" permission, so only the first file lands.
 *
 * So a multi-select copy becomes one valid SVG that contains every selected
 * item, and a multi-select download becomes one ZIP with a file per item.
 *
 * The grid renderer nests each item as `<svg><g opacity="1"><svg>artwork`, and a
 * design tool turns every one of those into its own frame or group. Copying a
 * selection therefore has to collapse each item down to a single `<svg>` first,
 * otherwise pasting lands four or five levels deep per item.
 */
window.BulkExport = (function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GAP = 8;
  // Handled explicitly when two viewports are merged; everything else on the
  // inner `<svg>` is presentation that has to survive.
  const VIEWPORT_ATTRIBUTES = [
    "x",
    "y",
    "width",
    "height",
    "viewBox",
    "preserveAspectRatio",
  ];

  function parseSvg(markup) {
    if (typeof DOMParser === "undefined") return null;
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const root = doc.documentElement;
    return root && root.localName === "svg" ? root : null;
  }

  function onlyElementChild(node) {
    return node.children.length === 1 ? node.children[0] : null;
  }

  function unwrap(node, child) {
    while (child.firstChild) node.insertBefore(child.firstChild, child);
    child.remove();
  }

  // `<g opacity="1">` and bare `<g>` wrappers draw nothing on their own, so
  // they only exist as an extra layer in the paste target.
  function dropInertGroups(node) {
    let child = onlyElementChild(node);
    while (
      child &&
      child.localName === "g" &&
      Array.from(child.attributes).every(
        (attribute) =>
          attribute.name === "opacity" && parseFloat(attribute.value) === 1,
      )
    ) {
      unwrap(node, child);
      child = onlyElementChild(node);
    }
  }

  function viewBoxOf(node) {
    const parts = (node.getAttribute("viewBox") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
  }

  // True when the child viewport covers its parent's exactly, which is the only
  // case where the two can be merged without moving the artwork.
  function fillsParent(parent, child) {
    const box = viewBoxOf(parent);
    if (!box) return false;
    const [minX, minY, boxWidth, boxHeight] = box;
    const span = (name, fallback) => {
      const value = child.getAttribute(name);
      if (value === null || value === "100%") return fallback;
      return parseFloat(value);
    };
    return (
      parseFloat(child.getAttribute("x") || "0") === minX &&
      parseFloat(child.getAttribute("y") || "0") === minY &&
      span("width", boxWidth) === boxWidth &&
      span("height", boxHeight) === boxHeight
    );
  }

  /**
   * Collapse the renderer's wrapper chain into the outer `<svg>`, keeping its
   * own width/height so the item still occupies the same box. The inner viewBox
   * takes over the coordinate mapping, which is what the nesting was doing.
   */
  function flatten(node) {
    dropInertGroups(node);
    let child = onlyElementChild(node);
    while (child && child.localName === "svg" && fillsParent(node, child)) {
      Array.from(child.attributes).forEach((attribute) => {
        if (VIEWPORT_ATTRIBUTES.includes(attribute.name)) return;
        if (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:")) {
          return;
        }
        node.setAttribute(attribute.name, attribute.value);
      });
      const viewBox = child.getAttribute("viewBox");
      if (viewBox) node.setAttribute("viewBox", viewBox);
      const ratio = child.getAttribute("preserveAspectRatio");
      if (ratio) node.setAttribute("preserveAspectRatio", ratio);
      else node.removeAttribute("preserveAspectRatio");
      unwrap(node, child);
      dropInertGroups(node);
      child = onlyElementChild(node);
    }
    return node;
  }

  // Falls back to the viewBox so items rendered with percentage or missing
  // width/height still get a cell of the right shape.
  function measure(node) {
    const box = viewBoxOf(node);
    const read = (name, fallback) => {
      const value = parseFloat(node.getAttribute(name));
      if (Number.isFinite(value) && value > 0) return value;
      return fallback;
    };
    return {
      width: read("width", box ? box[2] : 24),
      height: read("height", box ? box[3] : 24),
    };
  }

  function safeId(name) {
    return (
      String(name || "item")
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item"
    );
  }

  function serialize(node) {
    return new XMLSerializer().serializeToString(node);
  }

  /**
   * Reduce a fetched .svg file to its root element. Source files carry an XML
   * declaration, a DOCTYPE or editor comments ahead of `<svg>` - harmless in a
   * standalone file, invalid once the markup is embedded in another document.
   * @param {string} markup
   * @returns {string} the `<svg>…</svg>` document, or "" if there is none
   */
  function normalizeSvgFile(markup) {
    const text = String(markup || "");
    const start = text.search(/<svg[\s>]/i);
    const end = text.lastIndexOf("</svg>");
    return start === -1 || end === -1 ? "" : text.slice(start, end + 6);
  }

  /**
   * Collapse one item's wrapper chain, for the single-item copy surfaces (card
   * copy button, editor Copy SVG). Markup that is not an `<svg>` document - the
   * `<img>` fallback for an icon whose SVG has not loaded - is returned as is.
   * @param {string} markup
   */
  function flattenSvg(markup) {
    const node = parseSvg(markup || "");
    if (!node) return markup;
    flatten(node);
    node.setAttribute("xmlns", SVG_NS);
    return serialize(node);
  }

  /**
   * Merge rendered SVG markup into a single valid SVG document laid out on a
   * grid, one `<svg id="name">` per item and no wrapper groups in between.
   * @param {Array<{name: string, svg: string}>} items
   */
  function combineSvgs(items) {
    const nodes = (items || [])
      .map((item) => {
        const node = item && parseSvg(item.svg || "");
        return node ? { name: item.name, node: flatten(node) } : null;
      })
      .filter(Boolean);
    if (nodes.length === 0) {
      return (items || []).map((item) => item && item.svg).join("\n\n");
    }
    if (nodes.length === 1) {
      nodes[0].node.setAttribute("xmlns", SVG_NS);
      return serialize(nodes[0].node);
    }

    const sizes = nodes.map((entry) => measure(entry.node));
    const cell = Math.max(
      ...sizes.map((size) => Math.max(size.width, size.height)),
    );
    const columns = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / columns);
    const width = columns * cell + (columns - 1) * GAP;
    const height = rows * cell + (rows - 1) * GAP;

    const sheet = document.createElementNS(SVG_NS, "svg");
    sheet.setAttribute("xmlns", SVG_NS);
    sheet.setAttribute("width", String(width));
    sheet.setAttribute("height", String(height));
    sheet.setAttribute("viewBox", `0 0 ${width} ${height}`);

    nodes.forEach((entry, index) => {
      const size = sizes[index];
      const column = index % columns;
      const row = Math.floor(index / columns);
      const item = document.importNode(entry.node, true);
      // The id is what a design tool uses to name the pasted layer.
      item.setAttribute("id", safeId(entry.name));
      item.setAttribute(
        "x",
        String(column * (cell + GAP) + (cell - size.width) / 2),
      );
      item.setAttribute(
        "y",
        String(row * (cell + GAP) + (cell - size.height) / 2),
      );
      item.removeAttribute("xmlns");
      sheet.append(document.createTextNode("\n"), item);
    });
    sheet.append(document.createTextNode("\n"));

    return serialize(sheet);
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[i] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    return new TextEncoder().encode(String(data));
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl).slice(String(dataUrl).indexOf(",") + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function uniqueNames(files) {
    const used = new Map();
    return files.map((file) => {
      const name = file.name || "file";
      if (!used.has(name)) {
        used.set(name, 1);
        return { ...file, name };
      }
      const count = used.get(name) + 1;
      used.set(name, count);
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const extension = dot > 0 ? name.slice(dot) : "";
      return { ...file, name: `${stem}-${count}${extension}` };
    });
  }

  /**
   * Build a stored (uncompressed) ZIP. Store keeps this dependency-free - the
   * payloads are SVG text and already-compressed PNGs.
   * @param {Array<{name: string, data: string|Uint8Array}>} files
   */
  function zip(files) {
    const stamp = new Date();
    const dosTime =
      (stamp.getHours() << 11) |
      (stamp.getMinutes() << 5) |
      (Math.floor(stamp.getSeconds() / 2) & 0x1f);
    const dosDate =
      ((stamp.getFullYear() - 1980) << 9) |
      ((stamp.getMonth() + 1) << 5) |
      stamp.getDate();

    const encoder = new TextEncoder();
    const entries = uniqueNames(files).map((file) => {
      const name = encoder.encode(file.name);
      const data = toBytes(file.data);
      return { name, data, crc: crc32(data) };
    });

    const localSize = entries.reduce(
      (total, entry) => total + 30 + entry.name.length + entry.data.length,
      0,
    );
    const centralSize = entries.reduce(
      (total, entry) => total + 46 + entry.name.length,
      0,
    );
    const buffer = new Uint8Array(localSize + centralSize + 22);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    const writeU16 = (value) => {
      view.setUint16(offset, value, true);
      offset += 2;
    };
    const writeU32 = (value) => {
      view.setUint32(offset, value, true);
      offset += 4;
    };
    const writeBytes = (bytes) => {
      buffer.set(bytes, offset);
      offset += bytes.length;
    };

    entries.forEach((entry) => {
      entry.offset = offset;
      writeU32(0x04034b50);
      writeU16(20); // version needed
      writeU16(0x0800); // UTF-8 file names
      writeU16(0); // stored
      writeU16(dosTime);
      writeU16(dosDate);
      writeU32(entry.crc);
      writeU32(entry.data.length);
      writeU32(entry.data.length);
      writeU16(entry.name.length);
      writeU16(0); // extra field length
      writeBytes(entry.name);
      writeBytes(entry.data);
    });

    const centralOffset = offset;
    entries.forEach((entry) => {
      writeU32(0x02014b50);
      writeU16(20); // version made by
      writeU16(20); // version needed
      writeU16(0x0800);
      writeU16(0);
      writeU16(dosTime);
      writeU16(dosDate);
      writeU32(entry.crc);
      writeU32(entry.data.length);
      writeU32(entry.data.length);
      writeU16(entry.name.length);
      writeU16(0); // extra field length
      writeU16(0); // comment length
      writeU16(0); // disk number start
      writeU16(0); // internal attributes
      writeU32(0); // external attributes
      writeU32(entry.offset);
      writeBytes(entry.name);
    });

    const centralBytes = offset - centralOffset;
    writeU32(0x06054b50);
    writeU16(0);
    writeU16(0);
    writeU16(entries.length);
    writeU16(entries.length);
    writeU32(centralBytes);
    writeU32(centralOffset);
    writeU16(0); // comment length

    return new Blob([buffer], { type: "application/zip" });
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking straight away can cancel the download in Safari.
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * One download for the whole selection: the file itself when a single item
   * is selected, otherwise a ZIP.
   * @param {Array<{name: string, data: string|Uint8Array, type?: string}>} files
   * @param {string} zipName
   */
  function downloadFiles(files, zipName) {
    const list = (files || []).filter(Boolean);
    if (list.length === 0) return 0;
    if (list.length === 1) {
      const [file] = list;
      downloadBlob(
        file.name,
        new Blob([toBytes(file.data)], {
          type: file.type || "application/octet-stream",
        }),
      );
      return 1;
    }
    downloadBlob(zipName, zip(list));
    return list.length;
  }

  return {
    combineSvgs,
    flattenSvg,
    normalizeSvgFile,
    downloadFiles,
    dataUrlToBytes,
    zip,
  };
})();
