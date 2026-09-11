window.MultiActionsStrip = (function () {
  let hideTimer;
  let activeCopyMenu;
  let activeCopyToggle;
  let activeCopyGroup;
  let activeDownloadMenu;
  let activeDownloadToggle;
  let activeDownloadGroup;
  let activeMoreMenu;
  let activeMoreButton;
  let activeMoreGroup;
  let copyMenuDismissalBound = false;

  function restorePortaledMenu(menu, toggle, group) {
    if (!menu) return;
    menu.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    if (menu.parentElement === document.body && group) group.append(menu);
  }

  function closeActivePortaledMenus() {
    restorePortaledMenu(activeCopyMenu, activeCopyToggle, activeCopyGroup);
    restorePortaledMenu(
      activeDownloadMenu,
      activeDownloadToggle,
      activeDownloadGroup,
    );
    restorePortaledMenu(activeMoreMenu, activeMoreButton, activeMoreGroup);
    activeCopyMenu = null;
    activeCopyToggle = null;
    activeCopyGroup = null;
    activeDownloadMenu = null;
    activeDownloadToggle = null;
    activeDownloadGroup = null;
    activeMoreMenu = null;
    activeMoreButton = null;
    activeMoreGroup = null;
  }

  function ensureStyles() {
    if (document.getElementById("mi-multi-actions-strip-styles")) return;

    const styles = document.createElement("style");
    styles.id = "mi-multi-actions-strip-styles";
    styles.textContent = `
      .mi-bulk-actions-container[hidden] { display: none; }
      .mi-sidebar-collapse-toggle { position: fixed; z-index: 30; top: 50%; left: calc(var(--left-sidebar-w) + 9px); display: grid; place-items: center; width: 16px; height: 40px; padding: 0; background: transparent; border: 0; cursor: pointer; transform: translateY(-50%); transition: left 160ms ease; }
      .mi-sidebar-collapse-toggle:hover img { filter: brightness(0.682); }
      .mi-sidebar-collapse-toggle img { display: block; width: 7px; height: 24px; transition: filter 160ms ease; }
      body.mi-sidebar-collapsed .mi-app-shell { grid-template-columns: minmax(0, 1fr) var(--right-panel-w); }
      body.mi-sidebar-collapsed .mi-left-sidebar { display: none; }
      body.mi-sidebar-collapsed .mi-sidebar-collapse-toggle { left: 9px; transform: translateY(-50%) scaleX(-1); }
      .mi-rp-navigation { display: none; align-items: center; gap: 0; padding: 4px; background: rgba(64, 64, 64, 0.08); border-radius: 999px; }
      .mi-rp-navigation button { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 7.5px 12px; color: #878787; background: transparent; border: 0; border-radius: 999px; font: 400 15px/20px "Outfit", sans-serif; letter-spacing: 0.2px; cursor: pointer; }
      .mi-rp-navigation button.is-active { padding: 6px 6px 6px 12px; color: #141414; background: #fff; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04); font-weight: 500; }
      .mi-rp-navigation-count { display: none; align-items: center; justify-content: center; width: 23px; height: 23px; color: #000; background: rgba(0, 0, 0, 0.12); border-radius: 999px; font: 500 14px/normal "Outfit", sans-serif; }
      .mi-rp-navigation button.is-active .mi-rp-navigation-count { display: flex; }
      body.mi-sidebar-collapsed .mi-rp-heading { display: none !important; }
      body.mi-sidebar-collapsed .mi-rp-navigation { display: flex; }
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
      .mi-bulk-summary-content { box-sizing: border-box; height: 48px; gap: 32px; padding: 14px 20px 14px 14px; background: white; border: 2px solid rgba(29, 29, 29, 0.08); border-left: 0; border-radius: 0 100px 100px 0; font-family: "Outfit", sans-serif; font-size: 16px; line-height: 18px; white-space: nowrap; }
      .mi-bulk-summary-content strong { font-weight: 600; color: #000; }
      .mi-bulk-summary-content img { width: 1px; height: 16px; }
      .mi-bulk-summary-content span { display: flex; gap: 4px; color: #2c2e36; }
      .mi-bulk-summary-content b { color: rgba(0, 0, 0, 0.9); font-size: 16px; }
      .mi-bulk-summary-content em { color: #1d1d1d; font-style: normal; font-weight: 500; }
      .mi-bulk-controls { gap: 8px; }
      .mi-bulk-copy-group { position: relative; z-index: 1000; }
      .mi-bulk-split-button { height: 48px; padding: 0; border: 0; border-radius: 100px; overflow: hidden; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 500; cursor: pointer; }
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
      .mi-bulk-more-group { position: relative; z-index: 1000; }
      .mi-bulk-more { display: grid; place-items: center; box-sizing: border-box; width: 48px; height: 48px; padding: 12px; background: white; border: 1.5px solid rgba(0, 0, 0, 0.08); border-radius: 50%; cursor: pointer; transition: background 160ms ease; }
      .mi-bulk-more:hover, .mi-bulk-more[aria-expanded="true"] { background: rgba(0, 0, 0, 0.04); }
      .mi-bulk-more img { width: 20px; height: 20px; }
      .mi-category-menu.mi-bulk-more-menu { position: fixed; z-index: 10000; width: 200px; }
      .mi-bulk-more-menu [data-bulk-more-action="clear"] { color: #ff3737; }
      .mi-bulk-more-menu [data-bulk-more-action="clear"]:hover { background: #ffe8e8; }
      @keyframes mi-bulk-actions-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes mi-bulk-actions-exit { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .mi-bulk-actions-container:not([hidden]), .mi-bulk-actions-container.is-leaving { animation: none; } }
      @media (max-width: 860px) { .mi-bulk-actions-container { align-items: flex-start; flex-direction: column; } .mi-bulk-summary-content { gap: 12px; } }
    `;
    document.head.appendChild(styles);

    if (!copyMenuDismissalBound) {
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".mi-bulk-copy-group") && activeCopyMenu) {
          restorePortaledMenu(
            activeCopyMenu,
            activeCopyToggle,
            activeCopyGroup,
          );
          activeCopyMenu = null;
          activeCopyToggle = null;
          activeCopyGroup = null;
        }
        if (
          !event.target.closest(".mi-bulk-download-group") &&
          activeDownloadMenu
        ) {
          restorePortaledMenu(
            activeDownloadMenu,
            activeDownloadToggle,
            activeDownloadGroup,
          );
          activeDownloadMenu = null;
          activeDownloadToggle = null;
          activeDownloadGroup = null;
        }
        if (!event.target.closest(".mi-bulk-more-group") && activeMoreMenu) {
          restorePortaledMenu(
            activeMoreMenu,
            activeMoreButton,
            activeMoreGroup,
          );
          activeMoreMenu = null;
          activeMoreButton = null;
          activeMoreGroup = null;
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

  function setupCollapsedSidebarNavigation() {
    const appShell = document.querySelector(".mi-app-shell");
    const sidebar = document.querySelector(".mi-left-sidebar");
    const header = document.querySelector(".mi-rp-header");
    if (
      !appShell ||
      !sidebar ||
      !header ||
      document.querySelector(".mi-sidebar-collapse-toggle")
    )
      return;

    const collapseToggle = document.createElement("button");
    collapseToggle.className = "mi-sidebar-collapse-toggle";
    collapseToggle.type = "button";
    collapseToggle.title = "Collapse sidebar";
    collapseToggle.setAttribute("aria-label", "Collapse sidebar");
    collapseToggle.setAttribute("aria-expanded", "true");
    collapseToggle.innerHTML =
      '<img src="ASSET/Icons/sidebar-collapse-arrow.svg" alt="" />';
    document.body.append(collapseToggle);

    header.firstElementChild?.classList.add("mi-rp-heading");
    const navigation = document.createElement("nav");
    navigation.className = "mi-rp-navigation";
    navigation.setAttribute("aria-label", "Panel navigation");
    navigation.innerHTML = `
      <button class="is-active" data-rp-navigation="filters" type="button">Filters <span class="mi-rp-navigation-count" aria-hidden="true">0</span></button>
      <button data-rp-navigation="categories" type="button">Packs</button>
      <button data-rp-navigation="saved" type="button">Saved</button>
    `;
    header.prepend(navigation);

    const syncNavigation = () => {
      const activeTab = sidebar.querySelector(".mi-sidebar-item.is-active");
      const activeTarget = activeTab?.dataset.sidebar || "filters";
      navigation
        .querySelectorAll("[data-rp-navigation]")
        .forEach((button) =>
          button.classList.toggle(
            "is-active",
            button.dataset.rpNavigation === activeTarget,
          ),
        );
    };
    new MutationObserver(syncNavigation).observe(sidebar, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    syncNavigation();

    const setCollapsed = (collapsed) => {
      document.body.classList.toggle("mi-sidebar-collapsed", collapsed);
      collapseToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
      collapseToggle.setAttribute("aria-label", collapseToggle.title);
      collapseToggle.setAttribute("aria-expanded", String(!collapsed));
    };

    collapseToggle.addEventListener("click", () =>
      setCollapsed(!document.body.classList.contains("mi-sidebar-collapsed")),
    );
    navigation.addEventListener("click", (event) => {
      const navigationButton = event.target.closest("[data-rp-navigation]");
      if (!navigationButton) return;
      const target = navigationButton.dataset.rpNavigation;
      sidebar.querySelector(`[data-sidebar="${target}"]`)?.click();
      syncNavigation();
    });
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
    const topWrapper = document.querySelector(".mi-main-top-wrapper");
    if (!topWrapper) return;

    let container = document.getElementById("bulk-actions-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bulk-actions-container";
      container.className = "mi-bulk-actions-container";
      container.hidden = true;
      topWrapper.appendChild(container);
    }

    const hasSelection = items.length > 0;
    if (!hasSelection) {
      if (container.hidden || container.classList.contains("is-leaving"))
        return;

      container.classList.add("is-leaving");
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        container.hidden = true;
        container.classList.remove("is-leaving");
        topWrapper?.classList.remove("mi-has-bulk-actions");
      }, 160);
      return;
    }

    clearTimeout(hideTimer);
    container.classList.remove("is-leaving");
    container.hidden = false;
    topWrapper?.classList.add("mi-has-bulk-actions");
    closeActivePortaledMenus();

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
        <div class="mi-bulk-more-group">
          <button class="mi-bulk-more" data-bulk-action="more" type="button" title="Selection options" aria-label="Selection options" aria-expanded="false"><img src="ASSET/Icons/bulk-more.svg" alt="" /></button>
          <div class="mi-category-menu mi-bulk-more-menu" role="menu">
            <div class="mi-category-menu-inner">
              <button class="mi-category-menu-item" data-bulk-more-action="new-collection" role="menuitem">New collection</button>
              <button class="mi-category-menu-item" data-bulk-more-action="add-to-collection" role="menuitem">Add to collection</button>
              <button class="mi-category-menu-item" data-bulk-more-action="clear" role="menuitem">Clear selection</button>
            </div>
          </div>
        </div>
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
        activeCopyGroup = null;
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
      activeCopyGroup = isOpen ? copyGroup : null;
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
        activeDownloadGroup = null;
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
      activeDownloadGroup = isOpen ? downloadGroup : null;
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
    const moreButton = container.querySelector('[data-bulk-action="more"]');
    const moreGroup = container.querySelector(".mi-bulk-more-group");
    const moreMenu = container.querySelector(".mi-bulk-more-menu");
    const closeMoreMenu = () => {
      moreMenu.classList.remove("is-open");
      moreButton.setAttribute("aria-expanded", "false");
      if (moreMenu.parentElement === document.body) moreGroup.append(moreMenu);
      if (activeMoreMenu === moreMenu) {
        activeMoreMenu = null;
        activeMoreButton = null;
        activeMoreGroup = null;
      }
    };
    moreButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = moreMenu.classList.toggle("is-open");
      moreButton.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        document.body.append(moreMenu);
        const buttonBounds = moreButton.getBoundingClientRect();
        moreMenu.style.top = `${buttonBounds.bottom + 8}px`;
        moreMenu.style.left = `${buttonBounds.right - moreMenu.offsetWidth}px`;
      } else {
        closeMoreMenu();
      }
      activeMoreMenu = isOpen ? moreMenu : null;
      activeMoreButton = isOpen ? moreButton : null;
      activeMoreGroup = isOpen ? moreGroup : null;
    });
    moreMenu.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-bulk-more-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.bulkMoreAction;
      if (action === "clear") onClear();
      if (action === "add-to-collection") {
        const item = items[0];
        if (item) window.CollectionManager?.openModal(item.id, item);
      }
      if (action === "new-collection") {
        const item = items[0];
        if (item) {
          window.CollectionManager?.openModal(item.id, item);
          document.getElementById("coll-new-btn")?.click();
        }
      }
      closeMoreMenu();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setupCollapsedSidebarNavigation,
    );
  } else {
    setupCollapsedSidebarNavigation();
  }

  return { render };
})();
