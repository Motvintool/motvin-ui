window.MotvinBanner = (function () {
  const BANNER_COPY =
    "Motvin v1 beta is here, explore 345K+ icons, 10.5K logos and 1K+ illustrations in one powerful library.";

  // The banner ships in each page's markup so it paints with the first frame,
  // and its styles live in the page stylesheet for the same reason. This only
  // builds a banner for a page that doesn't already provide one.
  function createBanner(appShell) {
    const banner = document.createElement("section");
    banner.id = "mi-product-banner";
    banner.className = "mi-product-banner";
    banner.setAttribute("aria-label", "Motvin beta announcement");
    banner.innerHTML = `<p>${BANNER_COPY}</p><a href="/login">Login &rarr;</a>`;
    appShell.insertAdjacentElement("beforebegin", banner);
    return banner;
  }

  // Each page's head script decides before first paint whether to reserve the
  // banner's space, and records that in .mi-banner-reserved on <html>. Honour
  // that decision rather than re-reading the auth snapshot: firebase-auth.js
  // can rewrite the snapshot between the head script and this mount, and any
  // disagreement between the two is exactly the shell jump we're avoiding.
  function isBannerSpaceReserved() {
    return document.documentElement.classList.contains("mi-banner-reserved");
  }

  function mount() {
    const main = document.querySelector(".mi-main");
    const appShell = document.querySelector(".mi-app-shell");
    if (!main || !appShell) return;

    // Adopt the banner the page already rendered, falling back to building one.
    const banner =
      document.getElementById("mi-product-banner") || createBanner(appShell);
    if (banner.dataset.miBannerWired) return;
    banner.dataset.miBannerWired = "1";

    // The return URL can only be filled in at runtime, so the markup ships a
    // bare /login and it gets completed here.
    const loginLink = banner.querySelector("a");
    if (loginLink) {
      const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      loginLink.href = `/login?next=${encodeURIComponent(returnUrl)}`;
    }
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
    let isAuthenticated = !isBannerSpaceReserved();

    // Refreshing a scrolled page makes the browser restore the scroll position
    // after mount, which arrives as a scroll event with no user behind it.
    // Reading that as a downward scroll would hide the banner on load, so only
    // let scrolling hide it once there has been real input.
    let hasUserScrolled = false;
    ["wheel", "touchmove", "keydown", "pointerdown"].forEach((type) =>
      main.addEventListener(
        type,
        () => {
          hasUserScrolled = true;
        },
        { passive: true },
      ),
    );
    const syncVisibility = () => {
      const isHidden = isAuthenticated || isHiddenByScroll;
      banner.classList.toggle("is-hidden", isHidden);
      document.body.classList.toggle("mi-product-banner-hidden", isHidden);
    };
    syncVisibility();

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
          if (!hasUserScrolled) {
            // Scroll restoration: take it as the new baseline, nothing more.
            previousScrollTop = scrollTop;
            framePending = false;
            return;
          }
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
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  return { init };
})();
