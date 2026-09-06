window.MultiActionsStrip = (function () {
  let hideTimer;

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
      .mi-bulk-check { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 54px; height: 48px; padding: 14px 17px; background: #ebe9fc; border: 0; border-radius: 100px 0 0 100px; cursor: pointer; }
      .mi-bulk-check img { width: 20px; height: 20px; }
      .mi-bulk-partial { width: 12px; height: 2px; background: #5c4ae4; border-radius: 2px; }
      .mi-bulk-summary-content { box-sizing: border-box; height: 48px; gap: 32px; padding: 14px 20px 14px 14px; background: white; border: 1.5px solid #ebe9fc; border-left: 0; border-radius: 0 100px 100px 0; font-family: "Outfit", sans-serif; font-size: 14px; line-height: 18px; white-space: nowrap; }
      .mi-bulk-summary-content strong { font-weight: 600; color: #000; }
      .mi-bulk-summary-content img { width: 1px; height: 16px; }
      .mi-bulk-summary-content span { display: flex; gap: 4px; color: #2c2e36; }
      .mi-bulk-summary-content b { color: rgba(0, 0, 0, 0.9); font-size: 15px; }
      .mi-bulk-summary-content em { color: #5c4ae4; font-style: normal; font-weight: 500; }
      .mi-bulk-controls { gap: 8px; }
      .mi-bulk-split-button { height: 48px; padding: 0; border: 0; border-radius: 100px; overflow: hidden; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; }
      .mi-bulk-split-button span, .mi-bulk-split-button img { box-sizing: border-box; height: 48px; }
      .mi-bulk-split-button span { display: flex; align-items: center; padding: 0 22px 0 26px; }
      .mi-bulk-split-button img { width: 42px; padding: 16px 14px 16px 12px; border-left: 1px solid rgba(255, 255, 255, 0.3); }
      .mi-bulk-copy { background: #1da25a; color: white; }
      .mi-bulk-download { background: #e5e5e5; color: #000; }
      .mi-bulk-download img { border-left-color: #d5d5d5; }
      .mi-bulk-more { display: grid; place-items: center; box-sizing: border-box; width: 48px; height: 48px; padding: 12px; background: white; border: 1.5px solid rgba(0, 0, 0, 0.08); border-radius: 50%; cursor: pointer; }
      .mi-bulk-more img { width: 20px; height: 20px; }
      @keyframes mi-bulk-actions-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes mi-bulk-actions-exit { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .mi-bulk-actions-container:not([hidden]), .mi-bulk-actions-container.is-leaving { animation: none; } }
      @media (max-width: 860px) { .mi-bulk-actions-container { align-items: flex-start; flex-direction: column; } .mi-bulk-summary-content { gap: 12px; } }
    `;
    document.head.appendChild(styles);
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
      ? '<img src="ASSET/Icons/bulk-selected-check.svg" alt="" />'
      : '<span class="mi-bulk-partial" aria-hidden="true"></span>';
    container.innerHTML = `
      <div class="mi-bulk-summary">
        <button class="mi-bulk-check" data-bulk-action="toggle-all" type="button" title="${selectToggleLabel}" aria-label="${selectToggleLabel}">${selectToggleIcon}</button>
        <div class="mi-bulk-summary-content">
          <strong>${items.length} Selected</strong>
          <img src="ASSET/Icons/bulk-divider.svg" alt="" />
          <span><b>${resultCount}</b> ${queryLabel}</span>
        </div>
      </div>
      <div class="mi-bulk-controls">
        <button class="mi-bulk-split-button mi-bulk-copy" data-bulk-action="copy" type="button"><span>Copy SVG</span><img src="ASSET/Icons/bulk-chevron-white.svg" alt="" /></button>
        <button class="mi-bulk-split-button mi-bulk-download" data-bulk-action="download" type="button"><span>Download SVG</span><img src="ASSET/Icons/bulk-chevron-black.svg" alt="" /></button>
        <button class="mi-bulk-more" data-bulk-action="clear" type="button" title="Clear selection"><img src="ASSET/Icons/bulk-more.svg" alt="" /></button>
      </div>
    `;

    container
      .querySelector('[data-bulk-action="toggle-all"]')
      .addEventListener("click", onToggleAll);
    container
      .querySelector('[data-bulk-action="copy"]')
      .addEventListener("click", onCopy);
    container
      .querySelector('[data-bulk-action="download"]')
      .addEventListener("click", onDownload);
    container
      .querySelector('[data-bulk-action="clear"]')
      .addEventListener("click", onClear);
  }

  return { render };
})();
