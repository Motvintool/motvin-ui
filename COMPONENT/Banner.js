window.MotvinBanner = (function () {
  function ensureStyles() {
    if (document.getElementById("mi-banner-styles")) return;

    const styles = document.createElement("style");
    styles.id = "mi-banner-styles";
    styles.textContent = `
      .mi-product-banner { position: fixed; top: 0; left: 0; z-index: 100; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 44px; padding: 8px 24px; background: linear-gradient(90deg, #874fff 0%, #000 11.538%, #000 87.981%, #874fff 100%); color: #fff; font-family: "Outfit", sans-serif; font-size: 16px; font-weight: 500; line-height: normal; text-align: center; }
      .mi-product-banner p { margin: 0; white-space: nowrap; font-weight: 500; }
      .mi-product-banner a { color: inherit; font-weight: 600; text-decoration: underline; text-underline-position: from-font; }
      .mi-product-banner.is-hidden { display: none; }
      body.mi-has-product-banner .mi-app-shell { top: var(--mi-product-banner-height, 44px); height: calc(100vh - var(--mi-product-banner-height, 44px)); }
      body.mi-has-product-banner.mi-product-banner-hidden .mi-app-shell { top: 0; height: 100vh; }
      @media (max-width: 720px) { .mi-product-banner { align-items: center; flex-wrap: wrap; gap: 2px 8px; padding: 8px 16px; font-size: 13px; } .mi-product-banner p { white-space: normal; } }
    `;
    document.head.appendChild(styles);
  }

  function mount() {
    if (document.getElementById("mi-product-banner")) return;

    const main = document.querySelector(".mi-main");
    const appShell = document.querySelector(".mi-app-shell");
    if (!main || !appShell) return;

    const banner = document.createElement("section");
    banner.id = "mi-product-banner";
    banner.className = "mi-product-banner";
    banner.setAttribute("aria-label", "Motvin beta announcement");
    const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    banner.innerHTML = `<p>Motvin v1 beta is here, explore 345K+ icons, 10.5K logos and 1K+ illustrations in one powerful library.</p><a href="/login?next=${encodeURIComponent(returnUrl)}">Login &rarr;</a>`;
    appShell.insertAdjacentElement("beforebegin", banner);
    document.body.classList.add("mi-has-product-banner");

    const updateBannerHeight = () =>
      document.body.style.setProperty(
        "--mi-product-banner-height",
        `${banner.offsetHeight}px`,
      );
    updateBannerHeight();
    new ResizeObserver(updateBannerHeight).observe(banner);

    let previousScrollTop = main.scrollTop;
    let framePending = false;
    let isHiddenByScroll = false;
    let isAuthenticated = false;
    const syncVisibility = () => {
      const isHidden = isAuthenticated || isHiddenByScroll;
      banner.classList.toggle("is-hidden", isHidden);
      document.body.classList.toggle("mi-product-banner-hidden", isHidden);
    };

    if (window.FirebaseAuthService?.onChange) {
      window.FirebaseAuthService.onChange((user) => {
        isAuthenticated = Boolean(user && !user.isAnonymous);
        if (!isAuthenticated) isHiddenByScroll = false;
        syncVisibility();
      });
    }

    main.addEventListener(
      "scroll",
      () => {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(() => {
          const scrollTop = main.scrollTop;
          const scrollingDown = scrollTop > previousScrollTop;
          const scrollingUp = scrollTop < previousScrollTop;
          if (!isHiddenByScroll && scrollingDown && scrollTop > 8) {
            isHiddenByScroll = true;
          }
          if (isHiddenByScroll && (scrollingUp || scrollTop <= 8)) {
            isHiddenByScroll = false;
          }
          syncVisibility();
          previousScrollTop = scrollTop;
          framePending = false;
        });
      },
      { passive: true },
    );
  }

  function init() {
    ensureStyles();
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  return { init };
})();
