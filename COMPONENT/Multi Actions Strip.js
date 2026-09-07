window.MultiActionsStrip = (function () {
  let hideTimer;
  let activeCopyMenu;
  let activeCopyToggle;
  let activeDownloadMenu;
  let activeDownloadToggle;
  let copyMenuDismissalBound = false;

  function ensureStyles() {
    if (document.getElementById("mi-multi-actions-strip-styles")) return;

    const styles = document.createElement("style");
    styles.id = "mi-multi-actions-strip-styles";
    styles.textContent = `
      .mi-count-row[hidden], .mi-bulk-actions-container[hidden] { display: none; }
      .mi-main-top-wrapper { min-height: 146px; }
      .mi-main-top-wrapper.mi-has-bulk-actions { gap: 16px; }
      .mi-bulk-actions-container { display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; width: 100%; gap: 16px; padding: 12px 0 4px; flex-shrink: 0; }
      .mi-bulk-actions-container:not([hidden]) { animation: mi-bulk-actions-enter 180ms ease-out both; will-change: opacity, transform; }
      .mi-bulk-actions-container.is-leaving { animation: mi-bulk-actions-exit 160ms ease-in both; pointer-events: none; }
      .mi-bulk-summary, .mi-bulk-summary-content, .mi-bulk-controls, .mi-bulk-split-button { display: flex; align-items: center; }
      .mi-bulk-summary { height: 48px; }
      .mi-bulk-check { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 54px; height: 48px; padding: 14px 17px; background: rgba(29, 29, 29, 0.08); border: 0; border-radius: 100px 0 0 100px; cursor: pointer; transition: background 120ms ease, transform 120ms ease; }
      .mi-bulk-check:hover { background: rgba(29, 29, 29, 0.14); }
      .mi-bulk-check:active { background: rgba(29, 29, 29, 0.2); transform: scale(0.97); }
      .mi-bulk-check img { width: 20px; height: 20px; }
      .mi-bulk-partial { width: 12px; height: 2px; background: #1d1d1d; border-radius: 2px; }
      .mi-bulk-summary-content { box-sizing: border-box; height: 48px; gap: 32px; padding: 14px 20px 14px 14px; background: white; border: 2px solid rgba(29, 29, 29, 0.08); border-left: 0; border-radius: 0 100px 100px 0; font-family: "Outfit", sans-serif; font-size: 14px; line-height: 18px; white-space: nowrap; }
      .mi-bulk-summary-content strong { font-weight: 600; color: #000; }
      .mi-bulk-summary-content img { width: 1px; height: 16px; }
      .mi-bulk-summary-content span { display: flex; gap: 4px; color: #2c2e36; }
      .mi-bulk-summary-content b { color: rgba(0, 0, 0, 0.9); font-size: 15px; }
      .mi-bulk-summary-content em { color: #1d1d1d; font-style: normal; font-weight: 500; }
      .mi-bulk-controls { gap: 8px; }
      .mi-bulk-copy-group { position: relative; z-index: 1000; }
      .mi-bulk-split-button { height: 48px; padding: 0; border: 0; border-radius: 100px; overflow: hidden; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; }
      .mi-bulk-split-button span, .mi-bulk-split-button img { box-sizing: border-box; height: 48px; }
      .mi-bulk-split-button span { display: flex; align-items: center; padding: 0 22px 0 26px; }
      .mi-bulk-split-button img { width: 42px; padding: 16px 14px 16px 12px; border-left: 1px solid rgba(255, 255, 255, 0.3); }
      .mi-bulk-copy { background: #1da25a; color: white; }
      .mi-bulk-copy-main, .mi-bulk-copy-toggle { height: 48px; color: inherit; background: transparent; border: 0; cursor: pointer; font: inherit; transition: background 160ms ease; }
      .mi-bulk-copy-main { padding: 0 22px 0 26px; }
      .mi-bulk-copy-main:hover { background: #168a4a; }
      .mi-bulk-copy-main:active { background: #11723d; }
      .mi-bulk-copy-toggle { display: grid; place-items: center; width: 42px; padding: 0; border-left: 1px solid rgba(255, 255, 255, 0.3); }
      .mi-bulk-copy-toggle:hover { background: #168a4a; }
      .mi-bulk-copy-toggle:active { background: #11723d; }
      .mi-bulk-copy-toggle img { display: block; width: 16px; height: 16px; padding: 0; border: 0; }
      .mi-category-menu.mi-bulk-copy-menu { position: fixed; z-index: 10000; width: auto; }
      .mi-bulk-download-group { position: relative; z-index: 1000; }
      .mi-bulk-download { background: #e5e5e5; color: #000; }
      .mi-bulk-download-main, .mi-bulk-download-toggle { height: 48px; color: inherit; background: transparent; border: 0; cursor: pointer; font: inherit; transition: background 160ms ease; }
      .mi-bulk-download-main { padding: 0 22px 0 26px; }
      .mi-bulk-download-main:hover, .mi-bulk-download-toggle:hover { background: #d4d4d4; }
      .mi-bulk-download-main:active, .mi-bulk-download-toggle:active { background: #c9c9c9; }
      .mi-bulk-download-toggle { display: grid; place-items: center; width: 42px; padding: 0; border-left: 1px solid #d5d5d5; }
      .mi-bulk-download-toggle img { display: block; width: 16px; height: 16px; padding: 0; border: 0; }
      .mi-category-menu.mi-bulk-download-menu { position: fixed; z-index: 10000; width: auto; }
      .mi-bulk-more { display: grid; place-items: center; box-sizing: border-box; width: 48px; height: 48px; padding: 12px; background: white; border: 1.5px solid rgba(0, 0, 0, 0.08); border-radius: 50%; cursor: pointer; }
      .mi-bulk-more img { width: 20px; height: 20px; }
      @keyframes mi-bulk-actions-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes mi-bulk-actions-exit { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .mi-bulk-actions-container:not([hidden]), .mi-bulk-actions-container.is-leaving { animation: none; } }
      @media (max-width: 860px) { .mi-bulk-actions-container { align-items: flex-start; flex-direction: column; } .mi-bulk-summary-content { gap: 12px; } }
    `;
    document.head.appendChild(styles);

    if (!copyMenuDismissalBound) {
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".mi-bulk-copy-group") && activeCopyMenu) {
          activeCopyMenu.classList.remove("is-open");
          activeCopyToggle?.setAttribute("aria-expanded", "false");
          activeCopyMenu = null;
          activeCopyToggle = null;
        }
        if (
          !event.target.closest(".mi-bulk-download-group") &&
          activeDownloadMenu
        ) {
          activeDownloadMenu.classList.remove("is-open");
          activeDownloadToggle?.setAttribute("aria-expanded", "false");
          activeDownloadMenu = null;
          activeDownloadToggle = null;
        }
      });
      copyMenuDismissalBound = true;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"]/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
    );
  }

  function render({
    items,
    resultCount,
    query,
    allSelected,
    onToggleAll,
    onCopy,
    onDownload,
    onClear,
  }) {
    ensureStyles();
    const countRow = document.querySelector(".mi-count-row");
    const gridScroll = document.getElementById("grid-scroll");
    if (!countRow || !gridScroll) return;

    let container = document.getElementById("bulk-actions-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bulk-actions-container";
      container.className = "mi-bulk-actions-container";
      container.hidden = true;
      countRow.insertAdjacentElement("beforebegin", container);
    }

    const hasSelection = items.length > 0;
    const topWrapper = countRow.closest(".mi-main-top-wrapper");
    if (!hasSelection) {
      if (container.hidden || container.classList.contains("is-leaving"))
        return;

      container.classList.add("is-leaving");
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        container.hidden = true;
        container.classList.remove("is-leaving");
        countRow.hidden = false;
        topWrapper?.classList.remove("mi-has-bulk-actions");
      }, 160);
      return;
    }

    clearTimeout(hideTimer);
    container.classList.remove("is-leaving");
    countRow.hidden = true;
    container.hidden = false;
    topWrapper?.classList.add("mi-has-bulk-actions");

    const queryLabel = query
      ? `icons found for <em>\u201c${escapeHtml(query)}\u201d</em>`
      : "icons found";
    const selectToggleLabel = allSelected
      ? "Deselect all visible icons"
      : "Select all visible icons";
    const selectToggleIcon = allSelected
      ? '<img src="ASSET/Icons/bulk-summary-selected.svg" alt="" />'
      : '<span class="mi-bulk-partial" aria-hidden="true"></span>';
    container.innerHTML = `
      <div class="mi-bulk-summary">
        <button class="mi-bulk-check" data-bulk-action="toggle-all" type="button" title="${selectToggleLabel}" aria-label="${selectToggleLabel}">${selectToggleIcon}</button>
        <div class="mi-bulk-summary-content">
          <strong>${items.length} Selected</strong>
          <img src="ASSET/Icons/bulk-summary-divider.svg" alt="" />
          <span><b>${resultCount}</b> ${queryLabel}</span>
        </div>
      </div>
      <div class="mi-bulk-controls">
        <div class="mi-bulk-copy-group">
          <div class="mi-bulk-split-button mi-bulk-copy">
            <button class="mi-bulk-copy-main" data-bulk-action="copy" type="button">Copy SVG</button>
            <button class="mi-bulk-copy-toggle" data-bulk-action="copy-toggle" type="button" aria-label="Choose copy format" aria-expanded="false"><img src="ASSET/Icons/bulk-chevron-white.svg" alt="" /></button>
          </div>
          <div class="mi-category-menu mi-bulk-copy-menu" role="menu">
            <div class="mi-category-menu-inner">
              <button class="mi-category-menu-item is-active" data-copy-format="svg" role="menuitem">SVG</button>
              <button class="mi-category-menu-item" data-copy-format="jsx" role="menuitem">JSX / React</button>
              <button class="mi-category-menu-item" data-copy-format="vue" role="menuitem">Vue</button>
              <button class="mi-category-menu-item" data-copy-format="html" role="menuitem">HTML &lt;img&gt;</button>
              <button class="mi-category-menu-item" data-copy-format="css" role="menuitem">CSS mask URL</button>
              <button class="mi-category-menu-item" data-copy-format="dataurl" role="menuitem">Data URL</button>
              <button class="mi-category-menu-item" data-copy-format="base64" role="menuitem">Base64 SVG</button>
            </div>
          </div>
        </div>
        <div class="mi-bulk-download-group">
          <div class="mi-bulk-split-button mi-bulk-download">
            <button class="mi-bulk-download-main" data-bulk-action="download" type="button">Download SVG</button>
            <button class="mi-bulk-download-toggle" data-bulk-action="download-toggle" type="button" aria-label="Choose download format" aria-expanded="false"><img src="ASSET/Icons/bulk-chevron-black.svg" alt="" /></button>
          </div>
          <div class="mi-category-menu mi-bulk-download-menu" role="menu">
            <div class="mi-category-menu-inner">
              <button class="mi-category-menu-item is-active" data-download-format="svg" role="menuitem">Download SVG</button>
              <button class="mi-category-menu-item" data-download-format="png" role="menuitem">Download PNG</button>
            </div>
          </div>
        </div>
        <button class="mi-bulk-more" data-bulk-action="clear" type="button" title="Clear selection"><img src="ASSET/Icons/bulk-more.svg" alt="" /></button>
      </div>
    `;

    container
      .querySelector('[data-bulk-action="toggle-all"]')
      .addEventListener("click", onToggleAll);
    const copyButton = container.querySelector('[data-bulk-action="copy"]');
    const copyToggle = container.querySelector(
      '[data-bulk-action="copy-toggle"]',
    );
    const copyGroup = container.querySelector(".mi-bulk-copy-group");
    const copyMenu = container.querySelector(".mi-bulk-copy-menu");
    const closeCopyMenu = () => {
      copyMenu.classList.remove("is-open");
      copyToggle.setAttribute("aria-expanded", "false");
      if (copyMenu.parentElement === document.body) copyGroup.append(copyMenu);
      if (activeCopyMenu === copyMenu) {
        activeCopyMenu = null;
        activeCopyToggle = null;
      }
    };
    copyButton.addEventListener("click", () =>
      onCopy(copyButton.dataset.format || "svg"),
    );
    copyToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = copyMenu.classList.toggle("is-open");
      copyToggle.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        document.body.append(copyMenu);
        copyMenu.style.width = `${copyGroup.getBoundingClientRect().width}px`;
        const toggleBounds = copyToggle.getBoundingClientRect();
        copyMenu.style.top = `${toggleBounds.bottom + 8}px`;
        copyMenu.style.left = `${toggleBounds.right - copyMenu.offsetWidth}px`;
      } else {
        closeCopyMenu();
      }
      activeCopyMenu = isOpen ? copyMenu : null;
      activeCopyToggle = isOpen ? copyToggle : null;
    });
    copyMenu.addEventListener("click", (event) => {
      const formatButton = event.target.closest("[data-copy-format]");
      if (!formatButton) return;
      const format = formatButton.dataset.copyFormat;
      copyButton.dataset.format = format;
      copyButton.textContent = `Copy ${formatButton.textContent.trim().replace(" / React", "")}`;
      copyMenu
        .querySelectorAll("[data-copy-format]")
        .forEach((button) =>
          button.classList.toggle("is-active", button === formatButton),
        );
      closeCopyMenu();
    });
    const downloadButton = container.querySelector(
      '[data-bulk-action="download"]',
    );
    const downloadToggle = container.querySelector(
      '[data-bulk-action="download-toggle"]',
    );
    const downloadGroup = container.querySelector(".mi-bulk-download-group");
    const downloadMenu = container.querySelector(".mi-bulk-download-menu");
    const closeDownloadMenu = () => {
      downloadMenu.classList.remove("is-open");
      downloadToggle.setAttribute("aria-expanded", "false");
      if (downloadMenu.parentElement === document.body)
        downloadGroup.append(downloadMenu);
      if (activeDownloadMenu === downloadMenu) {
        activeDownloadMenu = null;
        activeDownloadToggle = null;
      }
    };
    downloadButton.addEventListener("click", () =>
      onDownload(downloadButton.dataset.format || "svg"),
    );
    downloadToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = downloadMenu.classList.toggle("is-open");
      downloadToggle.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        document.body.append(downloadMenu);
        downloadMenu.style.width = `${downloadGroup.getBoundingClientRect().width}px`;
        const toggleBounds = downloadToggle.getBoundingClientRect();
        downloadMenu.style.top = `${toggleBounds.bottom + 8}px`;
        downloadMenu.style.left = `${toggleBounds.right - downloadMenu.offsetWidth}px`;
      } else {
        closeDownloadMenu();
      }
      activeDownloadMenu = isOpen ? downloadMenu : null;
      activeDownloadToggle = isOpen ? downloadToggle : null;
    });
    downloadMenu.addEventListener("click", (event) => {
      const formatButton = event.target.closest("[data-download-format]");
      if (!formatButton) return;
      const format = formatButton.dataset.downloadFormat;
      downloadButton.dataset.format = format;
      downloadButton.textContent = formatButton.textContent.trim();
      downloadMenu
        .querySelectorAll("[data-download-format]")
        .forEach((button) =>
          button.classList.toggle("is-active", button === formatButton),
        );
      closeDownloadMenu();
    });
    container
      .querySelector('[data-bulk-action="clear"]')
      .addEventListener("click", onClear);
  }

  return { render };
})();
