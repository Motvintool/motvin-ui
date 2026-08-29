/**
 * StylesPanel – Enhanced style properties sidebar component
 * Features: search/filter, collapsible sections, inline editing, global tokens,
 *           shadow/border previews, duplicate detection, apply-to-selection
 */
class StylesPanel extends HTMLElement {
  constructor() {
    super();
    this._styles = {
      colors: [],
      fonts: [],
      spacing: [],
      radii: [],
      shadows: [],
      borders: [],
    };
    this._searchQuery = "";
    this._activeFilter = "all";
    this._filterMenuOpen = false;
    this._collapsedSections = new Set();
    this._selectedStyleKey = null;
    this._editingKey = null;
    this._tokens = new Map();
    this._renderScheduled = false;
    this._onDocumentClick = (event) => {
      if (!this.contains(event.target) && this._filterMenuOpen) {
        this._filterMenuOpen = false;
        this._scheduleRender();
      }
    };
  }

  connectedCallback() {
    this.style.display = "block";
    document.addEventListener("click", this._onDocumentClick);
    this._scheduleRender();
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocumentClick);
  }

  static get observedAttributes() {
    return ["colors", "fonts", "spacing", "radii", "shadows", "borders"];
  }

  attributeChangedCallback() {
    this._parseAttributes();
    this._scheduleRender();
  }

  _parseAttributes() {
    const _safeParse = (attr, fallback) => {
      try {
        return JSON.parse(this.getAttribute(attr) || "[]");
      } catch {
        return fallback;
      }
    };
    this._styles.colors = _safeParse("colors", []);
    this._styles.fonts = _safeParse("fonts", []);
    this._styles.spacing = _safeParse("spacing", []);
    this._styles.radii = _safeParse("radii", []);
    this._styles.shadows = _safeParse("shadows", []);
    this._styles.borders = _safeParse("borders", []);
    this._syncTokens();
  }

  setStylesData(styles = {}) {
    this._styles.colors = Array.isArray(styles.colors) ? styles.colors : [];
    this._styles.fonts = Array.isArray(styles.fonts) ? styles.fonts : [];
    this._styles.spacing = Array.isArray(styles.spacing) ? styles.spacing : [];
    this._styles.radii = Array.isArray(styles.radii) ? styles.radii : [];
    this._styles.shadows = Array.isArray(styles.shadows) ? styles.shadows : [];
    this._styles.borders = Array.isArray(styles.borders) ? styles.borders : [];
    this._syncTokens();
    this._scheduleRender();
  }

  /* ── Global Design Token System ──────────────────────────────────────── */
  _syncTokens() {
    this._styles.colors.forEach((c, i) => {
      const key = "color-" + (c.hex || i);
      if (!this._tokens.has(key))
        this._tokens.set(key, {
          id: key,
          type: "color",
          name: c.name,
          value: c.hex,
          linked: new Set(),
        });
    });
    this._styles.fonts.forEach((f) => {
      const key =
        "font-" +
        (f.family || "") +
        "-" +
        (f.size || "") +
        "-" +
        (f.weight || "");
      if (!this._tokens.has(key))
        this._tokens.set(key, {
          id: key,
          type: "font",
          name: f.tag,
          value: f,
          linked: new Set(),
        });
    });
    this._styles.shadows.forEach((s, i) => {
      const key = "shadow-" + i;
      if (!this._tokens.has(key))
        this._tokens.set(key, {
          id: key,
          type: "shadow",
          name: s.name,
          value: s.value,
          linked: new Set(),
        });
    });
  }

  _updateToken(tokenKey, newValue) {
    const token = this._tokens.get(tokenKey);
    if (!token) return;
    token.value = newValue;
    token.linked.forEach((el) => {
      try {
        if (token.type === "color") {
          el.style.color = newValue;
          el.style.backgroundColor = newValue;
        } else if (token.type === "shadow") {
          el.style.boxShadow = newValue;
        }
      } catch {}
    });
    this._scheduleRender();
  }

  /* ── Deferred rendering for performance ──────────────────────────────── */
  _scheduleRender() {
    if (this._renderScheduled) return;
    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      this._render();
    });
  }

  /* ── Filtering ───────────────────────────────────────────────────────── */
  _getFilteredSections() {
    const q = this._searchQuery.toLowerCase().trim();
    const f = this._activeFilter;
    const sections = [];
    const match = (name, val) =>
      !q ||
      (name || "").toLowerCase().includes(q) ||
      String(val || "")
        .toLowerCase()
        .includes(q);

    if (f === "all" || f === "colors") {
      const items = this._styles.colors.filter((c) => match(c.name, c.hex));
      if (items.length)
        sections.push({
          type: "colors",
          title: "Color Palette",
          items,
          count: items.length,
        });
    }
    if (f === "all" || f === "typography") {
      const items = this._styles.fonts.filter((ft) => match(ft.tag, ft.family));
      if (items.length)
        sections.push({
          type: "typography",
          title: "Typography Scale",
          items,
          count: items.length,
        });
    }
    if (f === "all" || f === "spacing") {
      const items = (this._styles.spacing || []).filter((s) =>
        match(s.name, s.value + "px"),
      );
      if (items.length)
        sections.push({
          type: "spacing",
          title: "Spacing",
          items,
          count: items.length,
        });
    }
    if (f === "all" || f === "borders") {
      const bItems = (this._styles.borders || []).filter((b) =>
        match(b.name, b.value),
      );
      const rItems = (this._styles.radii || []).filter((r) =>
        match(r.name, r.value + "px"),
      );
      if (bItems.length)
        sections.push({
          type: "borders",
          title: "Borders",
          items: bItems,
          count: bItems.length,
        });
      if (rItems.length)
        sections.push({
          type: "radii",
          title: "Radius",
          items: rItems,
          count: rItems.length,
        });
    }
    if (f === "all" || f === "shadows") {
      const items = (this._styles.shadows || []).filter((s) =>
        match(s.name, s.value),
      );
      if (items.length)
        sections.push({
          type: "shadows",
          title: "Shadows",
          items,
          count: items.length,
        });
    }
    return sections;
  }

  /* ── Toast feedback ──────────────────────────────────────────────────── */
  _showFeedback(message) {
    const t = document.getElementById("toastNotification");
    if (t && typeof t.show === "function") t.show("Styles", message, "success");
  }

  _copyToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) return Promise.resolve(false);

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      return navigator.clipboard
        .writeText(value)
        .then(() => true)
        .catch(() => this._copyToClipboardFallback(value));
    }

    return Promise.resolve(this._copyToClipboardFallback(value));
  }

  _copyToClipboardFallback(value) {
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  _buildStylesExportPayload() {
    // Export all sidebar styles, regardless of active search/filter view.
    const cloneList = (list) =>
      Array.isArray(list) ? list.map((item) => ({ ...(item || {}) })) : [];

    return {
      colors: cloneList(this._styles.colors),
      fonts: cloneList(this._styles.fonts),
      spacing: cloneList(this._styles.spacing),
      radii: cloneList(this._styles.radii).map(({ subtype, ...item }) => item),
      shadows: cloneList(this._styles.shadows),
      borders: cloneList(this._styles.borders).map(
        ({ subtype, ...item }) => item,
      ),
    };
  }

  /* ── Apply style to canvas element ───────────────────────────────────── */
  _applyStyleToCanvas(type, value, tokenKey) {
    try {
      const pf = document.getElementById("previewFrame");
      if (!pf || !pf.contentDocument) {
        this._showFeedback("No canvas element selected");
        return;
      }
      const fd = pf.contentDocument;
      const sel = fd.getSelection && fd.getSelection();
      let target = sel && sel.focusNode ? sel.focusNode.parentElement : null;
      if (!target) target = fd.body;
      if (!target) {
        this._showFeedback("No element to apply to");
        return;
      }

      if (tokenKey) {
        const tk = this._tokens.get(tokenKey);
        if (tk) tk.linked.add(target);
      }

      switch (type) {
        case "color":
          target.style.color = value;
          this._showFeedback("Applied color " + value);
          break;
        case "bg-color":
          target.style.backgroundColor = value;
          this._showFeedback("Applied background " + value);
          break;
        case "font":
          if (value.family) target.style.fontFamily = value.family;
          if (value.size) target.style.fontSize = value.size;
          if (value.weight) target.style.fontWeight = value.weight;
          this._showFeedback("Applied font " + (value.family || ""));
          break;
        case "shadow":
          target.style.boxShadow = value;
          this._showFeedback("Applied shadow");
          break;
        case "border":
          target.style.border = value;
          this._showFeedback("Applied border");
          break;
        case "border-radius":
          target.style.borderRadius = value + "px";
          this._showFeedback("Applied radius " + value + "px");
          break;
        case "spacing":
          target.style.padding = value + "px";
          this._showFeedback("Applied spacing " + value + "px");
          break;
      }
    } catch (e) {
      console.warn("StylesPanel: Could not apply style", e);
    }
  }

  /* ── Main render ─────────────────────────────────────────────────────── */
  _render() {
    const sections = this._getFilteredSections();
    const totalCount = sections.reduce((a, s) => a + s.count, 0);
    const _e = (s) =>
      (s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    this.innerHTML = `
      <div class="styles-props-panel">
        <div class="sp-search-bar">
          <div class="sp-search-input-wrap">
            <svg class="sp-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6.33 11.67a5.33 5.33 0 1 0 0-10.67 5.33 5.33 0 0 0 0 10.67ZM13 13l-2.9-2.9" stroke="#94A3B8" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <input type="text" class="sp-search-input" placeholder="Search styles..." value="${_e(this._searchQuery)}" />
            ${this._searchQuery ? '<button class="sp-search-clear">&times;</button>' : ""}
            <button class="sp-filter-icon-btn ${this._activeFilter !== "all" ? "is-active" : ""}" title="Filter styles" aria-label="Filter styles">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.333 3.083H11.667M4.083 7H9.917M5.833 10.917H8.167" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="sp-filter-menu btn-dropdown ${this._filterMenuOpen ? "" : "hidden"}">
              ${["all", "colors", "typography", "shadows"]
                .map((fv) => {
                  const labels = {
                    all: "All",
                    colors: "Colors",
                    typography: "Typography",
                    shadows: "Shadows",
                  };
                  return `<button class="dropdown-item sp-filter-menu-item ${this._activeFilter === fv ? "active" : ""}" data-filter="${fv}"><span>${labels[fv]}</span></button>`;
                })
                .join("")}
            </div>
          </div>
        </div>

        <div class="sp-sections-wrap">
          ${
            sections.length === 0
              ? `<div class="sp-empty-state"><p class="empty-msg">${this._searchQuery ? "No styles match your search" : "No styles detected"}</p></div>`
              : sections.map((s) => this._renderSection(s, _e)).join("")
          }
        </div>

        <div class="sidebar-action-area">
          <button id="copyStylesBtn" class="btn-primary btn-copy">
            <img src="assets/icon/icon-download-styles.svg" alt="" width="20" height="20">
            <span>Download Styles</span>
          </button>
        </div>
      </div>
    `;
    this._bindEvents();
  }

  /* ── Section template ────────────────────────────────────────────────── */
  _renderSection(section, _e) {
    const collapsed = this._collapsedSections.has(section.type);
    return `
      <section class="styles-props-section" data-section="${section.type}">
        <div class="sp-section-header" data-toggle="${section.type}">
          <h3 class="section-title sp-section-title">${section.title}<span class="sp-count-badge">${section.count}</span></h3>
          <svg class="sp-chevron ${collapsed ? "collapsed" : ""}" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="sp-section-body ${collapsed ? "sp-collapsed" : ""}">
          ${this._sectionContent(section, _e)}
        </div>
      </section>`;
  }

  _sectionContent(section, _e) {
    switch (section.type) {
      case "colors":
        return this._htmlColors(section.items, _e);
      case "typography":
        return this._htmlTypography(section.items, _e);
      case "spacing":
        return this._htmlSpacing(section.items, _e);
      case "borders":
        return this._htmlBorders(section.items, _e);
      case "radii":
        return this._htmlRadii(section.items, _e);
      case "shadows":
        return this._htmlShadows(section.items, _e);
      default:
        return "";
    }
  }

  /* ── Colors ──────────────────────────────────────────────────────────── */
  _htmlColors(colors, _e) {
    return `<div class="styles-grid">${colors
      .map((c, i) => {
        const key = "color-" + (c.hex || i);
        const sel = this._selectedStyleKey === key;
        const editing = this._editingKey === key;
        return `
        <div class="style-card sp-style-item ${sel ? "sp-selected" : ""}" data-key="${key}" data-type="color" data-value="${_e(c.hex)}" tabindex="0">
          <div class="color-preview" style="background-color: ${c.hex}">
            <span class="color-hex">${(c.hex || "").toUpperCase()}</span>
          </div>
          <div class="style-info">
            ${
              editing
                ? `<input class="sp-inline-edit sp-edit-name" data-key="${key}" data-field="name" value="${_e(c.name || "Color")}" />`
                : `<span class="style-label sp-editable" data-edit-key="${key}">${_e(c.name || "Color")}</span>`
            }
          </div>
          <div class="sp-style-actions">
            <button class="sp-action-btn sp-apply-btn" data-apply="copy-color" data-value="${_e(c.hex)}" title="Copy color code">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 1.5l-7 7M5 1.5h3.5V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Typography ──────────────────────────────────────────────────────── */
  _htmlTypography(fonts, _e) {
    return `<div class="typography-list">${fonts
      .map((f, idx) => {
        const key =
          "font-" +
          (f.family || "") +
          "-" +
          (f.size || "") +
          "-" +
          (f.weight || "");
        const sel = this._selectedStyleKey === key;
        const family = String(f.family || "Inter").replace(/"/g, "");
        const size = String(f.size || "14px");
        const weight = String(f.weight || "400");
        const lineHeight = String(f.lineHeight || "1.6");
        return `
        <div class="typography-item sp-style-item ${sel ? "sp-selected" : ""} ${idx === fonts.length - 1 ? "last" : ""}" data-key="${key}" data-type="font" tabindex="0">
          <div class="typography-header">
            <span class="type-tag">${_e(f.tag || "Body")}</span>
            <span class="type-meta">${_e(size)} / ${_e(lineHeight)}</span>
          </div>
          <div class="type-preview" style="font-size:${size};line-height:${lineHeight};font-family:&quot;${_e(family)}&quot;;font-weight:${weight};">
            The future of design systems
          </div>
          <div class="sp-style-actions sp-font-actions">
            <span class="sp-font-detail">${_e(family)}, ${_e(weight)}</span>
            <button class="sp-action-btn sp-apply-btn" data-apply="copy-font" data-font-family="${_e(f.family)}" title="Copy font name">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 1.5l-7 7M5 1.5h3.5V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Spacing ─────────────────────────────────────────────────────────── */
  _htmlSpacing(items, _e) {
    const denseClass = items.length >= 10 ? " is-dense" : "";
    return `<div class="spacing-list${denseClass}">${items
      .map((s) => {
        const key = "spacing-" + s.value;
        const sel = this._selectedStyleKey === key;
        const bw = Math.min(s.value, 120);
        const tokenName = (s.name || s.label || `Space ${s.value}`).trim();
        const valueMeta = `${s.value}px${s.label ? ` | ${String(s.label).toUpperCase()}` : ""}`;
        return `
        <div class="spacing-row sp-style-item ${sel ? "sp-selected" : ""}" data-key="${key}" data-type="spacing" data-value="${s.value}" tabindex="0">
          <div class="spacing-bar" style="width:${bw}px"></div>
          <span class="spacing-label">${_e(tokenName)}</span>
          <span class="sp-spacing-name">${_e(valueMeta)}</span>
          <button class="sp-action-btn sp-apply-btn sp-action-small" data-apply="spacing" data-value="${s.value}" title="Apply as padding">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 1.5l-7 7M5 1.5h3.5V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Borders ─────────────────────────────────────────────────────────── */
  _htmlBorders(items, _e) {
    return `<div class="sp-border-list">${items
      .map((b, i) => {
        const key = "border-" + i;
        const sel = this._selectedStyleKey === key;
        return `
          <div class="sp-border-item sp-style-item ${sel ? "sp-selected" : ""}" data-key="${key}" data-type="border" data-value="${_e(b.value)}" tabindex="0">
            <div class="sp-border-preview" style="border:${b.value};width:32px;height:32px;border-radius:4px;"></div>
            <div class="sp-border-info">
              <span class="sp-border-name">${_e(b.name || "Border")}</span>
              <span class="sp-border-value">${_e(b.value)}</span>
            </div>
            <button class="sp-action-btn sp-apply-btn sp-action-small" data-apply="border" data-value="${_e(b.value)}" title="Apply border">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 1.5l-7 7M5 1.5h3.5V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Radius ──────────────────────────────────────────────────────────── */
  _htmlRadii(items, _e) {
    return `<div class="radius-grid">${items
      .map((r) => {
        const key = "radius-" + r.value;
        const sel = this._selectedStyleKey === key;
        const radiusName = r.name || "Radius";
        return `
            <div class="radius-item sp-style-item ${sel ? "sp-selected" : ""}" data-key="${key}" data-type="radius" data-value="${r.value}" tabindex="0">
              <div class="radius-box" style="border-radius:${r.value}px"></div>
              <span class="radius-label">${_e(radiusName)}</span>
              <span class="radius-meta">${r.value}px</span>
            </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Shadows ─────────────────────────────────────────────────────────── */
  _htmlShadows(shadows, _e) {
    return `<div class="sp-shadow-list">${shadows
      .map((s, i) => {
        const key = "shadow-" + i;
        const sel = this._selectedStyleKey === key;
        return `
        <div class="sp-shadow-item sp-style-item ${sel ? "sp-selected" : ""}" data-key="${key}" data-type="shadow" data-value="${_e(s.value)}" tabindex="0">
          <div class="sp-shadow-preview" style="box-shadow:${s.value};"></div>
          <div class="sp-shadow-info">
            <span class="sp-shadow-name">${_e(s.name || "Shadow")}</span>
            <span class="sp-shadow-value">${_e(s.value)}</span>
          </div>
          <button class="sp-action-btn sp-apply-btn sp-action-small" data-apply="shadow" data-value="${_e(s.value)}" data-token="${key}" title="Apply shadow">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 1.5l-7 7M5 1.5h3.5V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      })
      .join("")}</div>`;
  }

  /* ── Event binding ───────────────────────────────────────────────────── */
  _bindEvents() {
    // Search
    const si = this.querySelector(".sp-search-input");
    if (si) {
      si.addEventListener("input", (e) => {
        this._searchQuery = e.target.value;
        this._scheduleRender();
      });
      // Restore cursor position after render
      if (this._searchQuery) {
        requestAnimationFrame(() => {
          const el = this.querySelector(".sp-search-input");
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        });
      }
    }
    const cb = this.querySelector(".sp-search-clear");
    if (cb)
      cb.addEventListener("click", () => {
        this._searchQuery = "";
        this._scheduleRender();
      });

    // Filter icon + menu
    const filterBtn = this.querySelector(".sp-filter-icon-btn");
    if (filterBtn) {
      filterBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._filterMenuOpen = !this._filterMenuOpen;
        this._scheduleRender();
      });
    }
    this.querySelectorAll(".sp-filter-menu-item").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._activeFilter = item.dataset.filter;
        this._filterMenuOpen = false;
        this._scheduleRender();
      });
    });

    // Collapse toggles
    this.querySelectorAll(".sp-section-header").forEach((h) => {
      h.addEventListener("click", () => {
        const t = h.dataset.toggle;
        this._collapsedSections.has(t)
          ? this._collapsedSections.delete(t)
          : this._collapsedSections.add(t);
        this._scheduleRender();
      });
    });

    // Active emphasis is keyboard-focus only via :focus-visible styles.

    // Double-click to edit name
    this.querySelectorAll(".sp-editable").forEach((el) => {
      el.addEventListener("dblclick", () => {
        this._editingKey = el.dataset.editKey;
        this._scheduleRender();
        requestAnimationFrame(() => {
          const inp = this.querySelector(
            `.sp-edit-name[data-key="${this._editingKey}"]`,
          );
          if (inp) {
            inp.focus();
            inp.select();
          }
        });
      });
    });

    // Inline edit commit
    this.querySelectorAll(".sp-inline-edit").forEach((input) => {
      const commit = () => {
        const key = input.dataset.key,
          name = input.value.trim();
        if (name && key) {
          const c = this._styles.colors.find((cl) => "color-" + cl.hex === key);
          if (c) c.name = name;
          const tk = this._tokens.get(key);
          if (tk) tk.name = name;
        }
        this._editingKey = null;
        this._scheduleRender();
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          this._editingKey = null;
          this._scheduleRender();
        }
      });
    });

    // Apply buttons
    this.querySelectorAll(".sp-apply-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const at = btn.dataset.apply,
          tk = btn.dataset.token || "";
        if (at === "copy-color") {
          const colorValue = btn.dataset.value || "";
          this._copyToClipboard(colorValue).then((ok) => {
            this._showFeedback(
              ok
                ? `Copied ${colorValue.toUpperCase()} to clipboard`
                : "Could not copy color code",
            );
          });
        } else if (at === "copy-font") {
          const fontName = (btn.dataset.fontFamily || "").trim() || "Inter";
          this._copyToClipboard(fontName).then((ok) => {
            this._showFeedback(
              ok
                ? `Copied ${fontName} to clipboard`
                : "Could not copy font name",
            );
          });
        } else if (at === "font") {
          this._applyStyleToCanvas(
            "font",
            {
              family: btn.dataset.fontFamily,
              size: btn.dataset.fontSize,
              weight: btn.dataset.fontWeight,
            },
            tk,
          );
        } else {
          this._applyStyleToCanvas(at, btn.dataset.value, tk);
        }
        btn.classList.add("sp-applied");
        setTimeout(() => btn.classList.remove("sp-applied"), 600);
      });
    });

    // Copy full styles payload for Figma workflow
    const copyStylesBtn = this.querySelector("#copyStylesBtn");
    if (copyStylesBtn) {
      copyStylesBtn.addEventListener("click", () => {
        const payload = this._buildStylesExportPayload();
        this.dispatchEvent(
          new CustomEvent("copy-to-figma-styles", {
            bubbles: true,
            composed: true,
            detail: {
              source: "styles-panel",
              styles: payload,
            },
          }),
        );
      });
    }

    // Radius items click to apply
    this.querySelectorAll(".radius-item").forEach((item) => {
      item.addEventListener("click", () =>
        this._applyStyleToCanvas("border-radius", item.dataset.value),
      );
    });
  }
}

customElements.define("styles-panel", StylesPanel);
