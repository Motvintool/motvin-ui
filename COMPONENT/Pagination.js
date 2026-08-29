window.Pagination = (function () {
  function ensureElements() {
    let wrapper = document.getElementById("pagination-wrapper");
    let bar = document.getElementById("pagination-bar");

    if (wrapper && bar) return { wrapper, bar };

    const gridScroll = document.getElementById("grid-scroll");
    if (!gridScroll) return null;

    wrapper = document.createElement("div");
    wrapper.className = "mi-pagination-wrapper";
    wrapper.id = "pagination-wrapper";
    wrapper.style.display = "none";

    bar = document.createElement("div");
    bar.className = "mi-pagination-bar";
    bar.id = "pagination-bar";

    wrapper.appendChild(bar);
    gridScroll.insertAdjacentElement("afterend", wrapper);
    return { wrapper, bar };
  }

  function getPages(page, totalPages) {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (page <= 3) return [1, 2, 3, 4, "...", totalPages];
    if (page >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }

  function render({ page, totalPages, onPageChange }) {
    const elements = ensureElements();
    if (!elements) return;

    const { wrapper, bar } = elements;
    if (totalPages <= 1) {
      wrapper.style.display = "none";
      return;
    }

    wrapper.style.display = "flex";
    const pageButtons = getPages(page, totalPages)
      .map((item) =>
        item === "..."
          ? '<div class="mi-page-btn" style="cursor:default; background:none;">...</div>'
          : `<div class="mi-page-btn ${item === page ? "is-active" : ""}" data-page="${item}">${item}</div>`,
      )
      .join("");

    bar.innerHTML = `
      <button class="mi-page-nav-btn" id="btn-page-prev" ${page === 1 ? "disabled" : ""}>
        <img src="ASSET/Icons/icons-navigate.svg" style="transform: rotate(180deg);" alt=""/>
        <span>Prev</span>
      </button>
      ${pageButtons}
      <button class="mi-page-nav-btn is-next" id="btn-page-next" ${page === totalPages ? "disabled" : ""}>
        <span>Next</span>
        <img src="ASSET/Icons/icons-navigate.svg" alt=""/>
      </button>
    `;

    function changePage(nextPage) {
      if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
      onPageChange(nextPage);
    }

    document.getElementById("btn-page-prev").addEventListener("click", () => changePage(page - 1));
    document.getElementById("btn-page-next").addEventListener("click", () => changePage(page + 1));
    bar.querySelectorAll(".mi-page-btn[data-page]").forEach((button) => {
      button.addEventListener("click", () => changePage(Number(button.dataset.page)));
    });
  }

  return { render };
})();
