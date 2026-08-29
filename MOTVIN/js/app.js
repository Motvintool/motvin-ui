const createFirebaseUrlBetaCreditService = window.createFirebaseUrlBetaCreditService;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const RUNTIME_ENV =
  typeof globalThis !== "undefined" &&
  globalThis.__MOTVIN_ENV__ &&
  typeof globalThis.__MOTVIN_ENV__ === "object"
    ? globalThis.__MOTVIN_ENV__
    : {};
const DISABLE_PROTECTION =
  String(RUNTIME_ENV.DISABLE_PROTECTION || "false").trim().toLowerCase() === "true";
const SERVICE_WORKER_BUILD_STAMP =
  String(RUNTIME_ENV.BUILD_STAMP || "dev").trim() || "dev";

const URL_BETA_DAILY_LIMIT = 50;
const SAVED_HISTORY_LIMIT = 10;
const ARCHIVED_HISTORY_LIMIT = 10;
const PALETTE_EDITING_ID_KEY = "motvin.palette.editing-id.v1";
const PALETTE_FORCE_NEW_KEY = "motvin.palette.force-new.v1";
const TYPEFACE_COLLECTION_KEY = "motvin.typeface.collection.v1";
const TYPEFACE_DELETED_KEY = "motvin.typeface-deleted.v1";
const TYPEFACE_PENDING_SNAPSHOT_KEY = "motvin.typeface.pending-open.v1";
const TYPEFACE_EDITING_ID_KEY = "motvin.typeface.editing-id.v1";
const TYPEFACE_FORCE_NEW_KEY = "motvin.typeface.force-new.v1";

const state = {
  file: null,
  rawHtml: "",
  preparedHtml: "",
  isFrameReady: false,
  captureUrl: "",
  assetBlobs: new Map(),
  smartAutoLayout: true,
  imports: [],
  selectedImportIds: new Set(),
  undoStack: [],
  redoStack: [],
  activeImportId: null,
  nextImportId: 1,
  maxImports: 5,
};

document.addEventListener("DOMContentLoaded", () => {
  const isLocalPreview =
    window.__MOTVIN_LOCAL_PREVIEW__ === true ||
    window.location.protocol === "file:" ||
    LOCAL_HOSTNAMES.has(window.location.hostname);
  const disableMobileDesktopNotice =
    DISABLE_PROTECTION || isLocalPreview;

  const shouldForceMobileNotice = () => {
    if (disableMobileDesktopNotice) return false;

    const ua = navigator.userAgent || "";
    const isPhoneUa = /iPhone|iPod|Android.+Mobile|Windows Phone/i.test(ua);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const shortScreenSide = Math.min(
      Number(window.screen?.width) || 0,
      Number(window.screen?.height) || 0,
    );
    const isPhoneSizedScreen = shortScreenSide > 0 && shortScreenSide <= 430;
    return isPhoneUa || (coarsePointer && isPhoneSizedScreen);
  };

  const syncForcedMobileNoticeClass = () => {
    const shouldForce = shouldForceMobileNotice();
    document.documentElement.classList.toggle(
      "force-mobile-notice",
      shouldForce,
    );
    document.body.classList.toggle("force-mobile-notice", shouldForce);
  };

  syncForcedMobileNoticeClass();
  window.addEventListener("resize", syncForcedMobileNoticeClass, {
    passive: true,
  });
  window.addEventListener("orientationchange", syncForcedMobileNoticeClass, {
    passive: true,
  });

  const tabs = document.querySelectorAll(".tab-btn");
  const fileConvertContent = document.getElementById("fileConvertContent");
  const urlConvertContent = document.getElementById("urlConvertContent");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const isUrlTab = tab.id === "urlConvertTab";
      if (fileConvertContent)
        fileConvertContent.classList.toggle("hidden", isUrlTab);
      if (urlConvertContent)
        urlConvertContent.classList.toggle("hidden", !isUrlTab);
    });
  });

  // Sidebar icon strip button active state toggling
  const stripBtns = document.querySelectorAll(".sidebar-icon-strip .strip-btn");
  const primaryStripBtns = Array.from(stripBtns).filter((btn) =>
    Boolean(btn.dataset.tab),
  );
  const settingsBtn = document.getElementById("settingsBtn");
  const sidebarProfileBadges = Array.from(
    document.querySelectorAll(".sidebar-profile-badge"),
  );
  const sidebarLeftForUiMenu = document.querySelector(".sidebar-left");
  const UI_MODE_STORAGE_KEY = "code2design-ui-mode";
  let settingsFirebaseUrlBetaServicePromise = null;
  let settingsUrlBetaSignedIn = false;
  let settingsAuthUnsubscribe = null;
  let settingsAuthUser = null;
  let sidebarProfileMenu = null;
  let sidebarProfileMenuNameEl = null;
  let sidebarProfileMenuEmailEl = null;
  let sidebarProfileMenuHeaderEl = null;
  let sidebarProfileMenuAuthActionEl = null;
  let sidebarProfileMenuAuthIconEl = null;
  let sidebarProfileMenuAuthLabelEl = null;
  let activeSidebarProfileBadge = null;

  const getSettingsFirebaseUrlBetaService = async () => {
    if (!settingsFirebaseUrlBetaServicePromise) {
      settingsFirebaseUrlBetaServicePromise = createFirebaseUrlBetaCreditService({
        dailyLimit: URL_BETA_DAILY_LIMIT,
      });
    }
    return settingsFirebaseUrlBetaServicePromise;
  };

  // Expose immediately so inline scripts on styles.html/typeface.html can use it
  window.__motvinGetFirebaseService = getSettingsFirebaseUrlBetaService;

  const getSidebarBadgeInitial = (user) => {
    const providerName = Array.isArray(user?.providerData)
      ? user.providerData.find((p) => p?.displayName)?.displayName || ""
      : "";
    const providerEmail = Array.isArray(user?.providerData)
      ? user.providerData.find((p) => p?.email)?.email || ""
      : "";
    const name = String(
      user?.displayName || providerName || user?.email || providerEmail || "",
    ).trim();
    const first = name.charAt(0).toUpperCase();
    return /^[A-Z0-9]$/.test(first) ? first : "S";
  };

  const getSidebarBadgePhotoUrl = (user) => {
    const directPhoto = String(user?.photoURL || "").trim();
    if (directPhoto) return directPhoto;

    if (Array.isArray(user?.providerData)) {
      const providerPhoto = user.providerData
        .map((provider) => String(provider?.photoURL || "").trim())
        .find(Boolean);
      if (providerPhoto) return providerPhoto;
    }

    return "";
  };

  const getSidebarBadgeDisplayName = (user) => {
    const providerName = Array.isArray(user?.providerData)
      ? user.providerData.find((p) => p?.displayName)?.displayName || ""
      : "";
    const providerEmail = Array.isArray(user?.providerData)
      ? user.providerData.find((p) => p?.email)?.email || ""
      : "";
    return String(
      user?.displayName || providerName || user?.email || providerEmail || "Signed in user",
    ).trim() || "Signed in user";
  };

  const getSidebarBadgeEmail = (user) => {
    const providerEmail = Array.isArray(user?.providerData)
      ? user.providerData.find((p) => p?.email)?.email || ""
      : "";
    return String(user?.email || providerEmail || "").trim();
  };

  const RELEASE_UPDATES_ICON_MARKUP = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.375 0.5V2.75M4.625 0.5V2.75M8 0.5V2.75M5 10.25H8M5 7.25H11M8.75 1.625H7.25C4.77513 1.625 3.53769 1.625 2.76885 2.39385C2 3.16269 2 4.40013 2 6.875V10.25C2 12.7249 2 13.9623 2.76885 14.7312C3.53769 15.5 4.77513 15.5 7.25 15.5H8.75C11.2249 15.5 12.4623 15.5 13.2312 14.7312C14 13.9623 14 12.7249 14 10.25V6.875C14 4.40013 14 3.16269 13.2312 2.39384C12.4623 1.625 11.2249 1.625 8.75 1.625Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const AUTH_ICON_MARKUP = {
    signedIn: `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.66668 2C4.0467 2 3.73671 2 3.48238 2.06815C2.7922 2.25308 2.2531 2.79218 2.06816 3.48236C2.00002 3.73669 2.00002 4.04669 2.00002 4.66667V11.3333C2.00002 11.9533 2.00002 12.2633 2.06816 12.5177C2.2531 13.2078 2.7922 13.7469 3.48238 13.9319C3.73671 14 4.0467 14 4.66668 14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11.0001 11C11.0001 11 14 8.79053 14 8C14 7.2094 11 5 11 5M13.3333 8H5.33336" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    signedOut: `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.3333 2C11.9533 2 12.2633 2 12.5176 2.06815C13.2078 2.25308 13.7469 2.79218 13.9319 3.48236C14 3.73669 14 4.04669 14 4.66667V11.3333C14 11.9533 14 12.2633 13.9319 12.5177C13.7469 13.2078 13.2078 13.7469 12.5176 13.9319C12.2633 14 11.9533 14 11.3333 14M4.99995 11C4.99995 11 2.00002 8.79053 2.00002 8C2.00002 7.2094 5.00002 5 5.00002 5M2.66669 8H10.6667" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
  };

  function getSidebarProfileAuthActionMarkup(signedIn) {
    if (signedIn) {
      return {
        action: "sign-out",
        label: "Log out",
        icon: AUTH_ICON_MARKUP.signedIn,
      };
    }

    return {
      action: "sign-in",
      label: "Log in",
      icon: AUTH_ICON_MARKUP.signedOut,
    };
  }

  function closeSidebarProfileMenu({ restoreFocus = false } = {}) {
    if (!sidebarProfileMenu) return;
    const focusTarget = activeSidebarProfileBadge;
    sidebarProfileMenu.classList.remove("visible");
    sidebarProfileMenu.classList.add("hidden");
    sidebarProfileMenu.setAttribute("aria-hidden", "true");
    if (activeSidebarProfileBadge) {
      activeSidebarProfileBadge.classList.remove("is-open");
      activeSidebarProfileBadge.setAttribute("aria-expanded", "false");
    }
    activeSidebarProfileBadge = null;
    if (restoreFocus && focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus();
    }
  }

  function positionSidebarProfileMenu(badgeEl = activeSidebarProfileBadge) {
    if (!sidebarProfileMenu || !badgeEl) return;
    const badgeRect = badgeEl.getBoundingClientRect();
    const menuRect = sidebarProfileMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    let left = badgeRect.right - menuRect.width;
    let top = badgeRect.bottom + 8;

    left = Math.max(12, Math.min(left, viewportWidth - menuRect.width - 12));
    if (top + menuRect.height > viewportHeight - 12) {
      top = Math.max(12, badgeRect.top - menuRect.height - 8);
      sidebarProfileMenu.dataset.placement = "top";
    } else {
      sidebarProfileMenu.dataset.placement = "bottom";
    }

    sidebarProfileMenu.style.left = `${Math.round(left)}px`;
    sidebarProfileMenu.style.top = `${Math.round(top)}px`;
  }

  function syncSidebarProfileMenuContent(user = settingsAuthUser) {
    if (!sidebarProfileMenu) return;
    const signedIn = Boolean(settingsUrlBetaSignedIn && user);
    const email = getSidebarBadgeEmail(user);

    if (sidebarProfileMenuHeaderEl) {
      sidebarProfileMenuHeaderEl.classList.toggle("is-signed-out", !signedIn);
    }

    if (sidebarProfileMenuNameEl) {
      sidebarProfileMenuNameEl.textContent = signedIn ? getSidebarBadgeDisplayName(user) : "Account";
    }
    if (sidebarProfileMenuEmailEl) {
      sidebarProfileMenuEmailEl.textContent = signedIn
        ? (email || "Signed in with Google")
        : "Log in to access your account";
      sidebarProfileMenuEmailEl.classList.toggle("is-empty", !signedIn && !email);
    }


  }

  ensureSidebarProfileMenu();
  const uiModeMenu = document.getElementById("uiModeMenu");
  const uiModeFloatingBtn = sidebarProfileMenu.querySelector("#uiModeFloatingBtn") || document.getElementById("uiModeFloatingBtn");
  const uiModeStandardBtn = sidebarProfileMenu.querySelector("#uiModeStandardBtn") || document.getElementById("uiModeStandardBtn");
  const uiModeReleaseUpdatesBtn = sidebarProfileMenu.querySelector("#uiModeReleaseUpdatesBtn") || document.getElementById("uiModeReleaseUpdatesBtn");
  const urlBetaAuthBtn = sidebarProfileMenu.querySelector("#urlBetaAuthBtn") || document.getElementById("urlBetaAuthBtn");
  const urlBetaAuthBtnIcon = urlBetaAuthBtn?.querySelector(".ui-mode-option-icon") || null;
  const urlBetaAuthBtnLabel = sidebarProfileMenu.querySelector("#urlBetaAuthBtnLabel") || document.getElementById("urlBetaAuthBtnLabel");
  const urlBetaAuthStatus = sidebarProfileMenu.querySelector("#urlBetaAuthStatus") || document.getElementById("urlBetaAuthStatus");

  function ensureSidebarProfileMenu() {
    if (sidebarProfileMenu) return sidebarProfileMenu;

    sidebarProfileMenu = document.createElement("div");
    sidebarProfileMenu.className = "sidebar-profile-menu hidden";
    sidebarProfileMenu.id = "sidebarProfileMenu";
    sidebarProfileMenu.setAttribute("role", "menu");
    sidebarProfileMenu.setAttribute("aria-hidden", "true");
    sidebarProfileMenu.innerHTML = `
      <div class="sidebar-profile-menu__panel">
        <div class="sidebar-profile-menu__header">
          <div class="sidebar-profile-menu__name"></div>
          <div class="sidebar-profile-menu__email"></div>
        </div>
        <div class="sidebar-profile-menu__actions">
          <button class="sidebar-profile-menu__item" type="button" data-profile-menu-action="release-updates" role="menuitem" id="uiModeReleaseUpdatesBtn">
            <span class="sidebar-profile-menu__icon" aria-hidden="true">
              ${RELEASE_UPDATES_ICON_MARKUP}
            </span>
            <span class="sidebar-profile-menu__label">Release Updates</span>
          </button>
          
          <button id="uiModeFloatingBtn" class="sidebar-profile-menu__item ui-mode-option dropdown-item active" type="button" role="menuitemradio" aria-pressed="true">
            <span class="sidebar-profile-menu__icon ui-mode-option-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.66668 2C4.0467 2 3.73671 2 3.48238 2.06815C2.7922 2.25308 2.2531 2.79218 2.06816 3.48236C2.00002 3.73669 2.00002 4.04669 2.00002 4.66667V11.3333C2.00002 11.9533 2.00002 12.2633 2.06816 12.5177C2.2531 13.2078 2.7922 13.7469 3.48238 13.9319C3.73671 14 4.0467 14 4.66668 14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M11.0001 11C11.0001 11 14 8.79053 14 8C14 7.2094 11 5 11 5M13.3333 8H5.33336" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </span>
            <span class="sidebar-profile-menu__label">Float UI</span>
          </button>
          <button id="uiModeStandardBtn" class="sidebar-profile-menu__item ui-mode-option dropdown-item" type="button" role="menuitemradio" aria-pressed="false">
            <span class="sidebar-profile-menu__icon ui-mode-option-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.2"/>
                <path d="M5.5 1.5V14.5" stroke="currentColor" stroke-width="1.2"/>
              </svg>
            </span>
            <span class="sidebar-profile-menu__label">Standard UI</span>
          </button>
          

        </div>
      </div>
    `;

    document.body.appendChild(sidebarProfileMenu);
    sidebarProfileMenuHeaderEl = sidebarProfileMenu.querySelector(".sidebar-profile-menu__header");
    sidebarProfileMenuNameEl = sidebarProfileMenu.querySelector(".sidebar-profile-menu__name");
    sidebarProfileMenuEmailEl = sidebarProfileMenu.querySelector(".sidebar-profile-menu__email");


    syncSidebarProfileMenuContent(settingsAuthUser);

    sidebarProfileMenu.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-profile-menu-action]");
      if (!actionButton) return;

      const action = actionButton.dataset.profileMenuAction;
      closeSidebarProfileMenu();

      if (action === "release-updates") {
        navigateWithPageSwitch(getReleaseUpdatesHref());
        return;
      }

      if (action === "sign-in") {
        void startSettingsGoogleSignIn();
        return;
      }

      if (action === "sign-out") {
        void startSettingsGoogleSignOut();
      }
    });

    return sidebarProfileMenu;
  }

  function openSidebarProfileMenu(badgeEl) {
    if (!badgeEl) return;
    if (typeof closeUiModeMenu === "function") {
      closeUiModeMenu();
    }
    ensureSidebarProfileMenu();
    syncSidebarProfileMenuContent(settingsAuthUser);

    if (activeSidebarProfileBadge && activeSidebarProfileBadge !== badgeEl) {
      activeSidebarProfileBadge.classList.remove("is-open");
      activeSidebarProfileBadge.setAttribute("aria-expanded", "false");
    }

    activeSidebarProfileBadge = badgeEl;
    sidebarProfileMenu.classList.remove("hidden");
    sidebarProfileMenu.setAttribute("aria-hidden", "false");
    badgeEl.classList.add("is-open");
    badgeEl.setAttribute("aria-expanded", "true");
    positionSidebarProfileMenu(badgeEl);
    requestAnimationFrame(() => {
      positionSidebarProfileMenu(badgeEl);
      sidebarProfileMenu.classList.add("visible");
    });
  }

  function toggleSidebarProfileMenu(badgeEl) {
    const isSameBadge = activeSidebarProfileBadge === badgeEl;
    const isOpen = sidebarProfileMenu && !sidebarProfileMenu.classList.contains("hidden");
    if (isSameBadge && isOpen) {
      closeSidebarProfileMenu({ restoreFocus: true });
      return;
    }
    openSidebarProfileMenu(badgeEl);
  }

  const applySidebarProfileBadgeState = ({ signedIn = false, user = null } = {}) => {
    if (!sidebarProfileBadges.length) return;

    const signInTooltipText = "Open account menu";
    const signOutTooltipText = "Open account menu";
    const photoUrl = getSidebarBadgePhotoUrl(user);
    const hasProfilePhoto = Boolean(photoUrl);
    const state = signedIn
      ? hasProfilePhoto
        ? "with-profile"
        : "without-profile"
      : "not-signed-in";
    const initial = getSidebarBadgeInitial(user);

    sidebarProfileBadges.forEach((badgeEl) => {
      badgeEl.removeAttribute("aria-hidden");
      badgeEl.setAttribute("role", "button");
      badgeEl.setAttribute("tabindex", "0");
      badgeEl.setAttribute("aria-haspopup", "menu");
      badgeEl.setAttribute(
        "aria-expanded",
        badgeEl.classList.contains("is-open") && signedIn ? "true" : "false",
      );
      badgeEl.setAttribute("data-auth-state", state);
      badgeEl.removeAttribute("title");
      badgeEl.removeAttribute("aria-label");
      if (state === "not-signed-in") {
        badgeEl.setAttribute("data-tooltip", signInTooltipText);
        badgeEl.setAttribute("data-tooltip-color", "black");
        badgeEl.setAttribute("data-tooltip-size", "small");
        badgeEl.setAttribute("data-tooltip-position", "left");
        badgeEl.setAttribute("data-tooltip-variant", "profile-badge-signin");
      } else {
        badgeEl.setAttribute("data-tooltip", signOutTooltipText);
        badgeEl.setAttribute("data-tooltip-color", "black");
        badgeEl.setAttribute("data-tooltip-size", "small");
        badgeEl.setAttribute("data-tooltip-position", "left");
        badgeEl.setAttribute("data-tooltip-variant", "profile-badge-signout");
      }

      const initialEl = badgeEl.querySelector(".sidebar-profile-badge-initial");
      const iconEl = badgeEl.querySelector(".sidebar-profile-badge-icon");
      const avatarEl = badgeEl.querySelector(".sidebar-profile-badge-avatar");

      if (initialEl) {
        initialEl.textContent = initial;
        initialEl.classList.toggle("hidden", state !== "without-profile");
      }

      if (iconEl) {
        iconEl.classList.toggle("hidden", state !== "not-signed-in");
      }

      if (avatarEl) {
        if (state === "with-profile" && photoUrl) {
          avatarEl.src = photoUrl;
          avatarEl.referrerPolicy = "no-referrer";
          avatarEl.classList.remove("hidden");
        } else {
          avatarEl.src = "";
          avatarEl.classList.add("hidden");
        }
      }
    });

    if (window.MotvinTooltip && typeof window.MotvinTooltip.refresh === "function") {
      window.MotvinTooltip.refresh();
    }

    if (!signedIn) {
      closeSidebarProfileMenu();
    } else if (sidebarProfileMenu && activeSidebarProfileBadge) {
      syncSidebarProfileMenuContent(user);
      positionSidebarProfileMenu(activeSidebarProfileBadge);
    }
  };

  // Paint an optimistic best-guess state synchronously from the shared,
  // same-origin auth snapshot (see JS/firebase-auth.js) instead of always
  // defaulting to signed-out. Firebase's own restore is async (IndexedDB),
  // so without this the badge would flash "not signed in" on every fresh
  // page load until `ensureSettingsAuthListener`'s callback below fires.
  const cachedAuthUser = window.FirebaseAuthService && typeof window.FirebaseAuthService.getCachedUser === "function"
    ? window.FirebaseAuthService.getCachedUser()
    : null;
  applySidebarProfileBadgeState({
    // Guest sessions (Firebase Anonymous Auth, used elsewhere for
    // per-account notification read-state) share this same origin's auth
    // persistence, so a guest can otherwise look "signed in" here — treat
    // anonymous users the same as signed-out for this badge.
    signedIn: Boolean(cachedAuthUser && cachedAuthUser.uid && !cachedAuthUser.isAnonymous),
    user: cachedAuthUser && !cachedAuthUser.isAnonymous ? cachedAuthUser : null,
  });

  const ensureSettingsAuthListener = (service) => {
    if (settingsAuthUnsubscribe || !service?.enabled) return;
    if (typeof service.onAuthChanged !== "function") return;

    settingsAuthUnsubscribe = service.onAuthChanged(async (user) => {
      // Anonymous guest sessions (see JS/firebase-auth.js's ensureGuestSession,
      // used for per-account notification read-state) are a real, origin-shared
      // Firebase Auth session, so `user` can be a truthy anonymous object here
      // even for someone who never actually signed in.
      const nextSignedIn = Boolean(user && user.uid && !user.isAnonymous);
      settingsAuthUser = nextSignedIn ? user : null;
      applySidebarProfileBadgeState({
        signedIn: nextSignedIn,
        user: settingsAuthUser,
      });
      if (nextSignedIn === settingsUrlBetaSignedIn) return;
      settingsUrlBetaSignedIn = nextSignedIn;
      window.__motvinIsSignedIn = nextSignedIn;
      window.dispatchEvent(new Event("url-beta-auth-changed"));
      if (nextSignedIn) {
        await syncFirestoreToLocal(service);
      } else {
        clearLocalCollectionCache();
      }
      setTimeout(() => {
        void updateSettingsAuthUi();
      }, 0);
    });
  };

  /* ── Firestore (cloud-only) save helpers ── */

  const FIRESTORE_COLLECTION_MAP = {
    palettes: { localKey: "motvin.palette-collection.v1", maxEntries: 10 },
    typefaces: { localKey: TYPEFACE_COLLECTION_KEY, maxEntries: 10 },
    deletedPalettes: { localKey: "motvin.palette-deleted.v1", maxEntries: ARCHIVED_HISTORY_LIMIT },
    deletedTypefaces: { localKey: TYPEFACE_DELETED_KEY, maxEntries: ARCHIVED_HISTORY_LIMIT },
  };

  /** On sign-out: wipe the local cache so history shows empty / sign-in CTA. */
  const clearLocalCollectionCache = () => {
    for (const { localKey } of Object.values(FIRESTORE_COLLECTION_MAP)) {
      try { 
        localStorage.removeItem(localKey); 
        localStorage.removeItem(`${localKey}_last_modified`);
      } catch {}
    }
    try { refreshHistoryCard(); } catch {}
    window.dispatchEvent(new CustomEvent("motvin:history-storage-change", { detail: { key: "motvin.palette-collection.v1" } }));
  };

  /** On sign-in: pull Firestore → localStorage cache, then refresh UI. */
  const syncFirestoreToLocal = async (service) => {
    if (!service?.enabled || typeof service.loadUserCollection !== "function") return;
    for (const [type, { localKey, maxEntries }] of Object.entries(FIRESTORE_COLLECTION_MAP)) {
      try {
        const localModifiedRaw = localStorage.getItem(`${localKey}_last_modified`);
        const localModified = localModifiedRaw ? parseInt(localModifiedRaw, 10) : 0;
        // If modified within the last 15 seconds, skip syncing to avoid race condition with in-flight saves
        if (Date.now() - localModified < 15000) {
          continue;
        }

        const remote = await service.loadUserCollection(type);
        if (remote.length > 0) {
          localStorage.setItem(localKey, JSON.stringify(remote.slice(0, maxEntries)));
        }
        // If Firestore is empty, leave localStorage alone — a recent save
        // may still be in-flight; clearLocalCollectionCache handles sign-out.
      } catch (err) {
        console.warn(`[motvin] syncFirestoreToLocal(${type}) failed:`, err);
      }
    }
    try { refreshHistoryCard(); } catch {}
    window.dispatchEvent(new CustomEvent("motvin:history-storage-change", { detail: { key: "motvin.palette-collection.v1" } }));
  };

  /**
   * Save to Firestore first (source of truth), then update localStorage cache.
   * Returns false if user is not signed in.
   */
  const saveCollectionToCloud = async (firestoreType, entries) => {
    if (!settingsUrlBetaSignedIn) return false;

    if (!navigator.onLine) {
      if (typeof showToast === "function") {
        setTimeout(() => {
          showToast("You are offline", "Cannot sync to cloud. Please check your connection.", "error");
        }, 500);
      }
    }
    const service = await getSettingsFirebaseUrlBetaService();
    if (!service?.enabled || typeof service.saveUserCollection !== "function") return false;
    const user = service.getCurrentUser?.();
    if (!user?.uid) return false;
    const { localKey, maxEntries } = FIRESTORE_COLLECTION_MAP[firestoreType] || {};
    const capped = (entries || []).slice(0, maxEntries || 50);
    // Update local cache immediately for instant UI
    try { 
      localStorage.setItem(`${localKey}_last_modified`, Date.now().toString());
      localStorage.setItem(localKey, JSON.stringify(capped)); 
    } catch {}
    try { refreshHistoryCard(); } catch {}
    window.dispatchEvent(new CustomEvent("motvin:history-storage-change", { detail: { key: localKey } }));

    // Write to Firestore and notify if it fails
    service.saveUserCollection(firestoreType, capped).then((success) => {
      if (!success) {
        console.error(`[motvin] Failed to save ${firestoreType} to Firebase. Check Security Rules or network.`);
        if (typeof showToast === "function") {
          showToast("Cloud sync failed", "Your save was kept locally but could not be synced to the cloud.", "error");
        }
      }
    }).catch((err) => {
      console.error(`[motvin] Exception saving ${firestoreType} to Firebase:`, err);
    });
    return true;
  };

  /** Show a sign-in required toast. */
  const showSignInRequiredToast = (action = "save") => {
    if (typeof showToast === "function") {
      showToast("Sign in required", `Sign in with Google to ${action} your work.`, "warning");
    }
  };

  window.__motvinIsSignedIn = false;

  /**
   * Headless auth init — runs on ALL pages (styles.html, typeface.html, files.html).
   * Sets window.__motvinIsSignedIn + settingsUrlBetaSignedIn and registers the
   * onAuthChanged listener even when sidebar DOM elements don't exist.
   * updateSettingsAuthUi() handles the sidebar-specific UI on files.html.
   */
  (async () => {
    try {
      const service = await getSettingsFirebaseUrlBetaService();
      if (!service?.enabled) return;
      ensureSettingsAuthListener(service);
      const signedIn = await service.ensureSignedIn({ interactive: false });
      settingsUrlBetaSignedIn = Boolean(signedIn);
      window.__motvinIsSignedIn = settingsUrlBetaSignedIn;
      if (settingsUrlBetaSignedIn) {
        await syncFirestoreToLocal(service);
      }
    } catch { /* silent */ }
  })();

  const applyStripButtonState = (btn, stateName) => {
    if (!btn) return;

    const normalizedState =
      stateName === "active"
        ? "active"
        : stateName === "hover"
          ? "hover"
          : "default";
    btn.dataset.state = normalizedState;
    btn.classList.toggle("active", normalizedState === "active");

    const img = btn.querySelector("img[data-default-src]");
    if (img) {
      const src =
        normalizedState === "active"
          ? img.dataset.activeSrc || img.dataset.defaultSrc
          : normalizedState === "hover"
            ? img.dataset.hoverSrc || img.dataset.defaultSrc
            : img.dataset.defaultSrc;
      if (src) img.src = src;
    }
  };

  const activateStripButton = (targetBtn) => {
    primaryStripBtns.forEach((btn) => {
      applyStripButtonState(btn, btn === targetBtn ? "active" : "default");
    });
  };

  const getCurrentFileName = () => {
    const pathname = String(window.location.pathname || "");
    const fileName = pathname.split("/").pop() || "files.html";
    return fileName.toLowerCase();
  };

  const initTypefaceUnitSwitch = () => {
    if (!document.body.classList.contains("typeface-page")) return;

    const unitSwitch = document.querySelector(".typeface-unit-switch");
    const unitButtons = Array.from(
      document.querySelectorAll(".typeface-unit-switch__button"),
    );
    const scaleSizeLabels = Array.from(
      document.querySelectorAll(".typeface-stage-body .typeface-scale-size"),
    );

    if (!unitSwitch || !unitButtons.length || !scaleSizeLabels.length) return;

    const defaultUnitButtonLabels = unitButtons.map((button) =>
      String(button.textContent || "").trim() || "PX",
    );
    const figmaPageOptions = [
      { label: "LANDING PAGE", value: "landing" },
      { label: "BLOG POST", value: "blog" },
    ];
    const figmaDefaultOption = "landing";
    let lastActiveUnitBeforeFigma = "px";
    let activeFigmaPageOption = figmaDefaultOption;

    let unitSwitchStretchSettleId = 0;
    let unitSwitchStretchResetId = 0;

    const setActivePillPosition = (button) => {
      if (!button) return;
      const offset = Math.round(Math.max(0, button.offsetLeft - 4));
      const pillWidth = Math.round(Math.max(40, button.offsetWidth));
      unitSwitch.style.setProperty(
        "--typeface-unit-switch-offset",
        `${offset}px`,
      );
      unitSwitch.style.setProperty(
        "--typeface-unit-switch-pill-width",
        `${pillWidth}px`,
      );
    };

    const triggerActivePillStretch = () => {
      if (unitSwitchStretchSettleId) {
        window.clearTimeout(unitSwitchStretchSettleId);
      }
      if (unitSwitchStretchResetId) {
        window.clearTimeout(unitSwitchStretchResetId);
      }

      unitSwitch.style.setProperty("--typeface-unit-switch-scale-x", "1.18");
      unitSwitch.style.setProperty("--typeface-unit-switch-scale-y", "0.95");

      unitSwitchStretchSettleId = window.setTimeout(() => {
        unitSwitch.style.setProperty("--typeface-unit-switch-scale-x", "1.04");
        unitSwitch.style.setProperty("--typeface-unit-switch-scale-y", "1.01");
        unitSwitchStretchSettleId = 0;
      }, 120);

      unitSwitchStretchResetId = window.setTimeout(() => {
        unitSwitch.style.setProperty("--typeface-unit-switch-scale-x", "1");
        unitSwitch.style.setProperty("--typeface-unit-switch-scale-y", "1");
        unitSwitchStretchResetId = 0;
      }, 240);
    };

    const normalizeNumber = (value) => {
      if (!Number.isFinite(value)) return "0";
      const rounded = Math.round(value * 100) / 100;
      return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    };

    const getPxValue = (label) => {
      const cachedValue = Number.parseFloat(label.dataset.pxValue || "");
      if (Number.isFinite(cachedValue)) return cachedValue;

      const parsedValue = Number.parseFloat(label.textContent || "");
      const pxValue = Number.isFinite(parsedValue) ? parsedValue : 0;
      label.dataset.pxValue = String(pxValue);
      return pxValue;
    };

    const formatUnitValue = (pxValue, unit) => {
      if (unit === "rem") return `${normalizeNumber(pxValue / 16)}rem`;
      if (unit === "pt") return `${normalizeNumber(pxValue * 0.75)}pt`;
      return `${normalizeNumber(pxValue)}px`;
    };

    const applyUnit = (unit) => {
      const normalizedUnit = unit === "rem" || unit === "pt" ? unit : "px";

      unitButtons.forEach((button) => {
        const buttonUnit = String(
          button.dataset.unit || button.textContent || "px",
        )
          .trim()
          .toLowerCase();
        const isActive = buttonUnit === normalizedUnit;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        if (isActive) {
          setActivePillPosition(button);
        }
      });

      scaleSizeLabels.forEach((label) => {
        const pxValue = getPxValue(label);
        label.textContent = formatUnitValue(pxValue, normalizedUnit);
      });

      unitSwitch.dataset.activeUnit = normalizedUnit;
      triggerActivePillStretch();
      window.dispatchEvent(new Event("typeface-unit-changed"));
    };

    const showTypefaceStageView = (mode) => {
      const normalizedMode = String(mode || "").trim().toLowerCase();
      if (!normalizedMode) return;

      const stageViews = Array.from(
        document.querySelectorAll(".typeface-stage-view"),
      );
      stageViews.forEach((view) => {
        const viewMode = String(view.dataset.typefaceView || "").trim().toLowerCase();
        const isActive = viewMode === normalizedMode;
        view.classList.toggle("is-active", isActive);
        view.setAttribute("aria-hidden", String(!isActive));
      });
    };

    const toggleFigmaPagePreviews = (pageKey) => {
      const figmaStageView = document.querySelector('.typeface-stage-view--figma');
      if (!figmaStageView) return;

      const landingPreview = figmaStageView.querySelector('[data-figma-page="landing"]');
      const blogPreview = figmaStageView.querySelector('[data-figma-page="blog"]');

      if (landingPreview) landingPreview.style.display = pageKey === "landing" ? "" : "none";
      if (blogPreview) blogPreview.style.display = pageKey === "blog" ? "" : "none";
    };

    const applyFigmaPageOption = (nextOption, { animate = true } = {}) => {
      const normalizedOption = nextOption === "blog" ? "blog" : "landing";
      activeFigmaPageOption = normalizedOption;

      unitButtons.forEach((button) => {
        const buttonOption = String(button.dataset.figmaPageOption || "").trim().toLowerCase();
        if (!buttonOption) return;
        const isActive = buttonOption === normalizedOption;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        if (isActive) {
          setActivePillPosition(button);
        }
      });

      showTypefaceStageView("figma");
      toggleFigmaPagePreviews(normalizedOption);

      window.dispatchEvent(
        new CustomEvent("typeface-figma-page-changed", {
          detail: { page: normalizedOption },
        }),
      );

      if (animate) {
        triggerActivePillStretch();
      }
    };

    const setFigmaSelectedState = (isFigmaMode) => {
      const shouldEnableFigmaState = Boolean(isFigmaMode);
      unitSwitch.classList.toggle("is-figma-selected", shouldEnableFigmaState);
      unitSwitch.setAttribute("aria-label", shouldEnableFigmaState ? "Page selection" : "Typeface unit selection");

      if (shouldEnableFigmaState) {
        lastActiveUnitBeforeFigma = String(unitSwitch.dataset.activeUnit || lastActiveUnitBeforeFigma || "px").trim().toLowerCase() || "px";

        unitButtons.forEach((button, index) => {
          const pageOption = figmaPageOptions[index];
          if (pageOption) {
            button.hidden = false;
            button.disabled = false;
            button.dataset.figmaPageOption = pageOption.value;
            button.textContent = pageOption.label;
          } else {
            // Hide extra buttons (e.g. PT) in figma mode
            button.hidden = true;
            button.disabled = true;
            delete button.dataset.figmaPageOption;
            button.classList.remove("is-active");
            button.setAttribute("aria-pressed", "false");
          }
        });

        unitSwitch.dataset.activeUnit = "figma-selected";
        applyFigmaPageOption(figmaDefaultOption);
        return;
      }

      // Restore all buttons including PT
      unitButtons.forEach((button, index) => {
        button.hidden = false;
        button.textContent = defaultUnitButtonLabels[index] || button.textContent;
        button.disabled = false;
        delete button.dataset.figmaPageOption;
      });

      applyUnit(lastActiveUnitBeforeFigma);
    };

    unitButtons.forEach((button) => {
      const buttonUnit = String(button.textContent || "px").trim().toLowerCase();
      button.dataset.unit = buttonUnit;
      button.setAttribute(
        "aria-pressed",
        String(button.classList.contains("is-active")),
      );
      button.addEventListener("click", () => {
        if (button.disabled || button.hidden) return;

        if (unitSwitch.classList.contains("is-figma-selected")) {
          const figmaOption = String(button.dataset.figmaPageOption || "").trim().toLowerCase();
          if (!figmaOption) return;
          applyFigmaPageOption(figmaOption);
          return;
        }

        applyUnit(buttonUnit);
      });
    });

    window.addEventListener("typeface-display-mode-changed", (event) => {
      const mode = String(event?.detail?.mode || "").trim().toLowerCase();
      setFigmaSelectedState(mode === "figma");
    });

    window.addEventListener(
      "resize",
      () => {
        const activeButton = unitButtons.find((button) => button.classList.contains("is-active"));
        if (activeButton) {
          setActivePillPosition(activeButton);
        }
      },
      { passive: true },
    );

    const initialButton =
      unitButtons.find((button) => button.classList.contains("is-active")) ||
      unitButtons[1] ||
      unitButtons[0];
    const initialUnit = String(
      initialButton?.dataset.unit || initialButton?.textContent || "px",
    )
      .trim()
      .toLowerCase();

    applyUnit(initialUnit);
    setFigmaSelectedState(false);
  };

  const initTypefaceDisplaySwitch = () => {
    if (!document.body.classList.contains("typeface-page")) return;

    const displaySwitch = document.querySelector(".typeface-icon-switch");
    const displayButtons = Array.from(
      document.querySelectorAll(".typeface-icon-switch__button"),
    );
    const stageViews = Array.from(
      document.querySelectorAll(".typeface-stage-view"),
    );

    if (!displaySwitch || !displayButtons.length || !stageViews.length) return;

    let displaySwitchStretchSettleId = 0;
    let displaySwitchStretchResetId = 0;

    const setActivePillPosition = (button) => {
      if (!button) return;
      const offset = Math.round(Math.max(0, button.offsetLeft - 4));
      displaySwitch.style.setProperty(
        "--typeface-icon-switch-offset",
        `${offset}px`,
      );
    };

    const triggerActivePillStretch = () => {
      if (displaySwitchStretchSettleId) {
        window.clearTimeout(displaySwitchStretchSettleId);
      }
      if (displaySwitchStretchResetId) {
        window.clearTimeout(displaySwitchStretchResetId);
      }

      displaySwitch.style.setProperty("--typeface-icon-switch-scale-x", "1.18");
      displaySwitch.style.setProperty("--typeface-icon-switch-scale-y", "0.95");

      displaySwitchStretchSettleId = window.setTimeout(() => {
        displaySwitch.style.setProperty("--typeface-icon-switch-scale-x", "1.04");
        displaySwitch.style.setProperty("--typeface-icon-switch-scale-y", "1.01");
        displaySwitchStretchSettleId = 0;
      }, 120);

      displaySwitchStretchResetId = window.setTimeout(() => {
        displaySwitch.style.setProperty("--typeface-icon-switch-scale-x", "1");
        displaySwitch.style.setProperty("--typeface-icon-switch-scale-y", "1");
        displaySwitchStretchResetId = 0;
      }, 240);
    };

    const setActiveView = (nextMode) => {
      let activeButton = null;

      displayButtons.forEach((button, index) => {
        const isActive =
          (nextMode === "scale" && index === 0) ||
          (nextMode === "figma" && index === 1);
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        if (isActive) {
          activeButton = button;
        }
      });

      if (activeButton) {
        setActivePillPosition(activeButton);
      }

      stageViews.forEach((view) => {
        const mode = view.dataset.typefaceView;
        const isActive = mode === nextMode;
        view.classList.toggle("is-active", isActive);
        view.setAttribute("aria-hidden", String(!isActive));
      });

      window.dispatchEvent(
        new CustomEvent("typeface-display-mode-changed", {
          detail: { mode: nextMode },
        }),
      );

      triggerActivePillStretch();
    };

    displayButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        setActiveView(index === 0 ? "scale" : "figma");
      });
    });

    window.addEventListener(
      "resize",
      () => {
        const activeButton = displayButtons.find((button) => button.classList.contains("is-active"));
        if (activeButton) {
          setActivePillPosition(activeButton);
        }
      },
      { passive: true },
    );

    setActiveView("scale");
  };

  const initTypefaceSettings = () => {
    if (!document.body.classList.contains("typeface-page")) return;

    const fontSizeInput = document.getElementById("typeface-font-size");
    const scaleSelect = document.getElementById("typeface-scale-select");
    const bodyFontInput = document.getElementById("typeface-body-font");
    const bodyWeightSelect = document.getElementById("typeface-body-weight");
    const bodyLineHeightInput = document.getElementById("typeface-body-line-height");
    const bodyColorInput = document.getElementById("typeface-body-color");
    const bodyBgInput = document.getElementById("typeface-body-background");
    const headingFontInput = document.getElementById("typeface-heading-font");
    const headingWeightSelect = document.getElementById("typeface-heading-weight");
    const headingLineHeightInput = document.getElementById("typeface-heading-line-height");
    const stageBody = document.querySelector(".typeface-stage-body");
    const scaleList = document.querySelector(".typeface-scale-list");
    const responsiveLineHeightInput = document.getElementById("typeface-responsive-line-height");
    const responsiveScaleInput = document.getElementById("typeface-responsive-scale");
    const responsiveMinWidthInput = document.getElementById("typeface-responsive-min-width");

    if (!stageBody || !scaleList) return;

    const SCALE_LEVELS = [
      { token: "h1", exp: 6, row: "h1", heading: true },
      { token: "h2", exp: 5, row: "h2", heading: true },
      { token: "h3", exp: 4, row: "h3", heading: true },
      { token: "h4", exp: 3, row: "h4", heading: true },
      { token: "h5", exp: 2, row: "h5", heading: true },
      { token: "h6", exp: 1, row: "h6", heading: true },
      { token: "p", exp: 0, row: "p", heading: false },
      { token: "Ss", exp: -1, row: "ss", heading: false },
      { token: "s", exp: -2, row: "s", heading: false },
    ];

    const loadedFonts = new Set(["Inter"]);
    const dropdownShells = [];
    const fontPickerInstances = [];
    const headingSizeAdjustments = new Map();
    let activeScaleStyleGroup = "body";
    let responsiveManuallyEdited = false;

    /* ── Undo / Redo history for typeface settings ── */
    const typefaceUndoStack = [];
    const typefaceRedoStack = [];
    const typefaceHistoryLimit = 100;
    let typefaceIsRestoring = false;

    const undoBtn = document.querySelector('.styles-toolbar-group-history .styles-toolbar-icon[aria-label="Undo"]');
    const redoBtn = document.querySelector('.styles-toolbar-group-history .styles-toolbar-icon[aria-label="Redo"]');

    const captureTypefaceSnapshot = () => ({
      fontSize: fontSizeInput?.value ?? "",
      scale: scaleSelect?.value ?? "",
      bodyFont: bodyFontInput?.value ?? "",
      bodyWeight: bodyWeightSelect?.value ?? "",
      bodyLh: bodyLineHeightInput?.value ?? "",
      bodyColor: bodyColorInput?.value ?? "",
      bodyBg: bodyBgInput?.value ?? "",
      headingFont: headingFontInput?.value ?? "",
      headingWeight: headingWeightSelect?.value ?? "",
      headingLh: headingLineHeightInput?.value ?? "",
      respMinWidth: responsiveMinWidthInput?.value ?? "",
      respLineHeight: responsiveLineHeightInput?.value ?? "",
      respScale: responsiveScaleInput?.value ?? "",
      headingAdj: new Map(headingSizeAdjustments),
      respManual: responsiveManuallyEdited,
    });

    const restoreTypefaceSnapshot = (snap) => {
      typefaceIsRestoring = true;
      if (fontSizeInput) fontSizeInput.value = snap.fontSize;
      if (scaleSelect) scaleSelect.value = snap.scale;
      if (bodyFontInput) bodyFontInput.value = snap.bodyFont;
      if (bodyWeightSelect) bodyWeightSelect.value = snap.bodyWeight;
      if (bodyLineHeightInput) bodyLineHeightInput.value = snap.bodyLh;
      if (bodyColorInput) bodyColorInput.value = snap.bodyColor;
      if (bodyBgInput) bodyBgInput.value = snap.bodyBg;
      if (headingFontInput) headingFontInput.value = snap.headingFont;
      if (headingWeightSelect) headingWeightSelect.value = snap.headingWeight;
      if (headingLineHeightInput) headingLineHeightInput.value = snap.headingLh;
      if (responsiveMinWidthInput) responsiveMinWidthInput.value = snap.respMinWidth;
      if (responsiveLineHeightInput) responsiveLineHeightInput.value = snap.respLineHeight;
      if (responsiveScaleInput) responsiveScaleInput.value = snap.respScale;
      headingSizeAdjustments.clear();
      for (const [k, v] of snap.headingAdj) headingSizeAdjustments.set(k, v);
      responsiveManuallyEdited = snap.respManual;

      // Update color swatches
      const bodySwatch = bodyColorInput?.closest(".typeface-input-shell")?.querySelector(".typeface-color-swatch");
      const bgSwatch = bodyBgInput?.closest(".typeface-input-shell")?.querySelector(".typeface-color-swatch");
      if (bodySwatch) bodySwatch.style.background = snap.bodyColor;
      if (bgSwatch) bgSwatch.style.background = snap.bodyBg;

      // Load fonts if needed
      if (snap.bodyFont) loadGoogleFont(snap.bodyFont);
      if (snap.headingFont && snap.headingFont !== snap.bodyFont) loadGoogleFont(snap.headingFont);

      recalculateScale(true);
      applyHeadingPreviewStyles();
      typefaceIsRestoring = false;
      updateTypefaceHistoryButtons();
    };

    const restoreSerializedTypefaceSnapshot = (serializedSnapshot) => {
      if (!serializedSnapshot || typeof serializedSnapshot !== "object") return false;

      restoreTypefaceSnapshot({
        fontSize: String(serializedSnapshot.fontSize ?? ""),
        scale: String(serializedSnapshot.scale ?? ""),
        bodyFont: String(serializedSnapshot.bodyFont ?? ""),
        bodyWeight: String(serializedSnapshot.bodyWeight ?? ""),
        bodyLh: String(serializedSnapshot.bodyLh ?? ""),
        bodyColor: String(serializedSnapshot.bodyColor ?? ""),
        bodyBg: String(serializedSnapshot.bodyBg ?? ""),
        headingFont: String(serializedSnapshot.headingFont ?? ""),
        headingWeight: String(serializedSnapshot.headingWeight ?? ""),
        headingLh: String(serializedSnapshot.headingLh ?? ""),
        respMinWidth: String(serializedSnapshot.respMinWidth ?? ""),
        respLineHeight: String(serializedSnapshot.respLineHeight ?? ""),
        respScale: String(serializedSnapshot.respScale ?? ""),
        headingAdj: new Map(Array.isArray(serializedSnapshot.headingAdj) ? serializedSnapshot.headingAdj : []),
        respManual: Boolean(serializedSnapshot.respManual),
      });

      return true;
    };

    const updateTypefaceHistoryButtons = () => {
      if (undoBtn) {
        undoBtn.disabled = typefaceUndoStack.length === 0;
        undoBtn.classList.toggle("is-muted", typefaceUndoStack.length === 0);
      }
      if (redoBtn) {
        redoBtn.disabled = typefaceRedoStack.length === 0;
        redoBtn.classList.toggle("is-muted", typefaceRedoStack.length === 0);
      }
    };

    const pushTypefaceHistory = () => {
      if (typefaceIsRestoring) return;
      typefaceUndoStack.push(captureTypefaceSnapshot());
      if (typefaceUndoStack.length > typefaceHistoryLimit) typefaceUndoStack.shift();
      typefaceRedoStack.length = 0;
      updateTypefaceHistoryButtons();
    };

    const typefaceUndo = () => {
      if (typefaceUndoStack.length === 0) return;
      typefaceRedoStack.push(captureTypefaceSnapshot());
      restoreTypefaceSnapshot(typefaceUndoStack.pop());
    };

    const typefaceRedo = () => {
      if (typefaceRedoStack.length === 0) return;
      typefaceUndoStack.push(captureTypefaceSnapshot());
      restoreTypefaceSnapshot(typefaceRedoStack.pop());
    };

    if (undoBtn) undoBtn.addEventListener("click", typefaceUndo);
    if (redoBtn) redoBtn.addEventListener("click", typefaceRedo);

    /* ── Google Fonts catalogue ── */
    let googleFontFamilies = ["Inter"];
    let googleFontsLoaded = false;
    const fetchGoogleFonts = async () => {
      try {
        const res = await fetch(new URL("/assets/google-fonts.json", window.location.origin).href);
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          googleFontFamilies = data;
          googleFontsLoaded = true;
        }
      } catch {
        // Keep fallback
      }
      fontPickerInstances.forEach((instance) => instance.refresh());
    };
    fetchGoogleFonts();

    /* ── Virtual-scroll font picker builder ── */
    const FONT_OPTION_HEIGHT = 34;
    const FONT_VISIBLE_COUNT = 5;

    const initFontPicker = (input) => {
      const shell = input?.closest(".typeface-input-shell--font-select");
      if (!shell || shell.dataset.fontPickerReady === "true") return null;
      shell.dataset.fontPickerReady = "true";

      // Dropdown container
      const picker = document.createElement("div");
      picker.className = "typeface-font-picker hidden";
      document.body.appendChild(picker);

      // Search
      const searchWrap = document.createElement("div");
      searchWrap.className = "typeface-font-picker__search-wrap";
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "typeface-font-picker__search";
      searchInput.placeholder = "Search fonts\u2026";
      searchInput.autocomplete = "off";
      searchWrap.appendChild(searchInput);
      picker.appendChild(searchWrap);

      // Scrollable list
      const listEl = document.createElement("div");
      listEl.className = "typeface-font-picker__list";
      picker.appendChild(listEl);

      const innerEl = document.createElement("div");
      innerEl.className = "typeface-font-picker__list-inner";
      listEl.appendChild(innerEl);

      const emptyEl = document.createElement("div");
      emptyEl.className = "typeface-font-picker__empty hidden";
      emptyEl.textContent = "No fonts found";
      listEl.appendChild(emptyEl);

      let filteredFonts = googleFontFamilies;
      let poolNodes = [];
      let currentValue = String(input.value || "Inter").trim();
      let highlightedFontIndex = -1;
      let isOpen = false;

      const applyFontSelection = (family) => {
        if (!family) return;
        currentValue = family;
        input.value = family;
        loadGoogleFont(family);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof recalculateScale === "function") {
          recalculateScale();
        }
      };

      const setHighlightedFontIndex = (index, ensureVisible = true) => {
        if (!filteredFonts.length) {
          highlightedFontIndex = -1;
          renderVisible();
          return;
        }

        const safeIndex = Math.max(0, Math.min(filteredFonts.length - 1, Number(index) || 0));
        highlightedFontIndex = safeIndex;

        if (ensureVisible) {
          const optionTop = safeIndex * FONT_OPTION_HEIGHT;
          const optionBottom = optionTop + FONT_OPTION_HEIGHT;
          const viewTop = listEl.scrollTop;
          const viewBottom = viewTop + listEl.clientHeight;

          if (optionTop < viewTop) {
            listEl.scrollTop = optionTop;
          } else if (optionBottom > viewBottom) {
            listEl.scrollTop = Math.max(0, optionBottom - listEl.clientHeight);
          }
        }

        renderVisible();
      };

      const ensurePoolSize = (count) => {
        while (poolNodes.length < count) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "typeface-font-picker__option";
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const family = btn.dataset.family;
            if (family) {
              applyFontSelection(family);
              closeFontPicker();
            }
          });
          innerEl.appendChild(btn);
          poolNodes.push(btn);
        }
      };

      const renderVisible = () => {
        const scrollTop = listEl.scrollTop;
        const totalHeight = filteredFonts.length * FONT_OPTION_HEIGHT;
        innerEl.style.height = `${totalHeight}px`;

        const startIdx = Math.max(0, Math.floor(scrollTop / FONT_OPTION_HEIGHT) - 2);
        const endIdx = Math.min(filteredFonts.length, startIdx + FONT_VISIBLE_COUNT + 4);
        const needed = endIdx - startIdx;
        ensurePoolSize(needed);

        // Hide all pool nodes first
        for (let i = 0; i < poolNodes.length; i++) {
          poolNodes[i].style.display = "none";
        }

        for (let i = 0; i < needed; i++) {
          const fontIdx = startIdx + i;
          const family = filteredFonts[fontIdx];
          const node = poolNodes[i];
          node.style.display = "";
          node.style.top = `${fontIdx * FONT_OPTION_HEIGHT}px`;
          node.textContent = family;
          node.dataset.family = family;
          node.style.fontFamily = `"${family}", sans-serif`;
          node.classList.toggle("is-active", fontIdx === highlightedFontIndex);
        }

        const hasResults = filteredFonts.length > 0;
        emptyEl.classList.toggle("hidden", hasResults);
        innerEl.style.display = hasResults ? "" : "none";

        // Lazy-load visible font previews
        const visibleFamilies = filteredFonts.slice(startIdx, endIdx);
        const toLoad = visibleFamilies.filter((f) => !loadedFonts.has(f));
        if (toLoad.length) {
          const families = toLoad.map((f) => `family=${encodeURIComponent(f)}`).join("&");
          const id = `typeface-gfont-preview-${toLoad[0].toLowerCase().replace(/\s+/g, "-")}`;
          if (!document.getElementById(id)) {
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
            document.head.appendChild(link);
          }
        }
      };

      const filterFonts = () => {
        const query = searchInput.value.trim().toLowerCase();
        filteredFonts = query
          ? googleFontFamilies.filter((f) => f.toLowerCase().includes(query))
          : googleFontFamilies;
        const currentIdx = filteredFonts.indexOf(currentValue);
        highlightedFontIndex = currentIdx >= 0 ? currentIdx : (filteredFonts.length ? 0 : -1);
        if (highlightedFontIndex <= 0) {
          listEl.scrollTop = 0;
        }
        setHighlightedFontIndex(highlightedFontIndex, true);
      };

      const positionPicker = () => {
        const shellRect = shell.getBoundingClientRect();
        const menuWidth = Math.ceil(shellRect.width);
        const viewportPadding = 12;
        const menuSpacing = 8;
        const desiredHeight = Math.min(320, FONT_OPTION_HEIGHT * FONT_VISIBLE_COUNT + 52);
        const availableBelow = window.innerHeight - shellRect.bottom - viewportPadding - menuSpacing;
        const availableAbove = shellRect.top - viewportPadding - menuSpacing;
        const openUpward = desiredHeight > availableBelow && availableAbove > availableBelow;
        const maxH = Math.max(180, Math.min(desiredHeight, openUpward ? availableAbove : availableBelow));

        picker.style.width = `${menuWidth}px`;
        picker.style.minWidth = `${menuWidth}px`;
        picker.style.maxWidth = `${menuWidth}px`;
        picker.style.maxHeight = `${maxH}px`;

        const measuredHeight = Math.min(picker.scrollHeight || maxH, maxH);
        const top = openUpward
          ? Math.max(viewportPadding, Math.round(shellRect.top - measuredHeight - menuSpacing))
          : Math.min(
              window.innerHeight - measuredHeight - viewportPadding,
              Math.round(shellRect.bottom + menuSpacing),
            );
        const left = Math.min(
          window.innerWidth - menuWidth - viewportPadding,
          Math.max(viewportPadding, Math.round(shellRect.left)),
        );

        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
      };

      const openFontPicker = () => {
        isOpen = true;
        currentValue = String(input.value || "Inter").trim();
        searchInput.value = "";
        filteredFonts = googleFontFamilies;
        highlightedFontIndex = filteredFonts.indexOf(currentValue);
        if (highlightedFontIndex < 0 && filteredFonts.length) {
          highlightedFontIndex = 0;
        }
        picker.classList.remove("hidden");
        shell.classList.add("is-open");
        positionPicker();
        renderVisible();

        // Scroll active item into view
        if (highlightedFontIndex > 0) {
          listEl.scrollTop = Math.max(0, highlightedFontIndex * FONT_OPTION_HEIGHT - FONT_OPTION_HEIGHT * 2);
          renderVisible();
        }
        requestAnimationFrame(() => searchInput.focus());
      };

      const closeFontPicker = () => {
        isOpen = false;
        picker.classList.add("hidden");
        shell.classList.remove("is-open");
      };

      // Events
      shell.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
          closeFontPicker();
        } else {
          closeTypefaceDropdowns();
          fontPickerInstances.forEach((inst) => { if (inst !== instance) inst.close(); });
          openFontPicker();
        }
      });

      searchInput.addEventListener("click", (e) => e.stopPropagation());
      searchInput.addEventListener("input", filterFonts);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeFontPicker();
          return;
        }

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!filteredFonts.length) return;
          const delta = e.key === "ArrowDown" ? 1 : -1;
          const startIndex = highlightedFontIndex >= 0
            ? highlightedFontIndex
            : Math.max(0, filteredFonts.indexOf(currentValue));
          setHighlightedFontIndex(startIndex + delta, true);
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          if (highlightedFontIndex < 0 || !filteredFonts[highlightedFontIndex]) return;
          applyFontSelection(filteredFonts[highlightedFontIndex]);
          closeFontPicker();
          return;
        }

        e.stopPropagation();
      });

      picker.addEventListener("wheel", (e) => e.stopPropagation());
      picker.addEventListener("touchmove", (e) => e.stopPropagation());
      picker.addEventListener("click", (e) => e.stopPropagation());

      listEl.addEventListener("scroll", () => {
        if (isOpen) renderVisible();
      }, { passive: true });

      const instance = {
        refresh: () => { filteredFonts = googleFontFamilies; if (isOpen) { filterFonts(); } },
        close: closeFontPicker,
        isOpen: () => isOpen,
        picker,
        shell,
        reposition: positionPicker,
      };
      fontPickerInstances.push(instance);
      return instance;
    };

    // Close font pickers on outside click / escape / scroll
    document.addEventListener("click", (e) => {
      fontPickerInstances.forEach((inst) => {
        if (inst.isOpen() && !inst.shell.contains(e.target) && !inst.picker.contains(e.target)) {
          inst.close();
        }
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fontPickerInstances.forEach((inst) => inst.close());
    });
    window.addEventListener("resize", () => {
      fontPickerInstances.forEach((inst) => { if (inst.isOpen()) inst.reposition(); });
    }, { passive: true });

    const syncDropdownMenuWidth = (shell) => {
      if (!shell) return;
      const shellWidth = shell.getBoundingClientRect().width || shell.offsetWidth || 0;
      shell.style.setProperty(
        "--typeface-select-menu-width",
        `${Math.ceil(shellWidth)}px`,
      );
    };

    const getTypefaceDropdownMaxHeight = (menu) => {
      if (!menu) return 248;

      const optionElements = Array.from(menu.querySelectorAll(".typeface-select-option"));
      if (!optionElements.length) return 248;

      const visibleCount = Math.min(5, optionElements.length);
      const menuStyles = window.getComputedStyle(menu);
      const optionStyles = window.getComputedStyle(optionElements[0]);
      const rowGap = Number.parseFloat(menuStyles.rowGap || menuStyles.gap || "0") || 0;
      const paddingTop = Number.parseFloat(menuStyles.paddingTop || "0") || 0;
      const paddingBottom = Number.parseFloat(menuStyles.paddingBottom || "0") || 0;
      const optionHeight = optionElements
        .slice(0, visibleCount)
        .reduce((sum, optionElement) => sum + optionElement.getBoundingClientRect().height, 0);
      const borderTop = Number.parseFloat(optionStyles.borderTopWidth || "0") || 0;
      const borderBottom = Number.parseFloat(optionStyles.borderBottomWidth || "0") || 0;

      return Math.ceil(
        optionHeight +
          ((visibleCount - 1) * rowGap) +
          paddingTop +
          paddingBottom +
          borderTop +
          borderBottom,
      );
    };

    const positionTypefaceDropdownMenu = (shell, menu) => {
      if (!shell || !menu) return;

      const shellRect = shell.getBoundingClientRect();
      const menuWidth = Math.ceil(shellRect.width);
      const viewportPadding = 12;
      const menuSpacing = 8;

      menu.style.width = `${menuWidth}px`;
      menu.style.minWidth = `${menuWidth}px`;
      menu.style.maxWidth = `${menuWidth}px`;
      menu.style.maxHeight = `${getTypefaceDropdownMaxHeight(menu)}px`;

      const desiredHeight = Math.ceil(getTypefaceDropdownMaxHeight(menu));
      const fullHeight = Math.ceil(menu.scrollHeight || desiredHeight || 0);
      const availableBelow = Math.max(
        0,
        Math.floor(window.innerHeight - shellRect.bottom - viewportPadding - menuSpacing),
      );
      const availableAbove = Math.max(
        0,
        Math.floor(shellRect.top - viewportPadding - menuSpacing),
      );
      const openUpward = fullHeight > availableBelow && availableAbove > availableBelow;
      const availableHeight = openUpward ? availableAbove : availableBelow;
      const appliedHeight = Math.max(0, Math.min(desiredHeight, availableHeight || desiredHeight));

      menu.style.maxHeight = `${Math.max(120, appliedHeight)}px`;

      const measuredHeight = Math.ceil(
        Math.min(menu.scrollHeight || desiredHeight || 0, Math.max(120, appliedHeight)),
      );

      const top = openUpward
        ? Math.max(viewportPadding, Math.round(shellRect.top - measuredHeight - menuSpacing))
        : Math.min(
            window.innerHeight - measuredHeight - viewportPadding,
            Math.round(shellRect.bottom + menuSpacing),
          );
      const left = Math.min(
        window.innerWidth - menuWidth - viewportPadding,
        Math.max(viewportPadding, Math.round(shellRect.left)),
      );

      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.classList.toggle("typeface-select-menu--upward", openUpward);
    };

    const closeTypefaceDropdowns = (exceptShell = null) => {
      dropdownShells.forEach(({ shell, trigger, menu }) => {
        if (exceptShell && shell === exceptShell) return;
        shell.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        menu.classList.add("hidden");
      });
    };

    const initTypefaceSelectMenu = (select) => {
      const shell = select?.closest(".typeface-input-shell--select");
      if (!select || !shell || shell.dataset.dropdownReady === "true") return;

      shell.dataset.dropdownReady = "true";
      select.classList.add("typeface-select--native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "typeface-select-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");

      const triggerLabel = document.createElement("span");
      triggerLabel.className = "typeface-select-trigger__label";
      trigger.appendChild(triggerLabel);

      const menu = document.createElement("div");
      menu.className = "typeface-select-menu hidden";
      menu.setAttribute("role", "listbox");
      document.body.appendChild(menu);

      const syncSelection = () => {
        const selectedOption =
          Array.from(select.options).find((option) => option.value === select.value) ||
          select.options[select.selectedIndex] ||
          select.options[0];

        const selectedLabel = String(
          selectedOption?.textContent || selectedOption?.label || selectedOption?.value || "",
        ).trim();

        triggerLabel.textContent = selectedLabel;
        syncDropdownMenuWidth(shell);

        Array.from(menu.querySelectorAll(".typeface-select-option")).forEach((optionButton) => {
          const isActive = optionButton.dataset.value === select.value;
          optionButton.classList.toggle("active", isActive);
          optionButton.classList.toggle("is-active", isActive);
          optionButton.setAttribute("aria-selected", String(isActive));
        });
      };

      const getOptionButtons = () => Array.from(menu.querySelectorAll(".typeface-select-option"));

      const getActiveOptionIndex = () => {
        const optionButtons = getOptionButtons();
        return optionButtons.findIndex((optionButton) => optionButton.dataset.value === select.value);
      };

      const applyOptionAtIndex = (index, { closeMenu = false, focusTrigger = false } = {}) => {
        const optionButtons = getOptionButtons();
        if (!optionButtons.length) return;

        const safeIndex = Math.max(0, Math.min(optionButtons.length - 1, Number(index) || 0));
        const optionButton = optionButtons[safeIndex];
        if (!optionButton) return;

        const nextValue = String(optionButton.dataset.value || "");
        if (!nextValue) return;

        if (select.value !== nextValue) {
          select.value = nextValue;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }

        syncSelection();
        optionButton.focus();
        optionButton.scrollIntoView({ block: "nearest" });

        if (closeMenu) {
          closeTypefaceDropdowns();
          if (focusTrigger) {
            trigger.focus();
          }
        }
      };

      const navigateOptions = (delta) => {
        const optionButtons = getOptionButtons();
        if (!optionButtons.length) return;
        const activeIndex = getActiveOptionIndex();
        const baseIndex = activeIndex >= 0 ? activeIndex : 0;
        const nextIndex = Math.max(0, Math.min(optionButtons.length - 1, baseIndex + delta));
        applyOptionAtIndex(nextIndex);
      };

      Array.from(select.options).forEach((option) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "typeface-select-option";
        optionButton.tabIndex = -1;
        optionButton.dataset.value = option.value;
        optionButton.setAttribute("role", "option");
        optionButton.textContent = String(option.textContent || option.label || option.value).trim();

        optionButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          syncSelection();
          closeTypefaceDropdowns();
        });

        menu.appendChild(optionButton);
      });

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const shouldOpen = menu.classList.contains("hidden");
        closeTypefaceDropdowns(shouldOpen ? shell : null);

        shell.classList.toggle("is-open", shouldOpen);
        trigger.setAttribute("aria-expanded", String(shouldOpen));
        menu.classList.toggle("hidden", !shouldOpen);
        if (shouldOpen) {
          positionTypefaceDropdownMenu(shell, menu);
        }
      });

      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (menu.classList.contains("hidden")) {
            trigger.click();
          }
          navigateOptions(event.key === "ArrowDown" ? 1 : -1);
          return;
        }

        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          trigger.click();
        }
      });

      menu.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          navigateOptions(event.key === "ArrowDown" ? 1 : -1);
          return;
        }

        if (event.key === "Home") {
          event.preventDefault();
          applyOptionAtIndex(0);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          const optionButtons = getOptionButtons();
          applyOptionAtIndex(optionButtons.length - 1);
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          applyOptionAtIndex(getActiveOptionIndex(), { closeMenu: true, focusTrigger: true });
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeTypefaceDropdowns();
          trigger.focus();
        }
      });

      menu.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      menu.addEventListener("wheel", (event) => {
        event.stopPropagation();
      });

      menu.addEventListener("touchmove", (event) => {
        event.stopPropagation();
      });

      select.addEventListener("change", syncSelection);

      shell.append(trigger);
      dropdownShells.push({ shell, trigger, menu, syncSelection });
      syncSelection();
    };

    const loadGoogleFont = (fontName) => {
      const trimmed = String(fontName || "").trim();
      if (!trimmed || loadedFonts.has(trimmed)) return;

      const id = `typeface-gfont-${trimmed.toLowerCase().replace(/\s+/g, "-")}`;
      if (document.getElementById(id)) {
        loadedFonts.add(trimmed);
        return;
      }

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(trimmed)}:wght@300;400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
      loadedFonts.add(trimmed);
    };

    const roundTo = (value, decimals) => {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    };

    const getActiveUnit = () => {
      const unitSwitch = document.querySelector(".typeface-unit-switch");
      return String(unitSwitch?.dataset?.activeUnit || "px").toLowerCase();
    };

    const formatSize = (pxValue, unit) => {
      if (unit === "rem") {
        const val = roundTo(pxValue / 16, 2);
        return `${val}rem`;
      }
      if (unit === "pt") {
        const val = roundTo(pxValue * 0.75, 2);
        return `${val}pt`;
      }
      return `${roundTo(pxValue, 2)}px`;
    };

    const applyHeadingPreviewStyles = () => {
      const bodyFont = String(bodyFontInput?.value || "Inter").trim();
      const bodyWeight = String(bodyWeightSelect?.value || "400");
      const bodyLh = Number.parseFloat(bodyLineHeightInput?.value) || 1.5;
      const headingFont = String(headingFontInput?.value || "Inter").trim();
      const headingWeight = String(headingWeightSelect?.value || "700");
      const headingLh = Number.parseFloat(headingLineHeightInput?.value) || 1.15;

      const resolvedFont = headingFont || bodyFont;
      const resolvedWeight = headingWeight || bodyWeight;
      const resolvedLh = headingLh || bodyLh;

      ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((token) => {
        const headingSample = scaleList.querySelector(`.typeface-scale-row--${token} .typeface-scale-sample`);
        if (!headingSample) return;
        headingSample.style.fontFamily = `"${resolvedFont}", sans-serif`;
        headingSample.style.fontWeight = resolvedWeight;
        headingSample.style.lineHeight = String(resolvedLh);
      });
    };

    const recalculateScale = (skipAutosave = false) => {
      if (skipAutosave !== true) pushTypefaceHistory();
      const basePx = Number.parseFloat(fontSizeInput?.value) || 16;
      const ratio = Number.parseFloat(scaleSelect?.value) || 1.2;
      const unit = getActiveUnit();
      const bodyFont = String(bodyFontInput?.value || "Inter").trim();
      const bodyWeight = String(bodyWeightSelect?.value || "400");
      const bodyLh = Number.parseFloat(bodyLineHeightInput?.value) || 1.5;
      const bodyBg = normalizeHexColor(bodyBgInput?.value, "#FFFFFF");
      const bodyColor = normalizeHexColor(bodyColorInput?.value, "#000000");
      const responsiveBodyColor =
        activeTypefaceDisplayMode === "figma" && autoContrastBodyColorEnabled
          ? getAutoContrastTextColor(bodyBg)
          : bodyColor;
      const headingFont = String(headingFontInput?.value || "Inter").trim();
      const headingWeight = String(headingWeightSelect?.value || "700");
      const headingLh = Number.parseFloat(headingLineHeightInput?.value) || 1.15;

      if (bodyFont) loadGoogleFont(bodyFont);
      if (headingFont && headingFont !== bodyFont) loadGoogleFont(headingFont);

      const bodySwatch = bodyColorInput?.closest(".typeface-input-shell")?.querySelector(".typeface-color-swatch");
      const bgSwatch = bodyBgInput?.closest(".typeface-input-shell")?.querySelector(".typeface-color-swatch");
      if (bodySwatch) bodySwatch.style.background = bodyColor;
      if (bgSwatch) bgSwatch.style.background = bodyBg;

      // Keep main stage background unchanged; Body Background should apply only
      // to responsive previews (.typeface-figma-preview / .typeface-blog-preview).
      stageBody.style.removeProperty("background-color");

      scaleList.style.gap = `${Math.max(24, Math.round(basePx * 1.55))}px`;

      if (responsiveLineHeightInput && !responsiveManuallyEdited) {
        responsiveLineHeightInput.value = String(bodyLh);
      }
      if (responsiveScaleInput && !responsiveManuallyEdited) {
        responsiveScaleInput.value = ratio.toFixed(3);
      }

      SCALE_LEVELS.forEach((level) => {
        const baseSize = roundTo(basePx * Math.pow(ratio, level.exp), 2);
        const rowAdjustment = level.heading ? (headingSizeAdjustments.get(level.row) || 0) : 0;
        const pxSize = roundTo(Math.max(1, baseSize + rowAdjustment), 2);
        const rowEl = scaleList.querySelector(`.typeface-scale-row--${level.row}`);
        if (!rowEl) return;

        const sizeLabel = rowEl.querySelector(".typeface-scale-size");
        const sampleEl = rowEl.querySelector(".typeface-scale-sample");
        if (sizeLabel) {
          sizeLabel.textContent = formatSize(pxSize, unit);
          sizeLabel.dataset.pxValue = String(pxSize);
        }

        if (sampleEl) {
          const rowFont = level.heading ? headingFont : bodyFont;
          const rowWeight = level.heading ? headingWeight : bodyWeight;
          const rowLineHeight = level.heading ? headingLh : bodyLh;

          sampleEl.style.fontSize = `${pxSize}px`;
          sampleEl.style.lineHeight = String(rowLineHeight);
          sampleEl.style.fontFamily = `"${rowFont}", sans-serif`;
          sampleEl.style.fontWeight = rowWeight;
          sampleEl.style.color = bodyColor;
        }
      });

      // Keep heading preview rows in sync with heading controls.
      applyHeadingPreviewStyles();

      // ── Sync typography settings into Responsive previews (figma + blog) ──
      const figmaView = document.querySelector(".typeface-stage-view--figma");
      if (figmaView) {
        const s = figmaView.style;
        s.setProperty("--tp-body-font", `"${bodyFont}", sans-serif`);
        s.setProperty("--tp-body-weight", bodyWeight);
        s.setProperty("--tp-body-lh", String(bodyLh));
        s.setProperty("--tp-body-color", responsiveBodyColor);
        s.setProperty("--tp-body-bg", bodyBg);
        s.setProperty("--tp-heading-font", `"${headingFont}", sans-serif`);
        s.setProperty("--tp-heading-weight", headingWeight);
        s.setProperty("--tp-heading-lh", String(headingLh));

        // Use responsive overrides when the user has edited them, otherwise fall back to main values
        const respLineHeightRaw = String(responsiveLineHeightInput?.value || "").trim();
        const respScaleRaw = String(responsiveScaleInput?.value || "").trim();
        const respLineHeight = Number.parseFloat(respLineHeightRaw) || bodyLh;
        const respRatio = Number.parseFloat(respScaleRaw) || ratio;
        const respBasePx = basePx;

        s.setProperty("--tp-base-px", `${respBasePx}px`);
        s.setProperty("--tp-ratio", String(respRatio));
        s.setProperty("--tp-body-lh", String(respLineHeight));
        s.setProperty("--tp-heading-lh", String(respLineHeight));
        // Pre-compute common scale steps as px values using responsive base & ratio
        s.setProperty("--tp-h1", `${roundTo(respBasePx * Math.pow(respRatio, 6), 2)}px`);
        s.setProperty("--tp-h2", `${roundTo(respBasePx * Math.pow(respRatio, 5), 2)}px`);
        s.setProperty("--tp-h3", `${roundTo(respBasePx * Math.pow(respRatio, 4), 2)}px`);
        s.setProperty("--tp-h4", `${roundTo(respBasePx * Math.pow(respRatio, 3), 2)}px`);
        s.setProperty("--tp-h5", `${roundTo(respBasePx * Math.pow(respRatio, 2), 2)}px`);
        s.setProperty("--tp-h6", `${roundTo(respBasePx * Math.pow(respRatio, 1), 2)}px`);
        s.setProperty("--tp-p", `${roundTo(respBasePx, 2)}px`);
        s.setProperty("--tp-small", `${roundTo(respBasePx * Math.pow(respRatio, -1), 2)}px`);

        // Preview width based on responsive min-width
        const respMinWidth = Number.parseFloat(responsiveMinWidthInput?.value) || 1245;
        figmaView.querySelectorAll(".typeface-figma-preview, .typeface-blog-preview").forEach((el) => {
          figmaView.style.overflowX = "auto";
          figmaView.style.overflowY = "auto";
          el.style.width = `${respMinWidth}px`;
          el.style.minWidth = `${respMinWidth}px`;
          el.style.maxWidth = "none";
          el.style.marginLeft = "auto";
          el.style.marginRight = "auto";
        });
      }

      /* Auto-save edits back to the already-saved typeface entry, then refresh the indicator */
      if (skipAutosave !== true) {
        window.__motvinAutoSaveEditingTypeface?.();
        window.__motvinRefreshTypefaceSaveIndicator?.();
      }
    };

    const adjustHeadingRowSize = (rowName, delta) => {
      const level = SCALE_LEVELS.find((item) => item.row === rowName && item.heading);
      if (!level) return;

      const numericDelta = Number(delta);
      if (!Number.isFinite(numericDelta) || numericDelta === 0) return;

      const basePx = Number.parseFloat(fontSizeInput?.value) || 16;
      const ratio = Number.parseFloat(scaleSelect?.value) || 1.2;
      const currentBaseSize = roundTo(basePx * Math.pow(ratio, level.exp), 2);
      const currentAdjustment = headingSizeAdjustments.get(rowName) || 0;
      const nextAdjustment = roundTo(currentAdjustment + numericDelta, 2);
      const nextSize = roundTo(currentBaseSize + nextAdjustment, 2);
      const minimumSize = Math.max(basePx, 1);

      if (nextSize < minimumSize) {
        headingSizeAdjustments.set(rowName, roundTo(minimumSize - currentBaseSize, 2));
      } else {
        headingSizeAdjustments.set(rowName, nextAdjustment);
      }

      recalculateScale();
    };

    initTypefaceSelectMenu(scaleSelect);
    initTypefaceSelectMenu(bodyWeightSelect);
    initTypefaceSelectMenu(headingWeightSelect);

    document.addEventListener("click", (event) => {
      const clickedInsideDropdown = dropdownShells.some(
        ({ shell, menu }) => shell.contains(event.target) || menu.contains(event.target),
      );
      if (!clickedInsideDropdown) {
        closeTypefaceDropdowns();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeTypefaceDropdowns();
      }
    });

    window.addEventListener(
      "resize",
      () => {
        dropdownShells.forEach(({ shell, menu, syncSelection }) => {
          syncSelection();
          if (!menu.classList.contains("hidden")) {
            positionTypefaceDropdownMenu(shell, menu);
          }
        });
      },
      { passive: true },
    );

    document.addEventListener(
      "scroll",
      (event) => {
        const scrollTarget = event.target;

        dropdownShells.forEach(({ shell, menu }) => {
          if (menu.classList.contains("hidden")) return;

          const scrolledInsideMenu =
            scrollTarget instanceof Node &&
            (menu === scrollTarget || menu.contains(scrollTarget));

          if (scrolledInsideMenu) {
            positionTypefaceDropdownMenu(shell, menu);
            return;
          }

          positionTypefaceDropdownMenu(shell, menu);
        });
      },
      { passive: true, capture: true },
    );

    const bindInput = (el, eventName) => {
      if (!el) return;
      el.addEventListener(eventName || "input", recalculateScale);
    };

    const normalizeHexColor = (value, fallback = "#000000") => {
      const raw = String(value || "").trim();
      const hex = raw.startsWith("#") ? raw : `#${raw}`;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
      if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
        const [, r, g, b] = hex;
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
      }
      return fallback.toUpperCase();
    };

    const hexToRgbChannels = (value, fallback = "#000000") => {
      const clean = normalizeHexColor(value, fallback).slice(1);
      return {
        r: Number.parseInt(clean.slice(0, 2), 16),
        g: Number.parseInt(clean.slice(2, 4), 16),
        b: Number.parseInt(clean.slice(4, 6), 16),
      };
    };

    const getRelativeLuminance = ({ r, g, b }) => {
      const toLinear = (channel) => {
        const c = (Number(channel) || 0) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const rr = toLinear(r);
      const gg = toLinear(g);
      const bb = toLinear(b);
      return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    };

    const getContrastRatio = (l1, l2) => {
      const light = Math.max(l1, l2);
      const dark = Math.min(l1, l2);
      return (light + 0.05) / (dark + 0.05);
    };

    const getAutoContrastTextColor = (backgroundHex) => {
      const bgLum = getRelativeLuminance(hexToRgbChannels(backgroundHex, "#FFFFFF"));
      const whiteLum = getRelativeLuminance({ r: 255, g: 255, b: 255 });
      const blackLum = getRelativeLuminance({ r: 0, g: 0, b: 0 });
      const whiteContrast = getContrastRatio(bgLum, whiteLum);
      const blackContrast = getContrastRatio(bgLum, blackLum);
      return whiteContrast >= blackContrast ? "#FFFFFF" : "#000000";
    };

    let autoContrastBodyColorEnabled = true;
    let activeTypefaceDisplayMode = "scale";

    const swatchPickerPopover = document.createElement("div");
    swatchPickerPopover.className = "styles-palette-picker-popover";
    swatchPickerPopover.setAttribute("aria-hidden", "true");
    swatchPickerPopover.innerHTML = `
      <div class="styles-palette-picker-body">
        <div class="styles-palette-picker-spectrum" role="presentation">
          <div class="styles-palette-picker-spectrum-cursor">
            <div class="styles-palette-picker-spectrum-cursor-dot"></div>
          </div>
        </div>
        <div class="styles-palette-picker-hue-wrap">
          <div class="styles-palette-picker-hue-track" role="presentation"></div>
          <div class="styles-palette-picker-hue-thumb">
            <div class="styles-palette-picker-hue-thumb-dot"></div>
          </div>
        </div>
        <div class="styles-palette-picker-input-row">
          <div class="styles-palette-picker-input-shell">
            <input id="stylesPaletteHexInput" class="styles-palette-picker-hex-input" type="text" inputmode="text" spellcheck="false" maxlength="7" />
          </div>
          <div class="styles-palette-picker-input-preview"></div>
        </div>
      </div>
      <div class="styles-palette-picker-footer">
        <button class="styles-palette-picker-mode" type="button" aria-label="Picker mode" title="">
          <span>Picker</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M15 8.00004C15 8.00004 11.3176 13 10 13C8.68233 13 5 8 5 8" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
        <div class="styles-palette-picker-actions">
          <button class="styles-palette-picker-action styles-palette-picker-eyedropper" type="button" aria-label="Pick from screen">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10.0763 5.25L5.36936 9.95692M5.36936 9.95692L3.62046 11.7058C2.94427 12.382 2.60617 12.7201 2.42809 13.15C2.25 13.5799 2.25 14.0581 2.25 15.0144V15.75H2.98561C3.94189 15.75 4.42004 15.75 4.84997 15.5719C5.27991 15.3938 5.61801 15.0557 6.2942 14.3795L10.7168 9.95692M5.36936 9.95692H10.7168M10.7168 9.95692L12.75 7.92375M14.4065 6.29152L15.615 7.5M14.4065 6.29152L15.0529 5.64511C15.2722 5.42573 15.382 5.31604 15.4583 5.20897C15.8473 4.66257 15.8473 3.92965 15.4583 3.38325C15.382 3.27618 15.2722 3.16648 15.0529 2.9471C14.8335 2.72773 14.7239 2.61802 14.6168 2.54179C14.0704 2.15274 13.3374 2.15274 12.791 2.54179C12.684 2.61802 12.5743 2.72771 12.3549 2.9471L11.7085 3.5935M14.4065 6.29152L11.7085 3.5935M11.7085 3.5935L10.5 2.38501" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <button class="styles-palette-picker-action styles-palette-picker-copy" type="button" aria-label="Copy color code">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12.1093 6.9C12.1076 4.83004 12.0763 3.75785 11.4738 3.0237C11.3574 2.88192 11.2274 2.75193 11.0857 2.63557C10.3112 2 9.16062 2 6.85938 2C4.55814 2 3.40752 2 2.63308 2.63557C2.4913 2.75192 2.3613 2.88192 2.24495 3.0237C1.60937 3.79815 1.60938 4.94876 1.60938 7.25C1.60938 9.55125 1.60937 10.7018 2.24495 11.4763C2.36129 11.6181 2.4913 11.7481 2.63308 11.8644C3.36722 12.467 4.43941 12.4983 6.50938 12.4999M6.50938 11.1C6.50938 9.12012 6.50938 8.13018 7.12445 7.51508C7.73956 6.9 8.7295 6.9 10.7094 6.9H11.4094C13.3893 6.9 14.3792 6.9 14.9943 7.51508C15.6094 8.13018 15.6094 9.12012 15.6094 11.1V11.8C15.6094 13.7799 15.6094 14.7698 14.9943 15.3849C14.3792 16 13.3893 16 11.4094 16H10.7094C8.7295 16 7.73956 16 7.12445 15.3849C6.50938 14.7698 6.50938 13.7799 6.50938 11.8V11.1Z" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(swatchPickerPopover);

    const swatchPickerSpectrum = swatchPickerPopover.querySelector(".styles-palette-picker-spectrum");
    const swatchPickerSpectrumCursor = swatchPickerPopover.querySelector(".styles-palette-picker-spectrum-cursor");
    const swatchPickerSpectrumCursorDot = swatchPickerPopover.querySelector(".styles-palette-picker-spectrum-cursor-dot");
    const swatchPickerHueTrack = swatchPickerPopover.querySelector(".styles-palette-picker-hue-track");
    const swatchPickerHueThumb = swatchPickerPopover.querySelector(".styles-palette-picker-hue-thumb");
    const swatchPickerHueThumbDot = swatchPickerPopover.querySelector(".styles-palette-picker-hue-thumb-dot");
    const swatchPickerHexInput = swatchPickerPopover.querySelector(".styles-palette-picker-hex-input");
    const swatchPickerPreview = swatchPickerPopover.querySelector(".styles-palette-picker-input-preview");
    const swatchPickerModeButton = swatchPickerPopover.querySelector(".styles-palette-picker-mode");
    const swatchPickerEyedropperButton = swatchPickerPopover.querySelector(".styles-palette-picker-eyedropper");
    const swatchPickerCopyButton = swatchPickerPopover.querySelector(".styles-palette-picker-copy");

    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    const clamp360 = (v) => {
      const n = Number(v) || 0;
      return ((n % 360) + 360) % 360;
    };
    const hsvToRgb = (h, s, v) => {
      const hh = clamp360(h) / 60;
      const ss = clamp01(s);
      const vv = clamp01(v);
      const c = vv * ss;
      const x = c * (1 - Math.abs((hh % 2) - 1));
      const m = vv - c;
      let r = 0;
      let g = 0;
      let b = 0;
      if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
      else if (hh < 2) [r, g, b] = [x, c, 0];
      else if (hh < 3) [r, g, b] = [0, c, x];
      else if (hh < 4) [r, g, b] = [0, x, c];
      else if (hh < 5) [r, g, b] = [x, 0, c];
      else [r, g, b] = [c, 0, x];
      return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
      };
    };
    const rgbToHsv = (r, g, b) => {
      const rr = (Number(r) || 0) / 255;
      const gg = (Number(g) || 0) / 255;
      const bb = (Number(b) || 0) / 255;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === rr) h = 60 * (((gg - bb) / d) % 6);
        else if (max === gg) h = 60 * ((bb - rr) / d + 2);
        else h = 60 * ((rr - gg) / d + 4);
      }
      if (h < 0) h += 360;
      const s = max === 0 ? 0 : d / max;
      const v = max;
      return { h, s, v };
    };
    const hexToRgb = (hex) => hexToRgbChannels(hex, "#000000");
    const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

    const swatchPickerState = { h: 212, s: 0.33, v: 0.66 };
    let activeSwatchTextInput = null;
    let activeSwatchShell = null;
    let activeSwatchAnchorShell = null;

    const isSwatchPickerOpen = () => swatchPickerPopover.classList.contains("is-open");

    const positionSwatchPickerPopover = (shell) => {
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const popoverHeight = Math.max(swatchPickerPopover.offsetHeight || 0, 260);
      const viewportTop = window.scrollY + 8;
      const desiredTop = rect.top + window.scrollY - popoverHeight - 8;
      const top = Math.max(viewportTop, desiredTop);
      const left = rect.left + window.scrollX;
      swatchPickerPopover.style.top = `${Math.round(top)}px`;
      swatchPickerPopover.style.left = `${Math.round(left)}px`;
      swatchPickerPopover.style.right = "auto";
      swatchPickerPopover.classList.remove("is-bottom");
    };

    const closeSwatchPickerPopover = () => {
      swatchPickerPopover.classList.remove("is-open");
      swatchPickerPopover.setAttribute("aria-hidden", "true");
      activeSwatchTextInput = null;
      activeSwatchShell = null;
      activeSwatchAnchorShell = null;
    };

    const currentSwatchHex = () => rgbToHex(hsvToRgb(swatchPickerState.h, swatchPickerState.s, swatchPickerState.v));

    const syncSwatchPickerUI = () => {
      const hueRgb = hsvToRgb(swatchPickerState.h, 1, 1);
      const colorHex = currentSwatchHex();
      if (swatchPickerSpectrum) {
        swatchPickerSpectrum.style.background = `linear-gradient(rgba(255, 255, 255, 0) 0%, rgb(0, 0, 0) 100%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgba(255, 255, 255, 0) 100%), rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
      }
      if (swatchPickerSpectrumCursor) {
        swatchPickerSpectrumCursor.style.left = `${(clamp01(swatchPickerState.s) * 100).toFixed(3)}%`;
        swatchPickerSpectrumCursor.style.top = `${((1 - clamp01(swatchPickerState.v)) * 100).toFixed(3)}%`;
      }
      if (swatchPickerSpectrumCursorDot) {
        const rgb = hsvToRgb(swatchPickerState.h, swatchPickerState.s, swatchPickerState.v);
        swatchPickerSpectrumCursorDot.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      }
      if (swatchPickerHueThumb) {
        swatchPickerHueThumb.style.left = `${(clamp360(swatchPickerState.h) / 360 * 100).toFixed(3)}%`;
      }
      if (swatchPickerHueThumbDot) {
        swatchPickerHueThumbDot.style.background = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
      }
      if (swatchPickerPreview) {
        const rgb = hsvToRgb(swatchPickerState.h, swatchPickerState.s, swatchPickerState.v);
        swatchPickerPreview.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      }
      if (swatchPickerHexInput && document.activeElement !== swatchPickerHexInput) {
        swatchPickerHexInput.value = colorHex;
      }
      if (swatchPickerModeButton) {
        swatchPickerModeButton.title = colorHex;
      }
    };

    const applyPickedColorToActiveInput = (value) => {
      if (!activeSwatchTextInput) return;
      const color = normalizeHexColor(value, "#000000");
      activeSwatchTextInput.value = color;
      if (swatchPickerHexInput) swatchPickerHexInput.value = color;
      if (swatchPickerPreview) swatchPickerPreview.style.background = color;
      const { r, g, b } = hexToRgb(color);
      const hsv = rgbToHsv(r, g, b);
      swatchPickerState.h = hsv.h;
      swatchPickerState.s = hsv.s;
      swatchPickerState.v = hsv.v;
      syncSwatchPickerUI();
      activeSwatchTextInput.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const openSwatchPickerPopover = (shell, textInput, fallbackColor, anchorShell = shell) => {
      activeSwatchShell = shell;
      activeSwatchAnchorShell = anchorShell || shell;
      activeSwatchTextInput = textInput;
      const currentColor = normalizeHexColor(textInput.value, fallbackColor);
      if (swatchPickerHexInput) swatchPickerHexInput.value = currentColor;
      if (swatchPickerPreview) swatchPickerPreview.style.background = currentColor;
      const { r, g, b } = hexToRgb(currentColor);
      const hsv = rgbToHsv(r, g, b);
      swatchPickerState.h = hsv.h;
      swatchPickerState.s = hsv.s;
      swatchPickerState.v = hsv.v;
      syncSwatchPickerUI();
      positionSwatchPickerPopover(activeSwatchAnchorShell);
      swatchPickerPopover.classList.add("is-open");
      swatchPickerPopover.setAttribute("aria-hidden", "false");
    };

    if (swatchPickerHexInput) {
      swatchPickerHexInput.addEventListener("input", () => {
        applyPickedColorToActiveInput(swatchPickerHexInput.value);
      });
      swatchPickerHexInput.addEventListener("change", () => {
        applyPickedColorToActiveInput(swatchPickerHexInput.value);
      });
    }

    const bindDrag = (targetEl, onPointer) => {
      if (!targetEl) return;
      const handle = (event) => {
        onPointer(event);
      };
      targetEl.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle(event);
        const move = (ev) => handle(ev);
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      });
    };

    bindDrag(swatchPickerSpectrum, (event) => {
      if (!swatchPickerSpectrum) return;
      const rect = swatchPickerSpectrum.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
      swatchPickerState.s = clamp01(x);
      swatchPickerState.v = 1 - clamp01(y);
      syncSwatchPickerUI();
      applyPickedColorToActiveInput(currentSwatchHex());
    });

    bindDrag(swatchPickerHueTrack, (event) => {
      if (!swatchPickerHueTrack) return;
      const rect = swatchPickerHueTrack.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      swatchPickerState.h = clamp01(x) * 360;
      syncSwatchPickerUI();
      applyPickedColorToActiveInput(currentSwatchHex());
    });

    if (swatchPickerCopyButton) {
      swatchPickerCopyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(currentSwatchHex());
        } catch {
          // no-op
        }
      });
    }

    if (swatchPickerEyedropperButton) {
      swatchPickerEyedropperButton.addEventListener("click", async () => {
        if (!("EyeDropper" in window)) return;
        try {
          const picker = new window.EyeDropper();
          const result = await picker.open();
          if (result?.sRGBHex) {
            applyPickedColorToActiveInput(result.sRGBHex);
          }
        } catch {
          // canceled/no-op
        }
      });
    }

    document.addEventListener("click", (event) => {
      if (!isSwatchPickerOpen()) return;
      const target = event.target;
      if (
        target instanceof Node
        && (
          swatchPickerPopover.contains(target)
          || (activeSwatchShell && activeSwatchShell.contains(target))
          || (activeSwatchAnchorShell && activeSwatchAnchorShell.contains(target))
        )
      ) {
        return;
      }
      closeSwatchPickerPopover();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isSwatchPickerOpen()) {
        closeSwatchPickerPopover();
      }
    });

    window.addEventListener("resize", () => {
      if (isSwatchPickerOpen() && (activeSwatchAnchorShell || activeSwatchShell)) {
        positionSwatchPickerPopover(activeSwatchAnchorShell || activeSwatchShell);
      }
    }, { passive: true });

    document.addEventListener("scroll", () => {
      if (isSwatchPickerOpen() && (activeSwatchAnchorShell || activeSwatchShell)) {
        positionSwatchPickerPopover(activeSwatchAnchorShell || activeSwatchShell);
      }
    }, { passive: true, capture: true });

    const attachSwatchColorPicker = (textInput, fallbackColor) => {
      if (!textInput) return;
      const shell = textInput.closest(".typeface-input-shell--swatch");
      if (!shell || shell.dataset.swatchPickerReady === "true") return;
      shell.dataset.swatchPickerReady = "true";

      const openPicker = () => {
        const colorShell = document.getElementById("typeface-body-color")?.closest(".typeface-input-shell--swatch");
        const shouldUseColorAnchor = textInput.id === "typeface-body-background" && colorShell;
        openSwatchPickerPopover(shell, textInput, fallbackColor, shouldUseColorAnchor ? colorShell : shell);
      };

      shell.addEventListener("click", () => {
        openPicker();
      });

      textInput.addEventListener("focus", () => {
        openPicker();
      });

      const swatch = shell.querySelector(".typeface-color-swatch");
      if (swatch) {
        swatch.style.cursor = "pointer";
      }
    };

    bindInput(fontSizeInput, "input");
    bindInput(scaleSelect, "change");
    bindInput(bodyFontInput, "change");
    bindInput(bodyWeightSelect, "change");
    bindInput(bodyLineHeightInput, "input");
    bindInput(bodyColorInput, "input");
    bindInput(bodyBgInput, "input");
    bindInput(headingFontInput, "change");
    bindInput(headingWeightSelect, "change");
    bindInput(headingLineHeightInput, "input");

    scaleList.addEventListener("click", (event) => {
      /* ── Copy size value on .typeface-scale-size click ── */
      const sizeEl = event.target.closest(".typeface-scale-size");
      if (sizeEl && scaleList.contains(sizeEl)) {
        const value = (sizeEl.textContent || "").trim();
        if (value) {
          navigator.clipboard.writeText(value).then(() => {
            if (typeof showToast === "function") {
              showToast("Copied", `${value} copied to clipboard`, "success");
            }
          }).catch(() => {
            if (typeof showToast === "function") {
              showToast("Copy failed", "Unable to copy to clipboard", "failed");
            }
          });
        }
        return;
      }

      const actionButton = event.target.closest(".typeface-scale-action");
      if (!actionButton || !scaleList.contains(actionButton)) return;

      const rowName = String(actionButton.dataset.scaleRow || "").trim().toLowerCase();
      const delta = Number(actionButton.dataset.scaleAdjust || 0);
      adjustHeadingRowSize(rowName, delta);
    });

    if (bodyColorInput) {
      const disableAutoContrastOnManualColor = () => {
        autoContrastBodyColorEnabled = false;
      };
      bodyColorInput.addEventListener("input", disableAutoContrastOnManualColor);
      bodyColorInput.addEventListener("change", disableAutoContrastOnManualColor);
    }

    [bodyFontInput, bodyWeightSelect, bodyLineHeightInput].forEach((control) => {
      if (!control) return;
      control.addEventListener("input", () => {
        activeScaleStyleGroup = "body";
      });
      control.addEventListener("change", () => {
        activeScaleStyleGroup = "body";
      });
    });

    [headingFontInput, headingWeightSelect, headingLineHeightInput].forEach((control) => {
      if (!control) return;
      control.addEventListener("input", () => {
        activeScaleStyleGroup = "heading";
      });
      control.addEventListener("change", () => {
        activeScaleStyleGroup = "heading";
      });
    });

    [headingFontInput, headingWeightSelect, headingLineHeightInput].forEach((control) => {
      if (!control) return;
      control.addEventListener("input", applyHeadingPreviewStyles);
      control.addEventListener("change", applyHeadingPreviewStyles);
    });

    let fontInputDebounceId = 0;
    const debouncedFontLoad = (input) => {
      if (fontInputDebounceId) window.clearTimeout(fontInputDebounceId);
      fontInputDebounceId = window.setTimeout(() => {
        const fontName = String(input?.value || "").trim();
        if (fontName) {
          loadGoogleFont(fontName);
          recalculateScale();
        }
      }, 600);
    };

    // Init searchable Google Fonts picker for font inputs
    initFontPicker(bodyFontInput);
    initFontPicker(headingFontInput);

    // Enable click-to-open native color picker on swatch shells.
    attachSwatchColorPicker(bodyColorInput, "#000000");
    attachSwatchColorPicker(bodyBgInput, "#FFFFFF");

    // ── Responsive section inputs → update previews on change ──
    [responsiveMinWidthInput, responsiveLineHeightInput, responsiveScaleInput].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("input", () => { responsiveManuallyEdited = true; recalculateScale(); });
      inp.addEventListener("change", () => { responsiveManuallyEdited = true; recalculateScale(); });
    });

    recalculateScale(true);
    applyHeadingPreviewStyles();
    updateTypefaceHistoryButtons();

    const serializeTypefaceSnapshot = (snap = captureTypefaceSnapshot()) => ({
      fontSize: String(snap?.fontSize ?? ""),
      scale: String(snap?.scale ?? ""),
      bodyFont: String(snap?.bodyFont ?? ""),
      bodyWeight: String(snap?.bodyWeight ?? ""),
      bodyLh: String(snap?.bodyLh ?? ""),
      bodyColor: String(snap?.bodyColor ?? ""),
      bodyBg: String(snap?.bodyBg ?? ""),
      headingFont: String(snap?.headingFont ?? ""),
      headingWeight: String(snap?.headingWeight ?? ""),
      headingLh: String(snap?.headingLh ?? ""),
      respMinWidth: String(snap?.respMinWidth ?? ""),
      respLineHeight: String(snap?.respLineHeight ?? ""),
      respScale: String(snap?.respScale ?? ""),
      headingAdj: Array.from(snap?.headingAdj instanceof Map ? snap.headingAdj.entries() : [])
        .sort(([leftKey], [rightKey]) => String(leftKey).localeCompare(String(rightKey))),
      respManual: Boolean(snap?.respManual),
    });

    const buildTypefacePresetName = (snap = captureTypefaceSnapshot()) => {
      const bodyFont = String(snap?.bodyFont || "").trim();
      const headingFont = String(snap?.headingFont || "").trim();
      const baseSize = String(snap?.fontSize || "").trim();
      const scale = String(snap?.scale || "").trim();
      const fontLabel = headingFont || bodyFont || "Inter";
      const parts = [fontLabel];

      if (baseSize) {
        parts.push(`${baseSize}px`);
      }

      if (scale) {
        parts.push(scale);
      }

      return parts.join(" · ");
    };

    window.__motvinCaptureTypefaceSnapshot = () => serializeTypefaceSnapshot();
    window.__motvinBuildTypefacePresetName = () => buildTypefacePresetName();
    window.__motvinRestoreTypefaceSnapshot = (snapshot) => restoreSerializedTypefaceSnapshot(snapshot);

    try {
      const pendingSnapshotRaw = sessionStorage.getItem(TYPEFACE_PENDING_SNAPSHOT_KEY)
        || localStorage.getItem(TYPEFACE_PENDING_SNAPSHOT_KEY);
      const forceNewTypefaceSave = sessionStorage.getItem(TYPEFACE_FORCE_NEW_KEY)
        || localStorage.getItem(TYPEFACE_FORCE_NEW_KEY);
      const editingTypefaceId = sessionStorage.getItem(TYPEFACE_EDITING_ID_KEY)
        || localStorage.getItem(TYPEFACE_EDITING_ID_KEY);

      if (forceNewTypefaceSave) {
        window.__motvinTypefaceForceNewSave = true;
        window.__motvinTypefaceEditingId = "";
      } else if (editingTypefaceId) {
        window.__motvinTypefaceForceNewSave = false;
        window.__motvinTypefaceEditingId = String(editingTypefaceId);
      } else {
        window.__motvinTypefaceForceNewSave = false;
        window.__motvinTypefaceEditingId = "";
      }

      if (pendingSnapshotRaw) {
        restoreSerializedTypefaceSnapshot(JSON.parse(pendingSnapshotRaw));
        sessionStorage.removeItem(TYPEFACE_PENDING_SNAPSHOT_KEY);
        localStorage.removeItem(TYPEFACE_PENDING_SNAPSHOT_KEY);
      }

      sessionStorage.removeItem(TYPEFACE_FORCE_NEW_KEY);
      localStorage.removeItem(TYPEFACE_FORCE_NEW_KEY);
      sessionStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
      localStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
    } catch {}

    // Keyboard shortcuts for undo/redo
    document.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("typeface-page")) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) { e.preventDefault(); typefaceUndo(); }
      if (isMod && e.key === "z" && e.shiftKey) { e.preventDefault(); typefaceRedo(); }
      if (isMod && e.key === "y") { e.preventDefault(); typefaceRedo(); }
    });

    window.addEventListener("typeface-display-mode-changed", (event) => {
      const nextMode = String(event?.detail?.mode || "").toLowerCase();
      activeTypefaceDisplayMode = nextMode === "figma" ? "figma" : "scale";
      if (activeTypefaceDisplayMode === "figma") {
        recalculateScale();
      }
    });

    window.addEventListener("typeface-unit-changed", recalculateScale);
  };

  const INSTANT_PAGE_SWITCH_KEY = "motvin.instant-page-switch";
  const SUPPRESS_AUTOSAVE_TOAST_KEY = "motvin.suppress-autosave-toast";
  const SUPPRESS_TOASTS_UNTIL_KEY = "motvin.suppress-toasts-until";
  const AUTO_SWITCH_STANDARD_KEY = "motvin.auto-switch-standard";
  const TAB_SWITCH_TOAST_SUPPRESSION_MS = 2200;
  const markInstantPageSwitch = (targetHref) => {
    try {
      const normalizedTarget = String(targetHref || "").trim().toLowerCase();
      const suppressUntil = String(Date.now() + TAB_SWITCH_TOAST_SUPPRESSION_MS);
      sessionStorage.setItem(
        INSTANT_PAGE_SWITCH_KEY,
        normalizedTarget,
      );
      sessionStorage.setItem(SUPPRESS_AUTOSAVE_TOAST_KEY, normalizedTarget);
      sessionStorage.setItem(SUPPRESS_TOASTS_UNTIL_KEY, suppressUntil);
    } catch {
      /* no-op */
    }
  };

  const navigateWithPageSwitch = (targetHref) => {
    const normalizedTarget = String(targetHref || "").trim();
    if (!normalizedTarget) return;

    markInstantPageSwitch(normalizedTarget);
    window.location.href = normalizedTarget;
  };

  const getReleaseUpdatesHref = () => new URL("./updates/", window.location.href).href;

  const consumeInstantPageSwitch = () => {
    try {
      const target = String(
        sessionStorage.getItem(INSTANT_PAGE_SWITCH_KEY) || "",
      ).trim().toLowerCase();
      if (!target) return false;
      sessionStorage.removeItem(INSTANT_PAGE_SWITCH_KEY);
      return target === getCurrentFileName();
    } catch {
      return false;
    }
  };

  const consumeAutoSaveToastSuppression = () => {
    try {
      const target = String(
        sessionStorage.getItem(SUPPRESS_AUTOSAVE_TOAST_KEY) || "",
      ).trim().toLowerCase();
      if (!target) return false;
      sessionStorage.removeItem(SUPPRESS_AUTOSAVE_TOAST_KEY);
      return target === getCurrentFileName();
    } catch {
      return false;
    }
  };

  const consumeToastSuppressionUntil = () => {
    try {
      const rawValue = sessionStorage.getItem(SUPPRESS_TOASTS_UNTIL_KEY) || "";
      if (!rawValue) return 0;
      sessionStorage.removeItem(SUPPRESS_TOASTS_UNTIL_KEY);
      const timestamp = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(timestamp)) return 0;
      return timestamp;
    } catch {
      return 0;
    }
  };

  const clearInstantPageSwitchClass = () => {
    document.documentElement.classList.remove("instant-page-switch");
  };

  const scheduleInstantPageSwitchCleanup = () => {
    if (!document.documentElement.classList.contains("instant-page-switch")) {
      return;
    }

    const clearAfterPaint = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          // Small delay so the CSS entry animation can trigger before removing the class
          window.setTimeout(clearInstantPageSwitchClass, 60);
        });
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", clearAfterPaint, {
        once: true,
      });
      return;
    }

    clearAfterPaint();
  };

  // ── Stamp data-tp-tag on text elements for hover labels ──
  // Labels match the exact --tp-* CSS custom property each element uses:
  //   --tp-h1 → "h1", --tp-h2 → "h2", --tp-h3 → "h3", --tp-h4 → "h4",
  //   --tp-h5 → "h5", --tp-h6 → "h6", --tp-p → "p", --tp-small → "Ss"
  //   Elements with no --tp-* font-size (inherited from parent) → "s"
  const stampTypefaceTagLabels = () => {
    // selector → label  (ordered specific → generic; last match wins)
    const FIGMA_MAP = [
      // ── Landing page ──
      [".typeface-figma-brand", "h5"],                    // heading-font
      [".typeface-figma-nav", "Ss"],                      // --tp-small
      [".typeface-figma-link", "Ss"],                     // --tp-small
      [".typeface-figma-btn", "p"],                       // --tp-p (default btn)
      [".typeface-figma-title", "h1"],                    // --tp-h1
      [".typeface-figma-subtitle", "h5"],                 // --tp-h5
      [".typeface-figma-badge", "Ss"],                    // --tp-small
      [".typeface-figma-kicker", "Ss"],                   // --tp-small
      [".typeface-figma-feature h3", "h3"],               // --tp-h3
      [".typeface-figma-feature p", "p"],                 // --tp-p
      [".typeface-figma-method-copy h2", "h2"],           // --tp-h2
      [".typeface-figma-method-lead", "h5"],              // --tp-h5
      [".typeface-figma-method-item-copy strong", "p"],   // --tp-p
      [".typeface-figma-method-item-copy span", "p"],     // --tp-p
      [".typeface-figma-stat-card-inner", "h5"],          // --tp-h5
      [".typeface-figma-testimonial blockquote", "h3"],   // --tp-h3
      [".typeface-figma-testimonial strong", "p"],        // --tp-p
      [".typeface-figma-testimonial span", "Ss"],         // --tp-small
      [".typeface-figma-cta-copy h2", "h4"],              // --tp-h4
      [".typeface-figma-cta-copy p", "p"],                // --tp-p
      [".typeface-figma-cta-band .typeface-figma-btn", "p"], // --tp-p (btn)
      [".typeface-figma-hero .typeface-figma-btn", "h5"], // --tp-h5 (hero btn)
      [".typeface-figma-footer", "Ss"],                   // --tp-small
    ];
    const BLOG_MAP = [
      // ── Blog page ──
      [".typeface-blog-article-title", "h2"],             // --tp-h2
      [".typeface-blog-article-excerpt", "h5"],           // --tp-h5
      [".typeface-blog-body h2", "h3"],                   // --tp-h3
      [".typeface-blog-body h3", "h4"],                   // --tp-h4
      [".typeface-blog-body p", "p"],                     // --tp-p
      [".typeface-blog-pullquote", "h5"],                 // --tp-h5
      [".typeface-blog-brand", "h5"],                     // --tp-h5
      [".typeface-blog-nav span", "Ss"],                  // --tp-small
      [".typeface-blog-category", "Ss"],                  // --tp-small
      [".typeface-blog-date", "Ss"],                      // --tp-small
      [".typeface-blog-author-info strong", "Ss"],        // --tp-small
      [".typeface-blog-author-info span", "Ss"],          // --tp-small
      [".typeface-blog-sidebar-title", "Ss"],             // --tp-small
      [".typeface-blog-related-card strong", "Ss"],       // --tp-small
      [".typeface-blog-related-tag", "Ss"],               // --tp-small
      [".typeface-blog-related-date", "Ss"],              // --tp-small
      [".typeface-blog-footer", "Ss"],                    // --tp-small
    ];
    const ALL = [...FIGMA_MAP, ...BLOG_MAP];
    document.querySelectorAll(".typeface-figma-preview, .typeface-blog-preview").forEach((root) => {
      // Clear any stale labels first
      root.querySelectorAll("[data-tp-tag]").forEach((el) => el.removeAttribute("data-tp-tag"));
      ALL.forEach(([sel, label]) => {
        root.querySelectorAll(sel).forEach((el) => {
          el.setAttribute("data-tp-tag", label);
        });
      });
    });
  };
  stampTypefaceTagLabels();

  initTypefaceUnitSwitch();
  initTypefaceDisplaySwitch();
  initTypefaceSettings();

  const closeUiModeMenu = () => {
    if (!uiModeMenu || !settingsBtn) return;
    uiModeMenu.classList.add("hidden");
    uiModeMenu.style.position = "";
    uiModeMenu.style.left = "";
    uiModeMenu.style.top = "";
    uiModeMenu.style.bottom = "";
    uiModeMenu.style.zIndex = "";
    settingsBtn.setAttribute("aria-expanded", "false");
    applyStripButtonState(settingsBtn, "default");
  };

  const positionUiModeMenuForCollapsedSidebar = () => {
    if (!uiModeMenu || !settingsBtn) return;
    const collapsed = Boolean(sidebarLeftForUiMenu?.classList.contains("collapsed"));
    if (!collapsed) {
      uiModeMenu.style.position = "";
      uiModeMenu.style.left = "";
      uiModeMenu.style.top = "";
      uiModeMenu.style.bottom = "";
      uiModeMenu.style.zIndex = "";
      return;
    }

    const rect = settingsBtn.getBoundingClientRect();
    uiModeMenu.style.position = "fixed";
    uiModeMenu.style.left = `${Math.round(rect.right + 10)}px`;
    uiModeMenu.style.top = `${Math.round(rect.bottom - uiModeMenu.offsetHeight)}px`;
    uiModeMenu.style.bottom = "auto";
    uiModeMenu.style.zIndex = "3000";
  };

  const openUiModeMenu = () => {
    if (!uiModeMenu || !settingsBtn) return;
    uiModeMenu.classList.remove("hidden");
    positionUiModeMenuForCollapsedSidebar();
    settingsBtn.setAttribute("aria-expanded", "true");
    applyStripButtonState(settingsBtn, "active");
  };

  let uiModeTransitionCleanupId = 0;

  const suppressUiModeTransitions = () => {
    if (!document.body) return;

    document.documentElement.classList.add("ui-mode-switching");
    document.body.classList.add("ui-mode-switching");

    if (uiModeTransitionCleanupId) {
      window.clearTimeout(uiModeTransitionCleanupId);
    }

    const clearSuppression = () => {
      document.documentElement.classList.remove("ui-mode-switching");
      document.body.classList.remove("ui-mode-switching");
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        uiModeTransitionCleanupId = window.setTimeout(clearSuppression, 40);
      });
    });
  };

  const applyUiMode = (mode, options = {}) => {
    const { persist = true, animate = false } = options;
    const normalizedMode = mode === "standard" ? "standard" : "floating";

    if (!animate) suppressUiModeTransitions();
    document.documentElement.classList.remove(
      "ui-mode-standard-preload",
      "ui-mode-floating-preload",
    );

    document.body.classList.toggle("ui-mode-standard", normalizedMode === "standard");
    document.body.classList.toggle("ui-mode-floating", normalizedMode !== "standard");

    if (uiModeFloatingBtn) {
      uiModeFloatingBtn.classList.toggle("active", normalizedMode === "floating");
      uiModeFloatingBtn.setAttribute(
        "aria-pressed",
        String(normalizedMode === "floating"),
      );
    }
    if (uiModeStandardBtn) {
      uiModeStandardBtn.classList.toggle("active", normalizedMode === "standard");
      uiModeStandardBtn.setAttribute(
        "aria-pressed",
        String(normalizedMode === "standard"),
      );
    }

    if (persist) {
      try {
        localStorage.setItem(UI_MODE_STORAGE_KEY, normalizedMode);
      } catch (e) {
        console.warn("Unable to persist UI mode:", e);
      }
    }
  };

  const updateSettingsAuthUi = async () => {
    if (!urlBetaAuthBtn || !urlBetaAuthBtnLabel || !urlBetaAuthStatus) return;

    urlBetaAuthBtn.disabled = false;
    try {
      const service = await getSettingsFirebaseUrlBetaService();
      if (!service?.enabled) {
        settingsAuthUser = null;
        applySidebarProfileBadgeState({ signedIn: false, user: null });
        urlBetaAuthBtn.disabled = true;
        const reason = String(service?.reason || "firebase-disabled");
        if (reason === "missing-firebase-config") {
          const missing = Array.isArray(service?.missingConfigFields)
            ? service.missingConfigFields.join(", ")
            : "required env keys";
          urlBetaAuthBtnLabel.textContent = "Firebase config missing";
          urlBetaAuthStatus.textContent = `Missing: ${missing}`;
        } else if (reason === "firebase-init-failed") {
          const errorCode = String(service?.initErrorCode || "firebase/init-failed");
          urlBetaAuthBtnLabel.textContent = "Firebase init failed";
          urlBetaAuthStatus.textContent = `URL Beta sign-in unavailable (${errorCode})`;
        } else {
          urlBetaAuthBtnLabel.textContent = "Firebase unavailable";
          urlBetaAuthStatus.textContent = "URL Beta sign-in unavailable";
        }
        return;
      }

      ensureSettingsAuthListener(service);

      const signedIn = await service.ensureSignedIn({ interactive: false });
      const wasSignedIn = settingsUrlBetaSignedIn;
      settingsUrlBetaSignedIn = Boolean(signedIn);
      window.__motvinIsSignedIn = settingsUrlBetaSignedIn;
      if (typeof service.getCurrentUser === "function") {
        const currentAuthUser = service.getCurrentUser();
        if (currentAuthUser?.uid) {
          settingsAuthUser = currentAuthUser;
        } else if (!settingsUrlBetaSignedIn) {
          settingsAuthUser = null;
        }
      }
      applySidebarProfileBadgeState({
        signedIn: settingsUrlBetaSignedIn,
        user: settingsAuthUser,
      });

      // Pull cloud data on initial auth resolve (covers the race where
      // onAuthChanged already saw the user but settingsUrlBetaSignedIn
      // hadn't been updated yet, causing the early-return guard to skip sync).
      if (settingsUrlBetaSignedIn && !wasSignedIn) {
        await syncFirestoreToLocal(service);
      }
      if (signedIn) {
        if (urlBetaAuthBtnIcon) {
          urlBetaAuthBtnIcon.innerHTML = AUTH_ICON_MARKUP.signedIn;
        }
        urlBetaAuthBtnLabel.textContent = "Sign out";
        try {
          const remaining = await service.getRemaining();
          if (Number.isFinite(remaining)) {
            urlBetaAuthStatus.textContent = `Signed in — ${remaining} left today`;
          } else {
            urlBetaAuthStatus.textContent = `Signed in — ${URL_BETA_DAILY_LIMIT} left today`;
          }
        } catch {
          urlBetaAuthStatus.textContent = `Signed in — ${URL_BETA_DAILY_LIMIT} left today`;
        }
      } else {
        if (urlBetaAuthBtnIcon) {
          urlBetaAuthBtnIcon.innerHTML = AUTH_ICON_MARKUP.signedOut;
        }
        urlBetaAuthBtnLabel.textContent = "Sign in / Sign up";
        urlBetaAuthStatus.textContent = "Not signed in";
      }
    } catch {
      settingsUrlBetaSignedIn = false;
      settingsAuthUser = null;
      applySidebarProfileBadgeState({ signedIn: false, user: null });
      if (urlBetaAuthBtnIcon) {
        urlBetaAuthBtnIcon.innerHTML = AUTH_ICON_MARKUP.signedOut;
      }
      urlBetaAuthBtnLabel.textContent = "Sign in / Sign up";
      urlBetaAuthStatus.textContent = "Sign-in unavailable";
    }
  };

  const startSettingsGoogleSignIn = async () => {
    if (!urlBetaAuthBtn || !urlBetaAuthBtnLabel || !urlBetaAuthStatus) return;

    urlBetaAuthBtn.disabled = true;
    urlBetaAuthBtnLabel.textContent = "Signing in...";
    try {
      const service = await getSettingsFirebaseUrlBetaService();
      if (!service?.enabled) {
        const reason = String(service?.reason || "firebase-disabled");
        if (reason === "missing-firebase-config") {
          urlBetaAuthStatus.textContent = "Firebase config missing";
        } else if (reason === "firebase-init-failed") {
          const errorCode = String(service?.initErrorCode || "firebase/init-failed");
          urlBetaAuthStatus.textContent = `Firebase init failed (${errorCode})`;
        } else {
          urlBetaAuthStatus.textContent = "Firebase unavailable";
        }
        return;
      }

      const ok = await service.ensureSignedIn({ interactive: true });
      if (ok) {
        settingsUrlBetaSignedIn = true;
        window.__motvinIsSignedIn = true;
        // Explicitly sync cloud → local (onAuthChanged may skip due to flag race)
        await syncFirestoreToLocal(service);
        let remaining = URL_BETA_DAILY_LIMIT;
        try {
          const r = await service.getRemaining();
          if (Number.isFinite(r)) remaining = r;
        } catch { /* use default */ }
        urlBetaAuthStatus.textContent = `Signed in — Cloud storage connected`;
        if (typeof showToast === "function") {
          let pCount = 0, tCount = 0;
          try { pCount = (JSON.parse(localStorage.getItem("motvin.palette-collection.v1")) || []).length; } catch {}
          try { tCount = (JSON.parse(localStorage.getItem(TYPEFACE_COLLECTION_KEY)) || []).length; } catch {}
          showToast("Signed in", `Cloud storage connected. You've used ${pCount} palettes and ${tCount} typefaces out of 10.`, "success");
        }
        window.dispatchEvent(new Event("url-beta-auth-changed"));
      } else {
        const authError =
          typeof service.getLastAuthError === "function"
            ? service.getLastAuthError()
            : null;
        const errorCode = String(authError?.code || "auth/unknown");
        if (errorCode === "auth/redirect-started") {
          urlBetaAuthStatus.textContent = "Redirecting to Google sign-in...";
        } else {
          urlBetaAuthStatus.textContent = `Sign-in failed (${errorCode})`;
        }
      }
    } catch {
      settingsUrlBetaSignedIn = false;
      urlBetaAuthStatus.textContent = "Sign-in failed";
    } finally {
      urlBetaAuthBtn.disabled = false;
      await updateSettingsAuthUi();
    }
  };

  const startSettingsGoogleSignOut = async () => {
    if (!urlBetaAuthBtn || !urlBetaAuthBtnLabel || !urlBetaAuthStatus) return;

    urlBetaAuthBtn.disabled = true;
    urlBetaAuthBtnLabel.textContent = "Signing out...";
    try {
      const service = await getSettingsFirebaseUrlBetaService();
      if (service?.enabled && typeof service.signOut === "function") {
        await service.signOut();
      }
      settingsUrlBetaSignedIn = false;
      window.__motvinIsSignedIn = false;
      // Explicitly clear local cache (onAuthChanged may skip due to flag race)
      clearLocalCollectionCache();
      urlBetaAuthStatus.textContent = "Signed out — sign in to save your work";
      if (typeof showToast === "function") {
        showToast("Signed out", "Cloud storage disconnected. Sign in to save palettes and typefaces and access URL.", "success");
      }
      window.dispatchEvent(new Event("url-beta-auth-changed"));
    } catch {
      settingsUrlBetaSignedIn = true;
      urlBetaAuthStatus.textContent = "Sign-out failed";
    } finally {
      urlBetaAuthBtn.disabled = false;
      await updateSettingsAuthUi();
    }
  };

  stripBtns.forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (btn.classList.contains("active")) return;
      applyStripButtonState(btn, "hover");
    });

    btn.addEventListener("mouseleave", () => {
      if (btn.classList.contains("active")) {
        applyStripButtonState(btn, "active");
        return;
      }
      applyStripButtonState(btn, "default");
    });

    btn.addEventListener("click", () => {
      if (!btn.dataset.tab) return;

      const currentFileName = getCurrentFileName();
      const targetTab = String(btn.dataset.tab || "").toLowerCase();

      if (targetTab === "styles") {
        try {
          localStorage.removeItem(PALETTE_EDITING_ID_KEY);
          localStorage.setItem(PALETTE_FORCE_NEW_KEY, "1");
        } catch {
          /* no-op */
        }
        window.__motvinPaletteEditingId = "";
        window.__motvinPaletteForceNewSave = true;
        window.__motvinRefreshPaletteSaveIndicator?.();
      } else if (targetTab === "typeface") {
        try {
          sessionStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
          sessionStorage.setItem(TYPEFACE_FORCE_NEW_KEY, "1");
        } catch {
          try {
            localStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
            localStorage.setItem(TYPEFACE_FORCE_NEW_KEY, "1");
          } catch {
            /* no-op */
          }
        }
        window.__motvinTypefaceEditingId = "";
        window.__motvinTypefaceForceNewSave = true;
        window.__motvinRefreshTypefaceSaveIndicator?.();
      }

      const targetHref = String(btn.dataset.href || "").trim();
      if (targetHref) {
        if (currentFileName !== targetHref.toLowerCase()) {
          suppressToastsUntil = Date.now() + TAB_SWITCH_TOAST_SUPPRESSION_MS;
          hideToastImmediately();

          // Determine navigation direction for smart UI mode animation.
          const fromPage = currentFileName;
          const isFromProject = fromPage === "files.html";
          const isFromStylesOrTypeface = fromPage === "styles.html" || fromPage === "typeface.html";
          const isToStylesOrTypeface = targetTab === "styles" || targetTab === "typeface";
          const isToProject = targetTab === "project";

          // Project (floating) → Styles / Typeface: animate to standard.
          if (isFromProject && isToStylesOrTypeface && document.body.classList.contains("ui-mode-floating")) {
            try { sessionStorage.setItem(AUTO_SWITCH_STANDARD_KEY, targetHref.toLowerCase()); } catch { /* no-op */ }
          }

          // Styles ↔ Typeface: open directly in standard UI (no animation delay).
          if (isFromStylesOrTypeface && isToStylesOrTypeface) {
            try { sessionStorage.setItem(AUTO_SWITCH_STANDARD_KEY, "__direct__"); } catch { /* no-op */ }
          }

          // Styles / Typeface → Project: restore user's saved UI mode.
          if (isFromStylesOrTypeface && isToProject) {
            try { sessionStorage.setItem(AUTO_SWITCH_STANDARD_KEY, "__restore__"); } catch { /* no-op */ }
          }

          navigateWithPageSwitch(targetHref);
          return;
        }
      }

      activateStripButton(btn);
    });
  });

  const routeMatchedStripBtn = primaryStripBtns.find(
    (btn) => String(btn.dataset.href || "").trim().toLowerCase() === getCurrentFileName(),
  );
  const initiallyActiveStripBtn =
    routeMatchedStripBtn ||
    primaryStripBtns.find((btn) => btn.classList.contains("active")) ||
    primaryStripBtns[0];
  activateStripButton(initiallyActiveStripBtn);

  // UI Mode settings (Floating UI / Standard UI)
  if (settingsBtn && uiModeMenu) {
    settingsBtn.setAttribute("aria-haspopup", "menu");
    settingsBtn.setAttribute("aria-expanded", "false");

    settingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !uiModeMenu.classList.contains("hidden");
      if (isOpen) closeUiModeMenu();
      else openUiModeMenu();
    });

    uiModeMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      closeUiModeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeUiModeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (!uiModeMenu.classList.contains("hidden")) {
        positionUiModeMenuForCollapsedSidebar();
      }
    });

    window.addEventListener("scroll", () => {
      if (!uiModeMenu.classList.contains("hidden")) {
        positionUiModeMenuForCollapsedSidebar();
      }
    });
  }

  if (uiModeFloatingBtn) {
    uiModeFloatingBtn.addEventListener("click", () => {
      applyUiMode("floating", { animate: true });
      closeUiModeMenu();
    });
  }

  if (uiModeStandardBtn) {
    uiModeStandardBtn.addEventListener("click", () => {
      applyUiMode("standard", { animate: true });
      closeUiModeMenu();
    });
  }

  if (uiModeReleaseUpdatesBtn) {
    uiModeReleaseUpdatesBtn.addEventListener("click", () => {
      closeUiModeMenu();
      navigateWithPageSwitch(getReleaseUpdatesHref());
    });
  }

  let savedUiMode = "floating";
  try {
    savedUiMode = localStorage.getItem(UI_MODE_STORAGE_KEY) || "floating";
  } catch (e) {
    console.warn("Unable to read saved UI mode:", e);
  }

  // Styles & Typeface pages always use standard UI on direct refresh.
  // But if AUTO_SWITCH_STANDARD_KEY is set, the user navigated here from
  // another tab — let the animation logic below handle the transition.
  const _currentPage = getCurrentFileName();
  const _hasAutoSwitch = !!sessionStorage.getItem(AUTO_SWITCH_STANDARD_KEY);
  if ((_currentPage === "styles.html" || _currentPage === "typeface.html") && !_hasAutoSwitch) {
    applyUiMode("standard", { persist: false });
  } else {
    applyUiMode(savedUiMode, { persist: false });
  }

  // Smart animation: auto-switch from floating → standard after 1 s when
  // the user navigated to Styles / Typeface from the Project tab's floating UI.
  try {
    const autoSwitchTarget = String(
      sessionStorage.getItem(AUTO_SWITCH_STANDARD_KEY) || "",
    ).trim().toLowerCase();
    if (autoSwitchTarget) {
      sessionStorage.removeItem(AUTO_SWITCH_STANDARD_KEY);

      if (autoSwitchTarget === "__direct__") {
        // Styles ↔ Typeface — already in standard, apply immediately.
        applyUiMode("standard", { persist: false });
      } else if (autoSwitchTarget === "__restore__" && getCurrentFileName() === "files.html") {
        // Returning to Project tab — start in standard, then animate to
        // the user's saved UI mode (e.g. floating) after 1 s.
        const userSavedMode = savedUiMode || "floating";
        if (userSavedMode !== "standard") {
          applyUiMode("standard", { persist: false });
          setTimeout(() => {
            applyUiMode(userSavedMode, { persist: false, animate: true });
          }, 1000);
        }
      } else if (
        autoSwitchTarget === getCurrentFileName() &&
        document.body.classList.contains("ui-mode-floating")
      ) {
        // Arriving at Styles/Typeface from Project — start in floating,
        // then animate to standard after 1 s.
        setTimeout(() => {
          applyUiMode("standard", { persist: false, animate: true });
        }, 1000);
      }
    }
  } catch { /* no-op */ }

  const handleSettingsAuthAction = async () => {
    let currentlySignedIn = settingsUrlBetaSignedIn;
    try {
      const service = await getSettingsFirebaseUrlBetaService();
      if (service?.enabled && typeof service.ensureSignedIn === "function") {
        currentlySignedIn = Boolean(
          await service.ensureSignedIn({ interactive: false }),
        );
      }
    } catch {
      // Fallback to last known state.
    }

    if (currentlySignedIn) {
      void startSettingsGoogleSignOut();
    } else {
      void startSettingsGoogleSignIn();
    }
  };

  if (urlBetaAuthBtn) {
    urlBetaAuthBtn.addEventListener("click", () => {
      void handleSettingsAuthAction();
    });
  }

  if (sidebarProfileBadges.length > 0) {
    sidebarProfileBadges.forEach((badgeEl) => {
      badgeEl.addEventListener("click", () => {
        toggleSidebarProfileMenu(badgeEl);
      });

      badgeEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSidebarProfileMenu(badgeEl);
        }

        if (event.key === "Escape" && sidebarProfileMenu && !sidebarProfileMenu.classList.contains("hidden")) {
          event.preventDefault();
          closeSidebarProfileMenu({ restoreFocus: true });
        }
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (!sidebarProfileMenu || sidebarProfileMenu.classList.contains("hidden")) return;
    if (sidebarProfileMenu.contains(event.target)) return;
    if (sidebarProfileBadges.some((badgeEl) => badgeEl.contains(event.target))) return;
    closeSidebarProfileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebarProfileMenu && !sidebarProfileMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeSidebarProfileMenu({ restoreFocus: true });
    }
  });

  window.addEventListener("resize", () => {
    if (sidebarProfileMenu && !sidebarProfileMenu.classList.contains("hidden")) {
      positionSidebarProfileMenu(activeSidebarProfileBadge);
    }
  }, { passive: true });

  window.addEventListener("scroll", () => {
    if (sidebarProfileMenu && !sidebarProfileMenu.classList.contains("hidden")) {
      closeSidebarProfileMenu();
    }
  }, true);
  void updateSettingsAuthUi();

  const applyTreeTabState = (tab, stateName) => {
    if (!tab) return;

    const normalizedState =
      stateName === "active"
        ? "active"
        : stateName === "hover"
          ? "hover"
          : "default";
    tab.dataset.state = normalizedState;

    const stateImgs = tab.querySelectorAll("img[data-default-src]");
    stateImgs.forEach((img) => {
      const src =
        normalizedState === "active"
          ? img.dataset.activeSrc || img.dataset.defaultSrc
          : normalizedState === "hover"
            ? img.dataset.hoverSrc || img.dataset.defaultSrc
            : img.dataset.defaultSrc;
      if (src) img.src = src;
    });
  };

  const syncTreeTabState = (tab) => {
    if (!tab) return;
    if (tab.classList.contains("active")) {
      applyTreeTabState(tab, "active");
      return;
    }
    applyTreeTabState(tab, tab.matches(":hover") ? "hover" : "default");
  };

  // Sidebar tree-tab accordion toggling
  const accordions = document.querySelectorAll(".tree-accordion");
  accordions.forEach((accordion) => {
    const tab = accordion.querySelector(".tree-tab");
    if (!tab) return;

    tab.addEventListener("mouseenter", () => {
      if (tab.classList.contains("active")) return;
      applyTreeTabState(tab, "hover");
    });

    tab.addEventListener("mouseleave", () => {
      syncTreeTabState(tab);
    });

    tab.addEventListener("click", () => {
      const isOpen = accordion.classList.contains("open");

      // Keep right sidebar panel in sync with selected left tree tab.
      if (accordion.id === "accordionCode2design") {
        showPropertiesInspectorPanel();
      } else if (accordion.id === "accordionStyles") {
        showStylesInspectorPanel();
      }

      // Close all other accordions and deactivate their headers
      accordions.forEach((otherAccordion) => {
        if (otherAccordion !== accordion) {
          otherAccordion.classList.remove("open");
          const otherTab = otherAccordion.querySelector(".tree-tab");
          if (otherTab) {
            otherTab.classList.remove("active");
            syncTreeTabState(otherTab);
          }
        }
      });

      if (isOpen) {
        accordion.classList.remove("open");
        tab.classList.remove("active");
      } else {
        accordion.classList.add("open");
        tab.classList.add("active");
      }
      syncTreeTabState(tab);
      refreshActiveExplorerTrees();
    });

    syncTreeTabState(tab);
  });

  const canvasViewport = document.getElementById("canvasViewport");
  const canvasContainer = document.getElementById("canvasContainer");
  let canvasPreview = document.getElementById("canvasPreview");
  let previewFrame = document.getElementById("previewFrame");
  const zoomInput = document.getElementById("zoomInput");
  const btnZoomFit = document.getElementById("btnZoomFit");
  const viewportWidthInput = document.getElementById("viewportWidthInput");
  const viewportHeightInput = document.getElementById("viewportHeightInput");
  let dimensionLabel = document.querySelector(".artboard-dimension-label");
  const dropzone = document.getElementById("dropzone");
  const dropzoneLoaded = document.getElementById("dropzoneLoaded");
  const singleUploadCard = document.getElementById("singleUploadCard");
  const multiUploadList = document.getElementById("multiUploadList");
  const urlMultiUploadList = document.getElementById("urlMultiUploadList");
  const previewFileName = document.getElementById("previewFileName");
  const previewFileSize = document.getElementById("previewFileSize");
  const previewIcon = document.getElementById("previewIcon");
  const toolbarProjectName = document.getElementById("toolbarProjectName");
  const toolbarUndoBtn = document.getElementById("toolbarUndoBtn");
  const toolbarRedoBtn = document.getElementById("toolbarRedoBtn");
  const removeFileBtn = document.getElementById("removeFileBtn");
  const convertButton = document.getElementById("convertButton");
  const copyButton = document.getElementById("copyButton");
  const browseBtn = document.getElementById("browseBtn");
  const btnDropdown = document.getElementById("btnDropdown");
  const toolbarAddWrap = document.getElementById("toolbarAddWrap");
  const toolbarAddBtn = document.getElementById("toolbarAddBtn");
  const toolbarAddMenu = document.getElementById("toolbarAddMenu");
  const toolbarAlignWrap = document.getElementById("toolbarAlignWrap");
  const toolbarAlignArrow = document.getElementById("toolbarAlignArrow");
  const toolbarAlignMenu = document.getElementById("toolbarAlignMenu");
  const canvasToolbar = document.querySelector(".canvas-toolbar");
  const appSyncOverlay = document.getElementById("appSyncOverlay");
  const shouldSkipAppSyncLoader = consumeInstantPageSwitch();
  if (shouldSkipAppSyncLoader) {
    scheduleInstantPageSwitchCleanup();
  }
  const pwaInstallBtn = document.getElementById("pwaInstallBtn");
  const toolbarPointerToolBtn = document.getElementById(
    "toolbarPointerToolBtn",
  );
  const toolbarHandToolBtn = document.getElementById("toolbarHandToolBtn");
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  const statusEl = document.getElementById("status");
  const HIDE_STATUS_TEXT = true;
  const toastEl = document.getElementById("toastNotification");
  const commandPaletteOverlay = document.getElementById(
    "commandPaletteOverlay",
  );
  const commandPaletteInput = document.getElementById("commandPaletteInput");
  const commandPaletteList = document.getElementById("commandPaletteList");
  const commandPaletteEmpty = document.getElementById("commandPaletteEmpty");
  const commandPaletteShortcutHint = document.getElementById(
    "commandPaletteShortcutHint",
  );
  const attachmentsTree = document.querySelector(
    "#accordionCode2design .tree-sub-list",
  );
  const stylesAttachmentsTree = document.querySelector(
    "#accordionStyles .tree-sub-list",
  );
  const counters = {
    frames: document.getElementById("framesCount"),
    text: document.getElementById("textCount"),
    image: document.getElementById("imageCount"),
    container: document.getElementById("containerCount"),
  };
  const artboardClipboard = {
    items: [],
    pasteCount: 0,
  };
  const WORKSPACE_STORAGE_KEY = "code2design.workspace.v2";
  const WORKSPACE_IDB_NAME = "code2design-workspace-db";
  const WORKSPACE_IDB_STORE = "workspace";
  const WORKSPACE_IDB_KEY = "latest";
  const PERSISTED_HISTORY_LIMIT = 20;
  const MAX_SNAPSHOT_HTML_LENGTH = 50 * 1024 * 1024; // Skip rawHtml >50 MB from snapshots to prevent browser OOM
  let persistWorkspaceTimer = null;
  let persistWorkspaceShouldShowFeedback = false;
  let persistWorkspaceForceFeedback = false;
  let shouldAutoSaveForCanvasMutation = false;
  let isRestoringWorkspace = false;
  let workspaceDbPromise = null;
  let manualSavePromise = null;
  let lastAutoSaveToastAt = 0;
  const AUTO_SAVE_TOAST_COOLDOWN_MS = 2200;
  let suppressNextAutoSaveToast = consumeAutoSaveToastSuppression();
  let suppressToastsUntil = consumeToastSuppressionUntil();

  if (shouldSkipAppSyncLoader) {
    document.body.classList.remove("app-sync-pending");
    document.body.classList.add("app-sync-ready", "app-sync-complete");
    if (appSyncOverlay) {
      appSyncOverlay.remove();
    }
  }

  const maybeShowAutoSaveFeedback = (force = false) => {
    const now = Date.now();
    if (!force && now - lastAutoSaveToastAt < AUTO_SAVE_TOAST_COOLDOWN_MS)
      return;
    lastAutoSaveToastAt = now;
    updateStatus("Auto-saved.", "success");
    if (suppressNextAutoSaveToast) {
      suppressNextAutoSaveToast = false;
      return;
    }
    showToast("Auto-saved", "Changes saved automatically.", "success");
  };

  const hideToastImmediately = () => {
    if (toastEl && typeof toastEl.hide === "function") {
      toastEl.hide();
    }
  };

  const shouldSuppressToast = () => Date.now() < suppressToastsUntil;

  const serializeConversionStats = (stats) => {
    if (!stats) return null;
    return {
      frames: Number(stats.frames) || 0,
      text: Number(stats.text) || 0,
      image: Number(stats.image) || 0,
      container: Number(stats.container) || 0,
    };
  };

  const serializeClipboardItems = (items) => {
    if (!Array.isArray(items) || !items.length) return [];
    return items
      .map((entry) => ({
        type: entry?.type || "file",
        displayName: entry?.displayName || "Artboard",
        rawHtml: (entry?.rawHtml || "").length > MAX_SNAPSHOT_HTML_LENGTH ? "" : (entry?.rawHtml || ""),
        totalSize: Number(entry?.totalSize) || 0,
        conversionStats: serializeConversionStats(entry?.conversionStats),
        width: Math.max(0, Math.round(Number(entry?.width) || 1440)),
        height: Math.max(0, Math.round(Number(entry?.height) || 900)),
        x: Number(entry?.x) || 0,
        y: Number(entry?.y) || 0,
      }))
      .filter(
        (entry) =>
          typeof entry.rawHtml === "string" && entry.rawHtml.length > 0,
      );
  };

  const restoreClipboardState = (snapshot) => {
    const incomingItems = Array.isArray(snapshot?.clipboard?.items)
      ? serializeClipboardItems(snapshot.clipboard.items)
      : [];
    artboardClipboard.items = incomingItems;
    artboardClipboard.pasteCount = Number(snapshot?.clipboard?.pasteCount) || 0;
  };

  const serializeItemForHistory = (item) => {
    if (!item) return null;
    const dims = getArtboardDimensions(item);
    return {
      id: Number(item.id) || 0,
      type: item.type || "file",
      displayName: item.displayName || "Artboard",
      rawHtml: (item.rawHtml || "").length > MAX_SNAPSHOT_HTML_LENGTH ? "" : (item.rawHtml || ""),
      preparedHtml: (item.preparedHtml || "").length > MAX_SNAPSHOT_HTML_LENGTH ? "" : (item.preparedHtml || ""),
      isFrameReady: Boolean(item.isFrameReady),
      totalSize: Number(item.totalSize) || 0,
      width: dims.width,
      height: dims.height,
      artboardX: Number(item.artboardX) || 0,
      artboardY: Number(item.artboardY) || 0,
      targetArtboardX: Number(item.targetArtboardX) || 0,
      targetArtboardY: Number(item.targetArtboardY) || 0,
      conversionStats: serializeConversionStats(item.conversionStats),
    };
  };

  const serializeHistoryAction = (action) => {
    if (!action) return null;

    // "move" and "resize" are pure numeric — no DOM elements, pass through directly.
    if (action.type === "move") {
      return {
        type: "move",
        entries: (action.entries || []).map((e) => ({
          id: Number(e.id),
          prevX: Number(e.prevX) || 0,
          prevY: Number(e.prevY) || 0,
          nextX: Number(e.nextX) || 0,
          nextY: Number(e.nextY) || 0,
        })),
        prevActiveId: Number(action.prevActiveId) || null,
        prevSelectedIds: Array.isArray(action.prevSelectedIds)
          ? action.prevSelectedIds.map(Number)
          : [],
        nextActiveId: Number(action.nextActiveId) || null,
        nextSelectedIds: Array.isArray(action.nextSelectedIds)
          ? action.nextSelectedIds.map(Number)
          : [],
      };
    }

    if (action.type === "resize") {
      return {
        type: "resize",
        entries: (action.entries || []).map((e) => ({
          id: Number(e.id),
          prevX: Number(e.prevX) || 0,
          prevY: Number(e.prevY) || 0,
          prevWidth: Number(e.prevWidth) || 0,
          prevHeight: Number(e.prevHeight) || 0,
          nextX: Number(e.nextX) || 0,
          nextY: Number(e.nextY) || 0,
          nextWidth: Number(e.nextWidth) || 0,
          nextHeight: Number(e.nextHeight) || 0,
        })),
        prevActiveId: Number(action.prevActiveId) || null,
        prevSelectedIds: Array.isArray(action.prevSelectedIds)
          ? action.prevSelectedIds.map(Number)
          : [],
      };
    }

    if (action.type !== "add" && action.type !== "delete") return null;

    if (action.type === "add") {
      const items = Array.isArray(action.items)
        ? action.items.map(serializeItemForHistory).filter(Boolean)
        : [];
      return {
        type: "add",
        startIndex: Number(action.startIndex) || 0,
        prevActiveId: Number(action.prevActiveId) || null,
        prevSelectedIds: Array.isArray(action.prevSelectedIds)
          ? action.prevSelectedIds.map((id) => Number(id)).filter(Boolean)
          : [],
        nextActiveId: Number(action.nextActiveId) || null,
        nextSelectedIds: Array.isArray(action.nextSelectedIds)
          ? action.nextSelectedIds.map((id) => Number(id)).filter(Boolean)
          : [],
        items,
      };
    }

    const entries = Array.isArray(action.entries)
      ? action.entries
          .map((entry) => {
            const serializedItem = serializeItemForHistory(entry?.item);
            if (!serializedItem) return null;
            return {
              index: Number(entry.index) || 0,
              item: serializedItem,
            };
          })
          .filter(Boolean)
      : [];

    return {
      type: "delete",
      prevActiveId: Number(action.prevActiveId) || null,
      prevSelectedIds: Array.isArray(action.prevSelectedIds)
        ? action.prevSelectedIds.map((id) => Number(id)).filter(Boolean)
        : [],
      nextActiveId: Number(action.nextActiveId) || null,
      nextSelectedIds: Array.isArray(action.nextSelectedIds)
        ? action.nextSelectedIds.map((id) => Number(id)).filter(Boolean)
        : [],
      entries,
    };
  };

  const serializeHistoryStack = (stack) => {
    if (!Array.isArray(stack) || stack.length === 0) return [];
    return stack
      .slice(-PERSISTED_HISTORY_LIMIT)
      .map(serializeHistoryAction)
      .filter(Boolean);
  };

  const buildWorkspaceSnapshot = () => ({
    version: 2,
    savedAt: Date.now(),
    nextImportId: state.nextImportId,
    activeImportId: state.activeImportId,
    selectedImportIds: Array.from(state.selectedImportIds),
    smartAutoLayout: Boolean(state.smartAutoLayout),
    undoStack: serializeHistoryStack(state.undoStack),
    redoStack: serializeHistoryStack(state.redoStack),
    clipboard: {
      items: serializeClipboardItems(artboardClipboard.items),
      pasteCount: Number(artboardClipboard.pasteCount) || 0,
    },
    imports: state.imports.map((item) => {
      const dims = getArtboardDimensions(item);
      return {
        id: item.id,
        type: item.type,
        displayName: item.displayName,
        rawHtml: (item.rawHtml || "").length > MAX_SNAPSHOT_HTML_LENGTH ? "" : (item.rawHtml || ""),
        preparedHtml: (item.preparedHtml || "").length > MAX_SNAPSHOT_HTML_LENGTH ? "" : (item.preparedHtml || ""),
        isFrameReady: Boolean(item.isFrameReady),
        totalSize: item.totalSize || 0,
        width: dims.width,
        height: dims.height,
        artboardX: Number(item.artboardX) || 0,
        artboardY: Number(item.artboardY) || 0,
        targetArtboardX: Number(item.targetArtboardX) || 0,
        targetArtboardY: Number(item.targetArtboardY) || 0,
        conversionStats: serializeConversionStats(item.conversionStats),
      };
    }),
  });

  const hydrateItemFromHistory = (entry) => {
    if (!entry || !entry.rawHtml) return null;
    const item = createImportItemFromSnapshot(entry);
    if (!item) return null;
    detachImportPreview(item);
    return item;
  };

  const deserializeHistoryAction = (savedAction) => {
    if (!savedAction) return null;

    // "move" and "resize" are pure numeric — deserialize directly (no DOM hydration needed).
    if (savedAction.type === "move" || savedAction.type === "resize") {
      return savedAction;
    }

    if (savedAction.type !== "add" && savedAction.type !== "delete")
      return null;

    if (savedAction.type === "add") {
      const items = Array.isArray(savedAction.items)
        ? savedAction.items.map(hydrateItemFromHistory).filter(Boolean)
        : [];
      return {
        type: "add",
        startIndex: Number(savedAction.startIndex) || 0,
        prevActiveId: Number(savedAction.prevActiveId) || null,
        prevSelectedIds: Array.isArray(savedAction.prevSelectedIds)
          ? savedAction.prevSelectedIds.map((id) => Number(id)).filter(Boolean)
          : [],
        nextActiveId: Number(savedAction.nextActiveId) || null,
        nextSelectedIds: Array.isArray(savedAction.nextSelectedIds)
          ? savedAction.nextSelectedIds.map((id) => Number(id)).filter(Boolean)
          : [],
        items,
      };
    }

    const entries = Array.isArray(savedAction.entries)
      ? savedAction.entries
          .map((entry) => {
            const item = hydrateItemFromHistory(entry?.item);
            if (!item) return null;
            return {
              index: Number(entry.index) || 0,
              item,
            };
          })
          .filter(Boolean)
      : [];

    return {
      type: "delete",
      prevActiveId: Number(savedAction.prevActiveId) || null,
      prevSelectedIds: Array.isArray(savedAction.prevSelectedIds)
        ? savedAction.prevSelectedIds.map((id) => Number(id)).filter(Boolean)
        : [],
      nextActiveId: Number(savedAction.nextActiveId) || null,
      nextSelectedIds: Array.isArray(savedAction.nextSelectedIds)
        ? savedAction.nextSelectedIds.map((id) => Number(id)).filter(Boolean)
        : [],
      entries,
    };
  };

  const deserializeHistoryStack = (savedStack) => {
    if (!Array.isArray(savedStack) || savedStack.length === 0) return [];
    return savedStack
      .slice(-PERSISTED_HISTORY_LIMIT)
      .map(deserializeHistoryAction)
      .filter(Boolean);
  };

  const openWorkspaceDb = () => {
    if (workspaceDbPromise) return workspaceDbPromise;
    if (typeof indexedDB === "undefined") {
      workspaceDbPromise = Promise.resolve(null);
      return workspaceDbPromise;
    }

    workspaceDbPromise = new Promise((resolve) => {
      const request = indexedDB.open(WORKSPACE_IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORKSPACE_IDB_STORE)) {
          db.createObjectStore(WORKSPACE_IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.warn("Workspace IndexedDB unavailable:", request.error);
        resolve(null);
      };
    });

    return workspaceDbPromise;
  };

  const idbSetWorkspaceSnapshot = async (snapshot) => {
    const db = await openWorkspaceDb();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(WORKSPACE_IDB_STORE, "readwrite");
      tx.objectStore(WORKSPACE_IDB_STORE).put(snapshot, WORKSPACE_IDB_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn("Failed to write workspace snapshot:", tx.error);
        resolve(false);
      };
      tx.onabort = () => resolve(false);
    });
  };

  const idbGetWorkspaceSnapshot = async () => {
    const db = await openWorkspaceDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(WORKSPACE_IDB_STORE, "readonly");
      const request = tx
        .objectStore(WORKSPACE_IDB_STORE)
        .get(WORKSPACE_IDB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.warn("Failed to read workspace snapshot:", request.error);
        resolve(null);
      };
      tx.onabort = () => resolve(null);
    });
  };

  const idbClearWorkspaceSnapshot = async () => {
    const db = await openWorkspaceDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(WORKSPACE_IDB_STORE, "readwrite");
      tx.objectStore(WORKSPACE_IDB_STORE).delete(WORKSPACE_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  };

  const persistWorkspaceStateNow = async () => {
    if (isRestoringWorkspace) return false;
    const hasImports = state.imports.length > 0;
    const hasHistory = state.undoStack.length > 0 || state.redoStack.length > 0;
    try {
      if (!hasImports && !hasHistory) {
        await idbClearWorkspaceSnapshot();
        try {
          localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        } catch (localError) {
          console.warn("Workspace fallback clear failed:", localError);
        }
        return true;
      }

      const snapshot = buildWorkspaceSnapshot();
      let saved = false;

      const idbSaved = await idbSetWorkspaceSnapshot(snapshot);
      if (idbSaved) saved = true;

      // Lightweight fallback for environments where IndexedDB may be unavailable.
      // Skip JSON.stringify entirely when imports contain very large HTML to avoid
      // browser OOM crash (Chrome Error 5 "Aw, Snap!").
      var _totalSnapshotHtml = state.imports.reduce(
        function (s, it) { return s + (it.rawHtml ? it.rawHtml.length : 0); }, 0,
      );
      if (_totalSnapshotHtml <= MAX_SNAPSHOT_HTML_LENGTH) {
        try {
          localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
          saved = true;
        } catch (localError) {
          console.warn("Workspace fallback persistence failed:", localError);
        }
      }

      return saved;
    } catch (error) {
      console.warn("Workspace persistence failed:", error);
      return false;
    }
  };

  const schedulePersistWorkspaceState = ({
    showFeedback = true,
    forceFeedback = false,
  } = {}) => {
    if (isRestoringWorkspace) return;
    persistWorkspaceShouldShowFeedback =
      persistWorkspaceShouldShowFeedback || Boolean(showFeedback);
    persistWorkspaceForceFeedback =
      persistWorkspaceForceFeedback || Boolean(forceFeedback);
    if (persistWorkspaceTimer) {
      clearTimeout(persistWorkspaceTimer);
    }
    persistWorkspaceTimer = window.setTimeout(() => {
      persistWorkspaceTimer = null;
      const shouldShowFeedback = persistWorkspaceShouldShowFeedback;
      const shouldForceFeedback = persistWorkspaceForceFeedback;
      persistWorkspaceShouldShowFeedback = false;
      persistWorkspaceForceFeedback = false;
      void persistWorkspaceStateNow().then((saved) => {
        if (saved && state.imports.length > 0 && shouldShowFeedback) {
          maybeShowAutoSaveFeedback(shouldForceFeedback);
        }
      });
    }, 140);
  };

  const clearPersistedWorkspaceState = () => {
    if (persistWorkspaceTimer) {
      clearTimeout(persistWorkspaceTimer);
      persistWorkspaceTimer = null;
    }
    void idbClearWorkspaceSnapshot();
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear persisted workspace:", error);
    }
  };

  const revealToolbarWhenIconsReady = () =>
    new Promise((resolve) => {
      if (!canvasToolbar) {
        resolve();
        return;
      }
      const syncStart = performance.now();
      const MIN_SYNC_LOADER_MS = 80;
      const finalizeToolbarReveal = () => {
        canvasToolbar.classList.add("icons-ready");
        resolve();
      };

      const toolbarImgs = Array.from(canvasToolbar.querySelectorAll("img"));
      if (!toolbarImgs.length) {
        const elapsed = performance.now() - syncStart;
        const waitMs = Math.max(0, MIN_SYNC_LOADER_MS - elapsed);
        window.setTimeout(finalizeToolbarReveal, waitMs);
        return;
      }

      const preloadSet = new Set();
      toolbarImgs.forEach((img) => {
        if (img.src) preloadSet.add(img.src);
        if (img.dataset.defaultSrc) preloadSet.add(img.dataset.defaultSrc);
        if (img.dataset.hoverSrc) preloadSet.add(img.dataset.hoverSrc);
      });

      preloadSet.forEach((src) => {
        const pre = new Image();
        pre.decoding = "async";
        pre.src = src;
      });

      const waitForImg = (img) =>
        new Promise((resolve) => {
          const finish = () => resolve();
          if (img.complete && img.naturalWidth > 0) {
            if (typeof img.decode === "function") {
              img.decode().then(finish).catch(finish);
            } else {
              finish();
            }
            return;
          }
          img.addEventListener("load", finish, { once: true });
          img.addEventListener("error", finish, { once: true });
        });

      Promise.race([
        Promise.all(toolbarImgs.map(waitForImg)),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]).finally(() => {
        const elapsed = performance.now() - syncStart;
        const waitMs = Math.max(0, MIN_SYNC_LOADER_MS - elapsed);
        window.setTimeout(finalizeToolbarReveal, waitMs);
      });
    });

  const waitForWindowLoad = () =>
    new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }

      let settled = false;
      const LOAD_FALLBACK_TIMEOUT_MS = 2600;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        resolve();
      };

      const fallbackTimer = window.setTimeout(() => {
        console.warn("Window load fallback used; continuing app startup.");
        finish();
      }, LOAD_FALLBACK_TIMEOUT_MS);

      window.addEventListener("load", finish, { once: true });
      window.addEventListener("pageshow", finish, { once: true });
    });

  const finalizeAppSync = () => {
    if (document.body.classList.contains("app-sync-ready")) {
      return;
    }

    document.body.classList.remove("app-sync-pending");
    document.body.classList.add("app-sync-ready");

    window.setTimeout(() => {
      document.body.classList.add("app-sync-complete");
    }, 980);

    if (appSyncOverlay) {
      appSyncOverlay.classList.add("done");
      window.setTimeout(() => {
        appSyncOverlay.remove();
      }, 240);
    }
  };

  Promise.all([revealToolbarWhenIconsReady(), waitForWindowLoad()]).finally(
    () => {
      window.requestAnimationFrame(finalizeAppSync);
    },
  );

  // ─── Figma-like Zoom Model ───────────────────────────────────────────
  // Exponential zoom anchored at cursor. Display = Math.round(scale*100)+"%".
  const INITIAL_SCALE = 0.6175; // ~62% — default fit for 1440px artboard
  const SCALE_AT_ZOOM_ZERO = INITIAL_SCALE; // Alias kept for grid calculations
  const MIN_SCALE = 0.02; // 2%
  const MAX_SCALE = 15.0; // 1500%
  const PAN_LERP = 0.28; // Smooth animated pan (tab-focus, zoom-to-fit)
  const TAB_FOCUS_PAN_LERP = 0.4; // Base tab/sidemenu focus-pan speed
  const TAB_FOCUS_RAPID_THRESHOLD_MS = 110; // Treat very fast repeated Tab presses as rapid cycling
  const ZOOM_LERP = 0.28; // Smooth animated zoom
  const WHEEL_ZOOM_SENSITIVITY = 0.005; // Exponential zoom per px delta (discrete wheel)
  const PINCH_ZOOM_SENSITIVITY = 0.01; // Exponential zoom per px delta (trackpad pinch)
  const KEYBOARD_ZOOM_FACTOR = 2; // ×2 / ÷2 for +/− keyboard zoom
  const ARTBOARD_DRAG_SPEED = 1.0; // Figma: 1 : 1 artboard drag
  const ARTBOARD_RESIZE_SPEED = 1;
  const SMART_GUIDE_SNAP_THRESHOLD_PX = 6.5; // Snap-in distance (screen px)
  const SMART_GUIDE_SNAP_RELEASE_PX = 9; // Hysteresis release distance (screen px)
  const SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX = 10;
  const SMART_GUIDE_EQUAL_SPACING_THRESHOLD_PX = 9.5;
  const SMART_GUIDE_GAP_MATCH_THRESHOLD_PX = 7.5;
  const SMART_GUIDE_GAP_MATCH_MIN_OVERLAP_PX = 20;
  const SMART_GUIDE_RESIZE_SNAP_STRENGTH = 0.82;
  const SMART_GUIDE_RESIZE_SNAP_LOCK_PX = 2.8;
  const SMART_GUIDE_RESIZE_SNAP_RELEASE_PX = 14;
  const SMART_GUIDE_PROXIMITY_RANGE_PX = 300; // Only check items within this screen-px range
  const SMART_GUIDE_SWITCH_HYSTERESIS_PX = 1.2; // Keep current guide unless next is clearly better
  const SMART_GUIDE_STICKY_LINE_TOLERANCE_PX = 2.0; // Prefer nearby same-line candidate to avoid jitter
  const IMPORT_ARTBOARD_GAP = 120;
  const IMPORT_ENTER_OFFSET_X = 42;
  const IMPORT_ENTER_DURATION_MS = 190;

  // Figma zoom-step presets (nice round percentages for keyboard zoom)
  const FIGMA_ZOOM_STOPS = [
    0.02, 0.04, 0.06, 0.08, 0.1, 0.125, 0.167, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75,
    0.8, 0.9, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 15.0,
  ];

  /** Clamp scale to valid range */
  const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  /** Snap to the next nice zoom stop above current scale */
  const nextZoomStopUp = (current) => {
    for (let i = 0; i < FIGMA_ZOOM_STOPS.length; i++) {
      if (FIGMA_ZOOM_STOPS[i] > current + 0.001) return FIGMA_ZOOM_STOPS[i];
    }
    return FIGMA_ZOOM_STOPS[FIGMA_ZOOM_STOPS.length - 1];
  };

  /** Snap to the next nice zoom stop below current scale */
  const nextZoomStopDown = (current) => {
    for (let i = FIGMA_ZOOM_STOPS.length - 1; i >= 0; i--) {
      if (FIGMA_ZOOM_STOPS[i] < current - 0.001) return FIGMA_ZOOM_STOPS[i];
    }
    return FIGMA_ZOOM_STOPS[0];
  };

  // ─── Legacy adapter helpers (kept so downstream code compiles unchanged) ──
  const zoomPercentToScale = (zoomPercent) => {
    return clampScale(INITIAL_SCALE * (1 + zoomPercent / 100));
  };

  const scaleToZoomPercent = (scale) => {
    return (scale / INITIAL_SCALE - 1) * 100;
  };

  const zoomPercentToUiPercent = (_zoomPercent) => {
    return Math.round(zoomPercentToScale(_zoomPercent) * 100);
  };

  const uiPercentToZoomPercent = (uiPercent) => {
    const scale = clampScale(uiPercent / 100);
    return scaleToZoomPercent(scale);
  };

  const camera = {
    x: 0,
    y: 0,
    scale: INITIAL_SCALE,
    targetX: 0,
    targetY: 0,
    targetScale: INITIAL_SCALE,
    artboardX: 0,
    artboardY: 0,
    targetArtboardX: 0,
    targetArtboardY: 0,
    panLerpOverride: null,
    isDragging: false,
    dragTarget: null, // 'canvas' | 'artboard' | 'resize-artboard' | 'resize-group'
    optionDuplicateDrag: false,
    optionDragCumulDist: 0, // px moved since option-drag start
    lastMouseX: 0,
    lastMouseY: 0,
    spaceHeld: false, // Figma: Space → temp hand tool
    priorToolBeforeSpace: null, // restore tool after Space release
    // Undo/redo: track start state before each drag so we can record a "move" action
    dragStartPositions: new Map(), // Map<id, {x, y}>
    dragStartActiveId: null,
    dragStartSelectedIds: [],
    lastFocusPanAt: 0,
    // RAF batching: set true by wheel/pan so render() does ONE updateCamera() per frame
    dirty: false,
  };

  if (fileInput) {
    fileInput.setAttribute("multiple", "multiple");
  }

  const propertiesPanel = document.getElementById("propertiesPanel");
  const stylesPanel = document.getElementById("stylesPanel");
  const stylesPanelElement = document.getElementById("stylesPanelElement");
  let lastStylesPanelImportId = null;
  let lastStylesPanelSource = null;
  const explorerList = document.getElementById("explorerList");
  const sidebarLeft = document.querySelector(".sidebar-left");
  const sidebarPanelToggle = document.getElementById("sidebarPanelToggle");
  const sidebarCollapseTab = document.getElementById("sidebarCollapseTab");
  const extensionUrl =
    "https://drive.google.com/open?id=11wxUKsvhqVtoAFODay4WtnXoyPDxH14P&usp=drive_fs";

  if (explorerList) {
    explorerList.addEventListener("tabchange", (e) => {
      const tabName = e.detail.label;
      if (tabName === "Styles") {
        propertiesPanel.classList.add("hidden");
        stylesPanel.classList.remove("hidden");
        updateStylesPanel({ force: true });
      } else {
        stylesPanel.classList.add("hidden");
        propertiesPanel.classList.remove("hidden");
      }
    });
  }

  const toggleSidebarCollapse = () => {
    if (!sidebarLeft) return;
    sidebarLeft.classList.toggle("collapsed");
    document.body.classList.remove("right-sidebar-forced-open");
  };

  if (canvasViewport) {
    canvasViewport.addEventListener("mousedown", (e) => {
      if (sidebarLeft && sidebarLeft.classList.contains("collapsed")) {
        const preview = e.target.closest(".canvas-preview");
        if (preview) {
          document.body.classList.add("right-sidebar-forced-open");
        } else {
          document.body.classList.remove("right-sidebar-forced-open");
        }
      }
    });
  }

  [sidebarPanelToggle, sidebarCollapseTab].forEach((toggle) => {
    if (toggle) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSidebarCollapse();
      });
    }
  });

  document
    .querySelectorAll(".sidemenu-upgrade-btn, .btn-extension")
    .forEach((button) => {
      button.addEventListener("click", () => {
        window.open(extensionUrl, "_blank", "noopener,noreferrer");
      });
    });

  const toggleSwitches = document.querySelectorAll(".toggle-switch");

  // Keep toolbar above side panels by mounting it at document root.
  if (canvasToolbar && canvasToolbar.parentElement !== document.body) {
    document.body.appendChild(canvasToolbar);
  }

  toggleSwitches.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("on");
    });
  });

  const autoLayoutToggle = document.getElementById("autoLayoutToggle");
  if (autoLayoutToggle) {
    state.smartAutoLayout = autoLayoutToggle.classList.contains("on");
    autoLayoutToggle.addEventListener("click", () => {
      // Keep smart auto layout state aligned with the UI toggle
      state.smartAutoLayout = autoLayoutToggle.classList.contains("on");
    });
  }

  function showPropertiesInspectorPanel() {
    if (stylesPanel) stylesPanel.classList.add("hidden");
    if (propertiesPanel) propertiesPanel.classList.remove("hidden");
    updateLoadedCard(getActiveImport());
    updateConvertButtonForActive();
    syncConversionSummaryForSelection({ force: true });
  }

  function showStylesInspectorPanel() {
    if (propertiesPanel) propertiesPanel.classList.add("hidden");
    if (stylesPanel) stylesPanel.classList.remove("hidden");
    updateStylesPanel({ force: true });
  }

  function isStylesInspectorActive() {
    return !!stylesPanel && !stylesPanel.classList.contains("hidden");
  }

  function isPropertiesInspectorActive() {
    return !!propertiesPanel && !propertiesPanel.classList.contains("hidden");
  }

  let codeExplorerTreeDirty = false;
  let stylesExplorerTreeDirty = false;

  function isCode2DesignExplorerActive() {
    const codeTab = document.querySelector("#accordionCode2design .tree-tab");
    return !!codeTab && codeTab.classList.contains("active");
  }

  function isStylesExplorerActive() {
    const stylesTab = document.querySelector("#accordionStyles .tree-tab");
    return !!stylesTab && stylesTab.classList.contains("active");
  }

  function refreshActiveExplorerTrees() {
    const codeActive = isCode2DesignExplorerActive();
    const stylesActive = isStylesExplorerActive();

    const hasCodeTreeNodeCountMatch =
      attachmentsTree &&
      attachmentsTree.children.length === state.imports.length;
    const hasStylesTreeNodeCountMatch =
      stylesAttachmentsTree &&
      stylesAttachmentsTree.children.length === state.imports.length;

    if (codeActive) {
      if (codeExplorerTreeDirty || !hasCodeTreeNodeCountMatch) {
        renderAttachmentsTree();
      } else {
        syncAttachmentsTreeActiveState();
      }
      codeExplorerTreeDirty = false;
    } else {
      codeExplorerTreeDirty = true;
    }

    if (stylesActive) {
      if (stylesExplorerTreeDirty || !hasStylesTreeNodeCountMatch) {
        renderStylesAttachmentsTree();
      } else {
        syncStylesAttachmentsTreeActiveState();
      }
      stylesExplorerTreeDirty = false;
    } else {
      stylesExplorerTreeDirty = true;
    }
  }

  let commandPaletteResults = [];
  let commandPaletteActiveIndex = 0;
  const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  const primaryShortcutLabel = isMacPlatform ? "⌘" : "Ctrl+";

  if (commandPaletteShortcutHint) {
    commandPaletteShortcutHint.textContent = isMacPlatform
      ? "⌘K to open • ↑↓ to navigate • Enter to run • Esc to close"
      : "Ctrl+K to open • ↑↓ to navigate • Enter to run • Esc to close";
  }

  const normalizeSearchText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const getSubsequenceScore = (needle, haystack) => {
    if (!needle || !haystack) return -1;
    let n = 0;
    let gapPenalty = 0;
    let lastMatchIndex = -1;

    for (let i = 0; i < haystack.length && n < needle.length; i += 1) {
      if (haystack[i] !== needle[n]) continue;
      if (lastMatchIndex >= 0) {
        gapPenalty += Math.max(0, i - lastMatchIndex - 1);
      }
      lastMatchIndex = i;
      n += 1;
    }

    if (n !== needle.length) return -1;
    return Math.max(8, 52 - gapPenalty);
  };

  const getTokenScore = (token, value, priorityBoost = 0) => {
    if (!token) return 0;
    const source = normalizeSearchText(value);
    if (!source) return -1;

    const exactIndex = source.indexOf(token);
    if (exactIndex >= 0) {
      return Math.max(14, 88 - exactIndex) + priorityBoost;
    }

    const subseq = getSubsequenceScore(token, source);
    if (subseq >= 0) {
      return subseq + priorityBoost;
    }

    return -1;
  };

  const scoreSearchMatch = (query, candidate) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return 1;

    const tokens = normalizedQuery.split(" ").filter(Boolean);
    if (tokens.length === 0) return 1;

    let totalScore = 0;

    for (const token of tokens) {
      const titleScore = getTokenScore(token, candidate.title, 15);
      const subtitleScore = getTokenScore(token, candidate.subtitle, 7);
      const tagScore = getTokenScore(token, candidate.tags, 4);
      const best = Math.max(titleScore, subtitleScore, tagScore);

      if (best < 0) return -1;
      totalScore += best;
    }

    if (candidate.kind === "command") totalScore += 6;
    if (candidate.kind === "artboard") totalScore += 3;

    return totalScore;
  };

  const ensureExplorerAccordionActive = (accordionId) => {
    const targetAccordion = document.getElementById(accordionId);
    if (!targetAccordion) return;

    accordions.forEach((otherAccordion) => {
      const otherTab = otherAccordion.querySelector(".tree-tab");
      const isTarget = otherAccordion === targetAccordion;

      otherAccordion.classList.toggle("open", isTarget);
      if (otherTab) {
        otherTab.classList.toggle("active", isTarget);
        syncTreeTabState(otherTab);
      }
    });

    if (accordionId === "accordionStyles") {
      showStylesInspectorPanel();
    } else {
      showPropertiesInspectorPanel();
    }

    refreshActiveExplorerTrees();
  };

  const getPaletteSelectionIds = () =>
    state.selectedImportIds.size > 0
      ? Array.from(state.selectedImportIds)
      : state.activeImportId
        ? [state.activeImportId]
        : [];

  const focusArtboardById = (importId) => {
    const target = state.imports.find((item) => item.id === importId);
    if (!target) return;

    setActiveImport(importId, { deferNonCriticalUi: true });
    focusArtboardInCanvas(target, { instant: true });
    showPropertiesInspectorPanel();
  };

  const selectAdjacentArtboardFromPalette = (direction = 1) => {
    if (state.imports.length === 0) return;

    const currentIndex = state.imports.findIndex(
      (item) => item.id === state.activeImportId,
    );
    const fallbackIndex = direction < 0 ? state.imports.length : -1;
    const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const nextIndex =
      (baseIndex + direction + state.imports.length) % state.imports.length;
    const nextItem = state.imports[nextIndex];
    if (nextItem) {
      focusArtboardById(nextItem.id);
    }
  };

  const createCommandPaletteActions = () => [
    {
      id: "open-file",
      kind: "command",
      typeLabel: "Command",
      shortcut: isMacPlatform ? "⌘O" : "Ctrl+O",
      title: "Open HTML file",
      subtitle: "Import a local HTML file",
      tags: "open import upload html file",
      run: () => {
        if (fileInput) fileInput.click();
      },
    },
    {
      id: "open-folder",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Open folder",
      subtitle: "Import a local folder",
      tags: "open import upload folder directory",
      run: () => {
        void selectFolder();
      },
    },
    {
      id: "switch-code2design",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Switch to Code2design",
      subtitle: "Open Code2design explorer tab",
      tags: "switch explorer code2design project tab",
      run: () => ensureExplorerAccordionActive("accordionCode2design"),
    },
    {
      id: "switch-styles",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Switch to Styles",
      subtitle: "Open Styles explorer tab",
      tags: "switch explorer styles tab",
      run: () => ensureExplorerAccordionActive("accordionStyles"),
    },
    {
      id: "toggle-left-sidebar",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Toggle left sidebar",
      subtitle: "Collapse or expand the explorer",
      tags: "toggle collapse expand sidebar explorer",
      run: () => toggleSidebarCollapse(),
    },
    {
      id: "next-artboard",
      kind: "command",
      typeLabel: "Command",
      shortcut: "Tab",
      title: "Select next artboard",
      subtitle: "Move selection forward",
      tags: "next artboard select",
      run: () => selectAdjacentArtboardFromPalette(1),
    },
    {
      id: "previous-artboard",
      kind: "command",
      typeLabel: "Command",
      shortcut: "Shift+Tab",
      title: "Select previous artboard",
      subtitle: "Move selection backward",
      tags: "previous artboard select",
      run: () => selectAdjacentArtboardFromPalette(-1),
    },
    {
      id: "convert-design",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Convert design",
      subtitle: "Run conversion for selected artboard(s)",
      tags: "convert figma capture",
      run: () => {
        if (convertButton) convertButton.click();
      },
    },
    {
      id: "open-capture",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Open capture window",
      subtitle: "Open prepared capture tabs",
      tags: "open capture copy figma",
      run: () => {
        if (copyButton && !copyButton.hidden) {
          copyButton.click();
          return;
        }
        if (convertButton) convertButton.click();
      },
    },
    {
      id: "zoom-fit",
      kind: "command",
      typeLabel: "Command",
      shortcut: "Shift+1",
      title: "Zoom to fit all",
      subtitle: "Fit all artboards in viewport",
      tags: "zoom fit viewport",
      run: () => zoomToFitAll(),
    },
    {
      id: "save-workspace",
      kind: "command",
      typeLabel: "Command",
      shortcut: `${primaryShortcutLabel}S`,
      title: "Save workspace now",
      subtitle: "Force-save current state",
      tags: "save workspace autosave",
      run: () => saveWorkspaceNowWithFeedback(),
    },
    {
      id: "undo",
      kind: "command",
      typeLabel: "Command",
      shortcut: `${primaryShortcutLabel}Z`,
      title: "Undo",
      subtitle: "Undo last action",
      tags: "undo history",
      run: () => {
        const didUndo = undoRecentAction();
        if (didUndo) showToast("Undo", "Last action undone.", "success");
      },
    },
    {
      id: "redo",
      kind: "command",
      typeLabel: "Command",
      shortcut: isMacPlatform ? "⌘⇧Z" : "Ctrl+Y",
      title: "Redo",
      subtitle: "Redo last action",
      tags: "redo history",
      run: () => {
        const didRedo = redoRecentAction();
        if (didRedo) showToast("Redo", "Last action redone.", "success");
      },
    },
    {
      id: "duplicate",
      kind: "command",
      typeLabel: "Command",
      shortcut: `${primaryShortcutLabel}D`,
      title: "Duplicate selection",
      subtitle: "Duplicate selected artboard(s)",
      tags: "duplicate clone",
      run: () => {
        void duplicateSelectedImports();
      },
    },
    {
      id: "delete",
      kind: "command",
      typeLabel: "Command",
      shortcut: "Delete",
      title: "Delete selection",
      subtitle: "Remove selected artboard(s)",
      tags: "delete remove artboard",
      run: () => {
        const selectedIds = getPaletteSelectionIds();
        if (selectedIds.length > 0) {
          removeImportsByIds(selectedIds);
        }
      },
    },
    {
      id: "pointer-tool",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Use pointer tool",
      subtitle: "Switch canvas tool to pointer",
      tags: "tool pointer cursor",
      run: () => setActiveCanvasTool("pointer"),
    },
    {
      id: "hand-tool",
      kind: "command",
      typeLabel: "Command",
      shortcut: "",
      title: "Use hand tool",
      subtitle: "Switch canvas tool to hand",
      tags: "tool hand pan",
      run: () => setActiveCanvasTool("hand"),
    },
  ];

  const buildContentSnippet = (rawHtml, query) => {
    const plainText = String(rawHtml || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) return "";

    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return plainText.slice(0, 84);

    const lower = plainText.toLowerCase();
    const index = lower.indexOf(normalizedQuery);
    if (index < 0) return plainText.slice(0, 84);

    const start = Math.max(0, index - 28);
    const end = Math.min(plainText.length, index + normalizedQuery.length + 48);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < plainText.length ? "…" : "";
    return `${prefix}${plainText.slice(start, end)}${suffix}`;
  };

  const buildCommandPaletteEntries = (query) => {
    const entries = [];

    createCommandPaletteActions().forEach((action) => {
      entries.push(action);
    });

    state.imports.forEach((item, index) => {
      const { width, height } = getArtboardDimensions(item);
      entries.push({
        id: `artboard-${item.id}`,
        kind: "artboard",
        typeLabel: "File",
        title: item.displayName || `Artboard ${index + 1}`,
        subtitle: `Artboard ${index + 1} • ${width} × ${height}`,
        tags: "project file artboard html",
        run: () => focusArtboardById(item.id),
      });

      if (query && query.length >= 2 && item.rawHtml) {
        const snippet = buildContentSnippet(item.rawHtml, query);
        if (snippet) {
          entries.push({
            id: `content-${item.id}`,
            kind: "content",
            typeLabel: "Content",
            title: item.displayName || `Artboard ${index + 1}`,
            subtitle: snippet,
            tags: "content html text",
            run: () => focusArtboardById(item.id),
          });
        }
      }
    });

    return entries;
  };

  const renderCommandPaletteResults = (query = "") => {
    if (!commandPaletteList || !commandPaletteEmpty) return;

    const scored = buildCommandPaletteEntries(query)
      .map((entry) => ({
        ...entry,
        _score: scoreSearchMatch(query, entry),
      }))
      .filter((entry) => entry._score >= 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 40);

    commandPaletteResults = scored;
    commandPaletteActiveIndex = Math.min(
      commandPaletteActiveIndex,
      Math.max(0, commandPaletteResults.length - 1),
    );

    commandPaletteList.innerHTML = "";
    commandPaletteEmpty.classList.toggle(
      "hidden",
      commandPaletteResults.length > 0,
    );

    commandPaletteResults.forEach((entry, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `command-palette-item ${
        index === commandPaletteActiveIndex ? "is-active" : ""
      }`;
      row.dataset.index = String(index);

      const main = document.createElement("span");
      main.className = "command-palette-item-main";

      const title = document.createElement("span");
      title.className = "command-palette-item-title";
      title.textContent = entry.title || "Untitled";

      const subtitle = document.createElement("span");
      subtitle.className = "command-palette-item-subtitle";
      subtitle.textContent = entry.subtitle || "";

      const type = document.createElement("span");
      type.className = "command-palette-item-type";
      type.textContent =
        entry.kind === "command"
          ? entry.shortcut || "Action"
          : entry.typeLabel || "Item";

      main.appendChild(title);
      main.appendChild(subtitle);
      row.appendChild(main);
      row.appendChild(type);

      row.addEventListener("click", (event) => {
        event.preventDefault();
        executeCommandPaletteResult(index);
      });

      commandPaletteList.appendChild(row);
    });
  };

  const syncCommandPaletteActiveResult = () => {
    if (!commandPaletteList) return;
    const rows = commandPaletteList.querySelectorAll(".command-palette-item");
    rows.forEach((row, index) => {
      const isActive = index === commandPaletteActiveIndex;
      row.classList.toggle("is-active", isActive);
      if (isActive) {
        row.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const moveCommandPaletteSelection = (direction) => {
    if (commandPaletteResults.length === 0) return;
    commandPaletteActiveIndex =
      (commandPaletteActiveIndex + direction + commandPaletteResults.length) %
      commandPaletteResults.length;
    syncCommandPaletteActiveResult();
  };

  const isCommandPaletteOpen = () =>
    !!commandPaletteOverlay &&
    !commandPaletteOverlay.classList.contains("hidden");

  const isCommandPaletteShortcutEvent = (event) =>
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey &&
    (event.code === "KeyK" ||
      (typeof event.key === "string" && event.key.toLowerCase() === "k"));

  const closeCommandPalette = () => {
    if (!commandPaletteOverlay) return;
    commandPaletteOverlay.classList.add("hidden");
    commandPaletteOverlay.setAttribute("aria-hidden", "true");
  };

  const openCommandPalette = (query = "") => {
    if (!commandPaletteOverlay || !commandPaletteInput) return;
    commandPaletteOverlay.classList.remove("hidden");
    commandPaletteOverlay.setAttribute("aria-hidden", "false");
    commandPaletteInput.value = query;
    commandPaletteActiveIndex = 0;
    renderCommandPaletteResults(query);
    commandPaletteInput.focus();
    commandPaletteInput.select();
  };

  const executeCommandPaletteResult = (index = commandPaletteActiveIndex) => {
    const selected = commandPaletteResults[index];
    if (!selected || typeof selected.run !== "function") return;
    closeCommandPalette();
    selected.run();
  };

  if (commandPaletteOverlay) {
    commandPaletteOverlay.addEventListener("click", (event) => {
      if (event.target === commandPaletteOverlay) {
        closeCommandPalette();
      }
    });
  }

  if (commandPaletteInput) {
    commandPaletteInput.addEventListener("input", () => {
      commandPaletteActiveIndex = 0;
      renderCommandPaletteResults(commandPaletteInput.value);
    });
  }

  // Capture-phase fallback so Cmd/Ctrl+K works consistently even when focus
  // is inside complex UI elements before the normal window handler runs.
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isCommandPaletteShortcutEvent(event) || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (isCommandPaletteOpen()) {
        closeCommandPalette();
      } else {
        openCommandPalette("");
      }
    },
    true,
  );

  // ─── Enhanced Style Extraction System ──────────────────────────────────────
  function extractStyles(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const colors = new Map();
    const fonts = new Map();
    const shadows = new Map();
    const borders = new Map();
    const spacingSet = new Set();
    const radiiSet = new Set();

    // Color naming helpers
    const _colorIdx = { count: 0 };
    const _colorNames = [
      "Primary",
      "Secondary",
      "Accent",
      "Surface",
      "Background",
      "Text",
      "Muted",
      "Border",
      "Highlight",
      "Dark",
      "Light",
      "Info",
      "Success",
      "Warning",
      "Danger",
    ];
    const generateColorName = (raw, context) => {
      if (context && context !== "Stylesheet") {
        const tag = context.replace(
          /^(div|span|section|article|header|footer|main|p|a|ul|li|nav|aside)$/i,
          "",
        );
        if (tag) return tag.charAt(0).toUpperCase() + tag.slice(1) + " Color";
      }
      const name = _colorNames[_colorIdx.count % _colorNames.length];
      _colorIdx.count++;
      return name + " Color";
    };

    // Font naming helpers
    const _fontIdx = { count: 0 };
    const generateFontName = (family, size, weight) => {
      const w = parseInt(weight, 10) || 400;
      if (w >= 700 || parseInt(size, 10) >= 24) return "Heading Font";
      if (w >= 600 || parseInt(size, 10) >= 18) return "Subheading Font";
      if (parseInt(size, 10) <= 11) return "Caption Font";
      _fontIdx.count++;
      return _fontIdx.count <= 1 ? "Body Font" : "Body Font " + _fontIdx.count;
    };

    // Normalise hex colors for dedup
    const normalizeColor = (c) => {
      const s = c.trim().toLowerCase();
      if (/^#[a-f0-9]{3}$/.test(s))
        return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      return s;
    };

    // Parse CSS value declarations from text
    const parseCSSProps = (text) => {
      const props = {};
      const re = /([\w-]+)\s*:\s*([^;]+)/g;
      let m;
      while ((m = re.exec(text)) !== null) props[m[1].trim()] = m[2].trim();
      return props;
    };

    const normalizeFontWeight = (value) => {
      const raw = String(value || "")
        .trim()
        .toLowerCase();
      if (!raw) return "400";
      if (/^\d{3}$/.test(raw)) return raw;
      if (raw === "normal") return "400";
      if (raw === "bold" || raw === "bolder") return "700";
      if (raw === "lighter") return "300";
      return raw;
    };

    // Extract size/line-height/family from CSS font shorthand declarations.
    const parseFontShorthand = (value) => {
      const cleaned = String(value || "")
        .replace(/\s*!important\s*$/i, "")
        .trim();
      if (!cleaned) return null;

      const sizeMatch = cleaned.match(
        /(\d*\.?\d+(?:px|rem|em|pt|pc|in|cm|mm|q|vh|vw|vmin|vmax|%)?)(?:\s*\/\s*([^\s]+))?\s+(.+)$/i,
      );
      if (!sizeMatch) return null;

      const size = sizeMatch[1] || "";
      const lineHeight = sizeMatch[2] || "1.5";
      const family = (sizeMatch[3] || "")
        .split(",")[0]
        .replace(/["']/g, "")
        .trim();
      const prefix = cleaned.slice(0, sizeMatch.index).trim().toLowerCase();
      const weightMatch = prefix.match(
        /\b(100|200|300|400|500|600|700|800|900)\b/,
      );
      const weight = normalizeFontWeight(
        weightMatch ? weightMatch[1] : prefix.includes("bold") ? "700" : "400",
      );

      if (!family) return null;
      return { family, size: size || "14px", weight, lineHeight };
    };

    // Extract from inline styles on elements
    doc.querySelectorAll("*").forEach((el) => {
      const style = el.getAttribute("style") || "";
      if (!style) return;
      const props = parseCSSProps(style);
      const tagName = el.tagName.toLowerCase();

      // Colors
      Object.entries(props).forEach(([prop, val]) => {
        if (/color|background|border-color|outline-color/i.test(prop)) {
          const colorMatches = val.match(
            /#[a-fA-F0-9]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g,
          );
          if (colorMatches) {
            colorMatches.forEach((c) => {
              const key = normalizeColor(c);
              if (!colors.has(key)) {
                colors.set(key, {
                  hex: c.trim(),
                  name: generateColorName(c, tagName),
                  source: "inline",
                });
              }
            });
          }
        }
      });

      // Fonts
      if (props["font-family"]) {
        const family = props["font-family"]
          .split(",")[0]
          .replace(/['"]/g, "")
          .trim();
        const size = props["font-size"] || "14px";
        const weight = props["font-weight"] || "400";
        const lh = props["line-height"] || "1.5";
        const key = family + "|" + size + "|" + weight;
        if (!fonts.has(key)) {
          fonts.set(key, {
            tag: generateFontName(family, size, weight),
            size,
            family,
            weight,
            lineHeight: lh,
          });
        }
      }

      // Shadows
      if (props["box-shadow"] && props["box-shadow"] !== "none") {
        const sv = props["box-shadow"].trim();
        if (!shadows.has(sv)) {
          shadows.set(sv, {
            value: sv,
            name:
              shadows.size === 0
                ? "Card Shadow"
                : "Shadow " + (shadows.size + 1),
          });
        }
      }

      // Borders
      if (
        props["border"] &&
        props["border"] !== "none" &&
        props["border"] !== "0"
      ) {
        const bv = props["border"].trim();
        if (!borders.has(bv)) {
          borders.set(bv, {
            value: bv,
            name:
              borders.size === 0
                ? "Default Border"
                : "Border " + (borders.size + 1),
          });
        }
      }

      // Border-radius
      if (props["border-radius"]) {
        const rv = cssDimToPx(props["border-radius"]);
        if (Number.isFinite(rv) && rv > 0)
          radiiSet.add(Math.round(rv * 100) / 100);
      }

      // Spacing (margin/padding)
      [
        "margin",
        "padding",
        "gap",
        "margin-top",
        "margin-bottom",
        "margin-left",
        "margin-right",
        "padding-top",
        "padding-bottom",
        "padding-left",
        "padding-right",
      ].forEach((sp) => {
        if (props[sp]) {
          const vals = props[sp].match(/(-?\d+(?:\.\d+)?)\s*(px|rem|em)/gi);
          if (vals)
            vals.forEach((v) => {
              const n = cssDimToPx(v);
              if (Number.isFinite(n) && n > 0)
                spacingSet.add(Math.round(n * 100) / 100);
            });
        }
      });
    });

    // Extract from <style> tags
    doc.querySelectorAll("style").forEach((s) => {
      const content = s.textContent || "";

      // Colors from stylesheets
      const colorMatches = content.match(
        /#[a-fA-F0-9]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g,
      );
      if (colorMatches)
        colorMatches.forEach((c) => {
          const key = normalizeColor(c);
          if (!colors.has(key))
            colors.set(key, {
              hex: c.trim(),
              name: generateColorName(c, "Stylesheet"),
              source: "stylesheet",
            });
        });

      // Fonts from stylesheets
      const ruleBlocks = content.match(/[^{}]+\{[^{}]*\}/g) || [];
      ruleBlocks.forEach((block) => {
        const body = block.slice(
          block.indexOf("{") + 1,
          block.lastIndexOf("}"),
        );
        const props = parseCSSProps(body);
        let family = "";
        let size = "";
        let weight = "";
        let lineHeight = "";

        if (props["font-family"]) {
          family = props["font-family"]
            .split(",")[0]
            .replace(/["']/g, "")
            .trim();
        }
        if (props["font-size"]) size = props["font-size"];
        if (props["font-weight"])
          weight = normalizeFontWeight(props["font-weight"]);
        if (props["line-height"]) lineHeight = props["line-height"];

        if (props.font) {
          const parsedShorthand = parseFontShorthand(props.font);
          if (parsedShorthand) {
            family = family || parsedShorthand.family;
            size = size || parsedShorthand.size;
            weight = weight || parsedShorthand.weight;
            lineHeight = lineHeight || parsedShorthand.lineHeight;
          }
        }

        if (!family) return;
        size = size || "14px";
        weight = normalizeFontWeight(weight || "400");
        lineHeight = lineHeight || "1.5";

        const key = `${family}|${size}|${weight}`;
        if (!fonts.has(key)) {
          fonts.set(key, {
            tag: generateFontName(family, size, weight),
            size,
            family,
            weight,
            lineHeight,
          });
        }
      });

      // Shadows from stylesheets
      const shadowMatches = content.match(/box-shadow:\s*([^;]+)/g);
      if (shadowMatches)
        shadowMatches.forEach((sm) => {
          const sv = sm.split(":")[1].trim();
          if (sv !== "none" && !shadows.has(sv)) {
            shadows.set(sv, {
              value: sv,
              name:
                shadows.size === 0
                  ? "Card Shadow"
                  : "Elevation " + shadows.size,
            });
          }
        });

      // Border radius from stylesheets
      const radiusMatches = content.match(/border-radius:\s*([^;]+)/g);
      if (radiusMatches)
        radiusMatches.forEach((rm) => {
          const rv = cssDimToPx(rm.split(":")[1]);
          if (Number.isFinite(rv) && rv > 0)
            radiiSet.add(Math.round(rv * 100) / 100);
        });

      // Spacing from stylesheets
      const spacingMatches = content.match(
        /(margin|padding|gap)\s*:\s*([^;]+)/g,
      );
      if (spacingMatches)
        spacingMatches.forEach((sm) => {
          const vals = sm.match(/(-?\d+(?:\.\d+)?)\s*(px|rem|em)/gi);
          if (vals)
            vals.forEach((v) => {
              const n = cssDimToPx(v);
              if (Number.isFinite(n) && n > 0)
                spacingSet.add(Math.round(n * 100) / 100);
            });
        });

      // Borders from stylesheets
      const borderMatches = content.match(/(?:^|[{;\s])border\s*:\s*([^;]+)/g);
      if (borderMatches)
        borderMatches.forEach((bm) => {
          const bv = bm.split(":").slice(1).join(":").trim();
          if (bv && bv !== "none" && bv !== "0" && !borders.has(bv)) {
            borders.set(bv, {
              value: bv,
              name:
                borders.size === 0
                  ? "Default Border"
                  : "Border " + (borders.size + 1),
            });
          }
        });
    });

    // Sort spacing numerically, deduplicate
    const spacing = Array.from(spacingSet).sort((a, b) => a - b);
    const radii = Array.from(radiiSet).sort((a, b) => a - b);

    // Build spacing names
    const spacingLabels = [
      "xxs",
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
      "3xl",
      "4xl",
      "5xl",
      "6xl",
      "7xl",
    ];
    const spacingArr = spacing.map((s, i) => ({
      value: s,
      name: spacingLabels[i]
        ? `Space ${spacingLabels[i].toUpperCase()}`
        : `Space ${s}`,
      label: spacingLabels[i] || "",
    }));

    // Build radii names
    const radiusNames = [
      "2XS",
      "XS",
      "Small",
      "Medium",
      "Large",
      "XL",
      "2XL",
      "Round",
      "Full",
    ];
    const radiiArr = radii.map((r, i) => ({
      value: r,
      name: radiusNames[i] || `Radius ${r}`,
    }));

    const colorsArr = Array.from(colors.values());
    const fontsArr = Array.from(fonts.values());
    const shadowsArr = Array.from(shadows.values());
    const bordersArr = Array.from(borders.values());

    return {
      colors: colorsArr,
      fonts: fontsArr,
      spacing:
        spacingArr.length > 0
          ? spacingArr
          : [
              { value: 4, name: "Space XS", label: "xs" },
              { value: 8, name: "Space SM", label: "sm" },
              { value: 16, name: "Space MD", label: "md" },
              { value: 24, name: "Space LG", label: "lg" },
              { value: 48, name: "Space XL", label: "xl" },
            ],
      radii:
        radiiArr.length > 0
          ? radiiArr
          : [
              { value: 4, name: "Small" },
              { value: 8, name: "Medium" },
              { value: 12, name: "Large" },
              { value: 99, name: "Full" },
            ],
      shadows: shadowsArr,
      borders: bordersArr,
    };
  }

  function updateStylesPanel(options = {}) {
    const { force = false } = options;
    const isStylesPanelVisible =
      !stylesPanel || !stylesPanel.classList.contains("hidden");
    if (!force && !isStylesPanelVisible) {
      return;
    }

    const activeImport = getActiveImport();
    const htmlForStyles =
      (activeImport && activeImport.rawHtml) || state.rawHtml || "";

    const activeImportId = activeImport?.id || null;
    if (
      !force &&
      activeImportId === lastStylesPanelImportId &&
      htmlForStyles === lastStylesPanelSource
    ) {
      return;
    }

    let styles;
    if (!htmlForStyles) {
      styles = {
        colors: [],
        fonts: [],
        spacing: [],
        radii: [],
        shadows: [],
        borders: [],
      };
    } else if (
      activeImport &&
      activeImport._cachedStylesSource === htmlForStyles &&
      activeImport._cachedExtractedStyles
    ) {
      styles = activeImport._cachedExtractedStyles;
    } else {
      styles = extractStyles(htmlForStyles);
      if (activeImport) {
        activeImport._cachedStylesSource = htmlForStyles;
        activeImport._cachedExtractedStyles = styles;
      }
    }

    lastStylesPanelImportId = activeImportId;
    lastStylesPanelSource = htmlForStyles;

    if (stylesPanelElement?.setStylesData) {
      stylesPanelElement.setStylesData(styles);
    } else {
      stylesPanelElement.setAttribute("colors", JSON.stringify(styles.colors));
      stylesPanelElement.setAttribute("fonts", JSON.stringify(styles.fonts));
      stylesPanelElement.setAttribute(
        "spacing",
        JSON.stringify(styles.spacing),
      );
      stylesPanelElement.setAttribute("radii", JSON.stringify(styles.radii));
      stylesPanelElement.setAttribute(
        "shadows",
        JSON.stringify(styles.shadows),
      );
      stylesPanelElement.setAttribute(
        "borders",
        JSON.stringify(styles.borders),
      );
    }

    if (window.autoSaveFile && state.rawHtml) {
      window.autoSaveFile(
        "styles.json",
        JSON.stringify(styles, null, 2),
        "Styles",
      );
    }
  }

  function collectMergedStylesFromAllArtboards() {
    const importsWithHtml = state.imports.filter((item) => item?.rawHtml);
    const colorMap = new Map();
    const fontMap = new Map();
    const spacingMap = new Map();
    const radiiMap = new Map();
    const shadowMap = new Map();
    const borderMap = new Map();
    const perArtboard = [];

    const colorKey = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();

    importsWithHtml.forEach((item, index) => {
      const styles = extractStyles(item.rawHtml || "");
      perArtboard.push({
        id: item.id,
        name: item.displayName || `Artboard ${index + 1}`,
        styles,
      });

      (styles.colors || []).forEach((entry) => {
        const key = colorKey(entry.hex);
        if (!key || colorMap.has(key)) return;
        colorMap.set(key, {
          name: entry.name || `Color ${colorMap.size + 1}`,
          value: entry.hex,
        });
      });

      (styles.fonts || []).forEach((entry) => {
        const key = [entry.family, entry.size, entry.weight, entry.lineHeight]
          .map((part) => String(part || "").trim())
          .join("|");
        if (!key || fontMap.has(key)) return;
        fontMap.set(key, {
          name: entry.tag || `Text ${fontMap.size + 1}`,
          family: entry.family || "Inter",
          size: entry.size || "14px",
          weight: entry.weight || "400",
          lineHeight: entry.lineHeight || "1.5",
        });
      });

      (styles.spacing || []).forEach((entry) => {
        const key = Number(entry.value);
        if (!Number.isFinite(key) || spacingMap.has(key)) return;
        spacingMap.set(key, {
          name: entry.name || `Space ${key}`,
          value: key,
        });
      });

      (styles.radii || []).forEach((entry) => {
        const key = Number(entry.value);
        if (!Number.isFinite(key) || radiiMap.has(key)) return;
        radiiMap.set(key, {
          name: entry.name || `Radius ${key}`,
          value: key,
        });
      });

      (styles.shadows || []).forEach((entry) => {
        const key = String(entry.value || "").trim();
        if (!key || shadowMap.has(key)) return;
        shadowMap.set(key, {
          name: entry.name || `Shadow ${shadowMap.size + 1}`,
          value: key,
        });
      });

      (styles.borders || []).forEach((entry) => {
        const key = String(entry.value || "").trim();
        if (!key || borderMap.has(key)) return;
        borderMap.set(key, {
          name: entry.name || `Border ${borderMap.size + 1}`,
          value: key,
        });
      });
    });

    return {
      artboardCount: importsWithHtml.length,
      artboards: perArtboard,
      colors: Array.from(colorMap.values()),
      fonts: Array.from(fontMap.values()),
      spacing: Array.from(spacingMap.values()).sort(
        (a, b) => a.value - b.value,
      ),
      radii: Array.from(radiiMap.values()).sort((a, b) => a.value - b.value),
      shadows: Array.from(shadowMap.values()),
      borders: Array.from(borderMap.values()),
    };
  }

  function toTokenSlug(value, fallback) {
    const base = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || fallback;
  }

  /* ── Figma Native Variables JSON Export ──────────────────────────────── */

  /**
   * Parse a CSS hex color (#rgb, #rrggbb, #rrggbbaa) into Figma's RGBA
   * object with channels in the 0–1 range.
   */
  function hexToFigmaColor(hex) {
    let h = String(hex || "")
      .trim()
      .replace(/^#/, "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 4)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
    return {
      r: +r.toFixed(4),
      g: +g.toFixed(4),
      b: +b.toFixed(4),
      a: +a.toFixed(4),
    };
  }

  /**
   * Parse any CSS color string (hex, rgb(), rgba()) into Figma's { r, g, b, a }
   * object with channels normalized to 0–1. Returns null if unparseable.
   */
  function cssColorToFigma(colorStr) {
    const raw = String(colorStr || "")
      .trim()
      .toLowerCase();
    if (!raw) return null;

    // Hex colors
    if (raw.startsWith("#")) return hexToFigmaColor(raw);

    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbaMatch = raw.match(
      /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)/,
    );
    if (rgbaMatch) {
      return {
        r: +(parseInt(rgbaMatch[1], 10) / 255).toFixed(4),
        g: +(parseInt(rgbaMatch[2], 10) / 255).toFixed(4),
        b: +(parseInt(rgbaMatch[3], 10) / 255).toFixed(4),
        a:
          rgbaMatch[4] !== undefined ? +parseFloat(rgbaMatch[4]).toFixed(4) : 1,
      };
    }

    // hsl(h, s%, l%) or hsla(h, s%, l%, a)
    const hslaMatch = raw.match(
      /hsla?\(\s*(-?\d*\.?\d+)\s*,\s*(\d*\.?\d+)%\s*,\s*(\d*\.?\d+)%\s*(?:,\s*([\d.]+))?\s*\)/,
    );
    if (hslaMatch) {
      const h = (((Number(hslaMatch[1]) % 360) + 360) % 360) / 360;
      const s = Math.min(1, Math.max(0, Number(hslaMatch[2]) / 100));
      const l = Math.min(1, Math.max(0, Number(hslaMatch[3]) / 100));
      const a =
        hslaMatch[4] !== undefined
          ? Math.min(1, Math.max(0, Number(hslaMatch[4])))
          : 1;

      let r;
      let g;
      let b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (t) => {
          let tt = t;
          if (tt < 0) tt += 1;
          if (tt > 1) tt -= 1;
          if (tt < 1 / 6) return p + (q - p) * 6 * tt;
          if (tt < 1 / 2) return q;
          if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
          return p;
        };
        r = hue2rgb(h + 1 / 3);
        g = hue2rgb(h);
        b = hue2rgb(h - 1 / 3);
      }

      return {
        r: +r.toFixed(4),
        g: +g.toFixed(4),
        b: +b.toFixed(4),
        a: +a.toFixed(4),
      };
    }

    // Named colors / unsupported formats fallback via browser parsing
    try {
      const probe = document.createElement("span");
      probe.style.color = raw;
      probe.style.display = "none";
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color || "";
      document.body.removeChild(probe);
      const normalized = String(computed).trim().toLowerCase();
      if (normalized && normalized !== raw) {
        return cssColorToFigma(normalized);
      }
    } catch {
      // ignore parser fallback errors
    }

    return null;
  }

  /**
   * Extract a numeric px value from a CSS dimension string.
   * e.g. "16px" → 16, "1.5rem" → 24 (assuming 16px base), "12" → 12
   */
  function cssDimToPx(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/^(-?\d*\.?\d+)\s*(px|rem|em|)?$/i);
    if (!match) return null;
    const num = parseFloat(match[1]);
    if (!Number.isFinite(num)) return null;
    const unit = (match[2] || "").toLowerCase();
    if (unit === "rem" || unit === "em") return num * 16;
    return num;
  }

  function toFigmaTokenName(value, fallback) {
    const raw = String(value || fallback || "token").trim();
    if (!raw) return "token";
    return raw
      .replace(/[{}]/g, "")
      .replace(/\./g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toDtcgColorValue(rgba, originalHex = "") {
    const rr = Math.min(1, Math.max(0, Number(rgba?.r || 0)));
    const gg = Math.min(1, Math.max(0, Number(rgba?.g || 0)));
    const bb = Math.min(1, Math.max(0, Number(rgba?.b || 0)));
    const aa = Math.min(1, Math.max(0, Number(rgba?.a ?? 1)));
    const hex = String(originalHex || "")
      .trim()
      .toUpperCase();

    return {
      colorSpace: "srgb",
      components: [rr, gg, bb],
      alpha: aa,
      ...(hex ? { hex } : {}),
    };
  }

  /**
   * Build JSON in the DTCG-like shape accepted by Figma native variable import:
   * {
   *   "color": { "token": { "$type": "color", "$value": {...} } },
   *   "font size": { "14": { "$type": "number", "$value": 14 } },
   *   "$extensions": { "com.figma.modeName": "Mode 1" }
   * }
   */
  function buildFigmaVariablesJSON(payload) {
    const result = {
      color: {},
      "font family": {},
      "font size": {},
      "font weight": {},
      "line height": {},
      "item spacing": {},
      radius: {},
      shadow: {},
      border: {},
      $extensions: {
        "com.figma.modeName": "Mode 1",
      },
    };

    const nameCounters = new Map();
    const getUniqueTokenName = (collection, preferred, fallback) => {
      const base = toFigmaTokenName(preferred, fallback);
      const key = `${collection}:${base.toLowerCase()}`;
      const count = (nameCounters.get(key) || 0) + 1;
      nameCounters.set(key, count);
      return count === 1 ? base : `${base} ${count}`;
    };

    // Colors
    (payload.colors || []).forEach((entry, index) => {
      const rawColor = String(entry.value || entry.hex || "").trim();
      const rgba = cssColorToFigma(rawColor);
      if (!rgba) return;

      const name = getUniqueTokenName(
        "color",
        entry.name,
        `color-${index + 1}`,
      );
      result.color[name] = {
        $type: "color",
        $value: toDtcgColorValue(rgba, rawColor),
      };
    });

    // Spacing
    (payload.spacing || []).forEach((entry, index) => {
      const num =
        typeof entry.value === "number" ? entry.value : cssDimToPx(entry.value);
      if (!Number.isFinite(num)) return;
      const name = getUniqueTokenName(
        "item spacing",
        entry.name || entry.label,
        `space-${index + 1}`,
      );
      result["item spacing"][name] = {
        $type: "number",
        $value: Number(num),
      };
    });

    // Radius
    (payload.radii || []).forEach((entry, index) => {
      const num =
        typeof entry.value === "number" ? entry.value : cssDimToPx(entry.value);
      if (!Number.isFinite(num)) return;
      const name = getUniqueTokenName(
        "radius",
        entry.name,
        `radius-${index + 1}`,
      );
      result.radius[name] = {
        $type: "number",
        $value: Number(num),
      };
    });

    // Typography primitives
    (payload.fonts || []).forEach((entry, index) => {
      const name = getUniqueTokenName(
        "font",
        entry.name || entry.tag,
        `font-${index + 1}`,
      );

      const family = String(entry.family || "").trim();
      if (family) {
        result["font family"][name] = {
          $type: "string",
          $value: family,
        };
      }

      const size = cssDimToPx(entry.size);
      if (Number.isFinite(size)) {
        result["font size"][name] = {
          $type: "number",
          $value: Number(size),
        };
      }

      const weight = Number.parseFloat(entry.weight);
      if (Number.isFinite(weight)) {
        result["font weight"][name] = {
          $type: "number",
          $value: weight,
        };
      }

      const lineHeight = Number.parseFloat(entry.lineHeight);
      if (Number.isFinite(lineHeight)) {
        result["line height"][name] = {
          $type: "number",
          $value: lineHeight,
        };
      }
    });

    // Preserve exact sidebar values for shadows and borders as string variables
    (payload.shadows || []).forEach((entry, index) => {
      const raw = String(entry.value || "").trim();
      if (!raw) return;
      const name = getUniqueTokenName(
        "shadow",
        entry.name,
        `shadow-${index + 1}`,
      );
      result.shadow[name] = {
        $type: "string",
        $value: raw,
      };
    });

    (payload.borders || []).forEach((entry, index) => {
      const raw = String(entry.value || "").trim();
      if (!raw) return;
      const name = getUniqueTokenName(
        "border",
        entry.name,
        `border-${index + 1}`,
      );
      result.border[name] = {
        $type: "string",
        $value: raw,
      };
    });

    const compact = {};
    Object.keys(result).forEach((key) => {
      if (key === "$extensions") {
        compact[key] = result[key];
        return;
      }
      if (Object.keys(result[key] || {}).length > 0) {
        compact[key] = result[key];
      }
    });

    return JSON.stringify(compact, null, 2);
  }

  // Keep reference as buildFigmaStylesClipboardText for event handler
  function buildFigmaStylesClipboardText(payload) {
    return buildFigmaVariablesJSON(payload);
  }

  function downloadTextFile(filename, content, mimeType = "application/json") {
    const blob = new Blob([String(content || "")], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (stylesPanelElement) {
    stylesPanelElement.addEventListener(
      "copy-to-figma-styles",
      async (event) => {
        const sidebarStyles = event?.detail?.styles;
        const hasSidebarStyles =
          sidebarStyles &&
          ["colors", "fonts", "spacing", "radii", "shadows", "borders"].some(
            (key) =>
              Array.isArray(sidebarStyles[key]) &&
              sidebarStyles[key].length > 0,
          );

        const mergedStyles = hasSidebarStyles
          ? {
              colors: sidebarStyles.colors || [],
              fonts: sidebarStyles.fonts || [],
              spacing: sidebarStyles.spacing || [],
              radii: sidebarStyles.radii || [],
              shadows: sidebarStyles.shadows || [],
              borders: sidebarStyles.borders || [],
            }
          : collectMergedStylesFromAllArtboards();

        const totalTokens =
          (mergedStyles.colors?.length || 0) +
          (mergedStyles.fonts?.length || 0) +
          (mergedStyles.spacing?.length || 0) +
          (mergedStyles.radii?.length || 0) +
          (mergedStyles.shadows?.length || 0) +
          (mergedStyles.borders?.length || 0);

        if (!totalTokens) {
          updateStatus("No styles available to export.", "warning");
          return;
        }

        const exportText = buildFigmaStylesClipboardText(mergedStyles);
        downloadTextFile(
          "figma-variables.json",
          exportText,
          "application/json",
        );

        window.__FIGMA_EDITABLE_STYLE_TOKENS = mergedStyles;

        if (window.autoSaveFile) {
          window.autoSaveFile("figma-variables.json", exportText, "Styles");
        }

        updateStatus(
          "Downloaded Figma Variables JSON. Import via Local variables → Import in Figma.",
          "success",
        );
        showToast(
          "Variables downloaded",
          `Downloaded ${mergedStyles.colors.length} colors, ${mergedStyles.fonts.length} fonts, ${mergedStyles.spacing.length} spacing, ${mergedStyles.radii.length} radius, ${mergedStyles.shadows.length} shadows, ${mergedStyles.borders.length} borders.`,
          "success",
        );
      },
    );
  }

  function showToast(title, message, tone = "success") {
    if (shouldSuppressToast()) {
      return false;
    }
    if (toastEl && typeof toastEl.show === "function") {
      toastEl.show(title, message, tone);
      return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PWA install/open experience
  // ────────────────────────────────────────────────────────────────────────────
  const PWA_INSTALL_FLAG_KEY = "code2design.pwa.installed";
  const SHOW_PWA_INSTALL_BUTTON = false;
  let deferredInstallPrompt = null;
  let pwaInstallClickBusy = false;

  const isStandaloneMode = () => {
    const mediaStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    const iosStandalone = window.navigator.standalone === true;
    return mediaStandalone || iosStandalone;
  };

  const isPwaMarkedInstalled = () => {
    try {
      return localStorage.getItem(PWA_INSTALL_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markPwaInstalled = (installed) => {
    try {
      if (installed) {
        localStorage.setItem(PWA_INSTALL_FLAG_KEY, "1");
      } else {
        localStorage.removeItem(PWA_INSTALL_FLAG_KEY);
      }
    } catch {
      // Ignore storage failures silently.
    }
  };

  const updatePwaButtonUi = () => {
    if (!pwaInstallBtn) return;

    if (!SHOW_PWA_INSTALL_BUTTON) {
      pwaInstallBtn.classList.add("hidden");
      return;
    }

    const standalone = isStandaloneMode();
    document.body.classList.toggle("standalone-mode", standalone);

    // In true standalone mode, hide the button for a clean native-like experience.
    if (standalone) {
      pwaInstallBtn.classList.add("hidden");
      return;
    }

    const installed = standalone || isPwaMarkedInstalled();
    const canInstall = !!deferredInstallPrompt;

    if (canInstall) {
      pwaInstallBtn.classList.remove("hidden", "is-open");
      pwaInstallBtn.textContent = "Install App";
      pwaInstallBtn.setAttribute("aria-label", "Install App");
      return;
    }

    if (installed) {
      pwaInstallBtn.classList.remove("hidden");
      pwaInstallBtn.classList.add("is-open");
      pwaInstallBtn.textContent = "Open in App";
      pwaInstallBtn.setAttribute("aria-label", "Open in App");
      return;
    }

    pwaInstallBtn.classList.add("hidden");
    pwaInstallBtn.classList.remove("is-open");
  };

  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) return;
    const hostname = window.location.hostname || "";
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    const disableProtection = DISABLE_PROTECTION;

    if (isLocalHost || disableProtection) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      } catch {
        // Ignore localhost unregister failures.
      }

      if ("caches" in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        } catch {
          // Ignore cache cleanup failures.
        }
      }

      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_BUILD_STAMP}`, {
        scope: "/",
      });

      const requestSkipWaiting = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      };

      requestSkipWaiting();

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") {
            requestSkipWaiting();
          }
        });
      });
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  };

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener("click", async () => {
      if (pwaInstallClickBusy) return;

      if (deferredInstallPrompt) {
        pwaInstallClickBusy = true;
        try {
          deferredInstallPrompt.prompt();
          const choiceResult = await deferredInstallPrompt.userChoice;
          if (choiceResult?.outcome === "accepted") {
            markPwaInstalled(true);
            showToast(
              "Installed",
              "Motvin (beta) is ready as an app.",
              "success",
            );
          }
        } finally {
          deferredInstallPrompt = null;
          pwaInstallClickBusy = false;
          updatePwaButtonUi();
        }
        return;
      }

      // Open in app fallback. On supported platforms this can launch installed app.
      const appUrl = `${window.location.origin}${window.location.pathname}`;
      window.open(appUrl, "_blank", "noopener,noreferrer");
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updatePwaButtonUi();
  });

  window.addEventListener("appinstalled", () => {
    markPwaInstalled(true);
    deferredInstallPrompt = null;
    updatePwaButtonUi();
    showToast(
      "Installed",
      "Motvin (beta) is now available in app mode.",
      "success",
    );
  });

  const standaloneMql = window.matchMedia("(display-mode: standalone)");
  if (standaloneMql && typeof standaloneMql.addEventListener === "function") {
    standaloneMql.addEventListener("change", () => updatePwaButtonUi());
  }

  window.addEventListener("load", () => {
    registerServiceWorker();
    updatePwaButtonUi();
  });

  updatePwaButtonUi();

  function formatSize(totalBytes) {
    const sizeInMB = totalBytes / (1024 * 1024);
    if (sizeInMB < 0.1) {
      return `${(totalBytes / 1024).toFixed(0)} KB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  }

  function getActiveImport() {
    return (
      state.imports.find((item) => item.id === state.activeImportId) || null
    );
  }

  function renderMultiUploadCards() {
    const containers = [multiUploadList, urlMultiUploadList].filter(Boolean);
    if (containers.length === 0) return;

    const hasImports = state.imports.length > 0;

    containers.forEach((container) => {
      container.classList.toggle("hidden", !hasImports);
      container.innerHTML = "";
    });

    if (!hasImports) return;

    state.imports.forEach((item) => {
      const statusText = "Ready";
      const statusClass = "is-ready";
      const iconSrc =
        item.type === "folder"
          ? "assets/icon/icon-folder.svg"
          : "assets/icon/icon-file.svg";

      containers.forEach((container) => {
        const card = document.createElement("div");
        card.className = "file-item-card multi-upload-card";
        card.dataset.importId = String(item.id);

        card.innerHTML = `
                <div class="file-icon-box">
                    <img src="${iconSrc}" alt="File" width="20" height="20">
                </div>
                <div class="file-info-header">
                    <p class="filename">${item.displayName}</p>
                    <div class="file-meta">
                        <span class="file-size-text">${formatSize(item.totalSize || 0)}</span>
                        <span class="file-meta-separator">•</span>
                        <div class="status-ready-group ${statusClass}">
                            <span class="status-ready-icon" aria-hidden="true">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10.5 6C10.5 8.48528 8.48528 10.5 6 10.5C3.51472 10.5 1.5 8.48528 1.5 6C1.5 3.51472 3.51472 1.5 6 1.5C8.48528 1.5 10.5 3.51472 10.5 6Z" stroke="currentColor" stroke-width="1.25"/>
                                    <path d="M4.15 6.05L5.35 7.25L7.85 4.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            <span class="status-ready-text">${statusText}</span>
                        </div>
                    </div>
                </div>
                <button class="remove-btn multi-remove-btn" type="button" aria-label="Delete ${item.displayName}">
                    <img src="assets/icon/icon-delete.svg" alt="Delete" width="20" height="20">
                </button>
            `;

        const removeBtn = card.querySelector(".multi-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeImportsByIds([item.id]);
          });
        }

        container.appendChild(card);
      });
    });
  }

  function updateLoadedCard(importItem) {
    renderMultiUploadCards();

    if (!importItem) {
      if (previewIcon) previewIcon.src = "assets/icon/icon-file.svg";
      if (previewFileName) previewFileName.textContent = "screen.html";
      if (previewFileSize) previewFileSize.textContent = "0 KB";
      if (toolbarProjectName)
        toolbarProjectName.textContent = "Untitled Project";
      return;
    }

    if (previewFileName) {
      previewFileName.textContent =
        importItem.type === "folder"
          ? `Folder: ${importItem.displayName}`
          : importItem.displayName;
    }
    if (previewIcon) {
      previewIcon.src =
        importItem.type === "folder"
          ? "assets/icon/icon-folder.svg"
          : "assets/icon/icon-file.svg";
    }
    if (previewFileSize) {
      previewFileSize.textContent = formatSize(importItem.totalSize || 0);
    }
    if (toolbarProjectName) {
      toolbarProjectName.textContent = importItem.displayName;
    }
  }

  function resetConvertButton() {
    if (!convertButton) return;
    convertButton.disabled =
      state.imports.length === 0 || state.selectedImportIds.size === 0;
    convertButton.classList.remove("ready");
    const icon = convertButton.querySelector("img");
    const label = convertButton.querySelector("span");
    if (icon) icon.src = "assets/icon/icon-magic.svg";
    if (label) label.textContent = "Convert Design";
  }

  function updateConvertButtonForActive() {
    if (!convertButton) return;
    const activeImport = getActiveImport();
    if (!activeImport || state.selectedImportIds.size === 0) {
      resetConvertButton();
      return;
    }

    convertButton.disabled = false;
    const icon = convertButton.querySelector("img");
    const label = convertButton.querySelector("span");

    if (activeImport.isFrameReady) {
      convertButton.classList.add("ready");
      if (icon) icon.src = "assets/icon/icon-copy.svg";
      if (label) label.textContent = "Copy to figma";
    } else {
      convertButton.classList.remove("ready");
      if (icon) icon.src = "assets/icon/icon-magic.svg";
      if (label) label.textContent = "Convert Design";
    }
  }

  function updateDropzoneVisibility() {
    const wrapper = document.getElementById("dropzoneWrapper");
    const browseBtnLabel = browseBtn?.querySelector(".browse-btn-label");
    const hasImports = state.imports.length > 0;
    const useUploadedLayout = hasImports;
    const isAtLimit = state.imports.length >= state.maxImports;

    // Keep import area visible while user can still add more items.
    if (wrapper) wrapper.classList.toggle("hidden", isAtLimit && hasImports);
    if (wrapper)
      wrapper.classList.toggle("multi-upload-mode", useUploadedLayout);

    if (browseBtn) {
      browseBtn.disabled = isAtLimit;
      browseBtn.style.opacity = isAtLimit ? "0.55" : "1";
      browseBtn.style.cursor = isAtLimit ? "not-allowed" : "pointer";
      browseBtn.title = isAtLimit ? "Maximum 5 imports reached" : "";
    }
    if (browseBtnLabel) {
      browseBtnLabel.textContent = useUploadedLayout
        ? "New Files/Folders"
        : "Browser File";
    }

    if (dropzoneLoaded) {
      dropzoneLoaded.classList.toggle("hidden", !hasImports);
      dropzoneLoaded.classList.toggle("multi-upload-mode", useUploadedLayout);
    }

    if (singleUploadCard) {
      singleUploadCard.classList.toggle("hidden", useUploadedLayout);
    }

    const code2DesignAccordion = document.getElementById(
      "accordionCode2design",
    );
    const code2DesignTab = document.getElementById("tabCode2design");
    if (code2DesignAccordion)
      code2DesignAccordion.classList.toggle("open", hasImports);
    if (code2DesignTab) {
      code2DesignTab.classList.toggle("active", hasImports);
      syncTreeTabState(code2DesignTab);
    }

    renderMultiUploadCards();
  }

  function ensureCode2DesignAccordionOpen() {
    const accordion = document.getElementById("accordionCode2design");
    const tab = document.getElementById("tabCode2design");
    if (accordion) accordion.classList.add("open");
    if (tab) {
      tab.classList.add("active");
      syncTreeTabState(tab);
    }
  }

  function createCanvasPreviewElement() {
    const preview = document.createElement("div");
    // Always visible from creation. Previously some creation paths (clipboard
    // paste, undo/redo snapshot hydration) never added "visible", leaving
    // those artboards invisible until some later, unrelated action (like
    // Convert Design) blanket-revealed every import at once — this is what
    // caused multiple artboards to seemingly "appear out of nowhere".
    preview.className = "canvas-preview visible";
    preview.innerHTML = `
          <div class="artboard-label-top-left">1</div>
          <div class="artboard-label-top-right">&lt;/&gt;</div>
          <div class="selection-handle tl"></div>
          <div class="selection-handle tr"></div>
          <div class="selection-handle bl"></div>
          <div class="selection-handle br"></div>
                    <div class="selection-edge t"></div>
                    <div class="selection-edge r"></div>
                    <div class="selection-edge b"></div>
                    <div class="selection-edge l"></div>
          <div class="artboard-dimension-label">1440 × 901 Hug</div>
          <iframe></iframe>
        `;
    const frame = preview.querySelector("iframe");
    if (frame) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "none";
      frame.style.pointerEvents = "none";
      frame.style.display = "block";
    }
    preview.addEventListener("click", (event) => {
      // Selection is handled in canvas mousedown (with Shift/Cmd/Ctrl support).
      // Prevent this click from overriding multi-selection back to single.
      event.stopPropagation();
    });

    const dimensionBadge = preview.querySelector(".artboard-dimension-label");
    if (dimensionBadge) {
      const stopCanvasDragFromBadge = (event) => {
        event.stopPropagation();
      };

      const closeBadgeEditor = () => {
        dimensionBadge.contentEditable = "false";
        dimensionBadge.classList.remove("editing");
      };

      const applyBadgeDimensions = () => {
        const importId = Number(preview.dataset.importId);
        const item = state.imports.find((entry) => entry.id === importId);
        if (!item) {
          closeBadgeEditor();
          return;
        }

        const text = (dimensionBadge.textContent || "").trim();
        const match =
          text.match(/(\d+)\s*[x×]\s*(\d+)/i) || text.match(/(\d+)\D+(\d+)/);
        if (match) {
          const w = parseInt(match[1], 10);
          const h = parseInt(match[2], 10);
          if (!Number.isNaN(w) && !Number.isNaN(h)) {
            applyArtboardDimensions(item, w, h, { syncInputs: true });
            updateCamera();
            closeBadgeEditor();
            return;
          }
        }

        const { width, height } = getArtboardDimensions(item);
        dimensionBadge.textContent = `${width} × ${height} Hug`;
        closeBadgeEditor();
      };

      dimensionBadge.addEventListener("mousedown", stopCanvasDragFromBadge);
      dimensionBadge.addEventListener("click", stopCanvasDragFromBadge);

      dimensionBadge.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const importId = Number(preview.dataset.importId);
        const item = state.imports.find((entry) => entry.id === importId);
        if (!item || !preview.classList.contains("primary-selected")) return;

        const { width, height } = getArtboardDimensions(item);
        dimensionBadge.textContent = `${width} x ${height}`;
        dimensionBadge.contentEditable = "true";
        dimensionBadge.classList.add("editing");

        const range = document.createRange();
        range.selectNodeContents(dimensionBadge);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });

      dimensionBadge.addEventListener("keydown", (event) => {
        if (!dimensionBadge.classList.contains("editing")) return;
        if (event.key === "Enter") {
          event.preventDefault();
          applyBadgeDimensions();
        } else if (event.key === "Escape") {
          event.preventDefault();
          const importId = Number(preview.dataset.importId);
          const item = state.imports.find((entry) => entry.id === importId);
          if (item) {
            const { width, height } = getArtboardDimensions(item);
            dimensionBadge.textContent = `${width} × ${height} Hug`;
          }
          closeBadgeEditor();
        }
      });

      dimensionBadge.addEventListener("blur", () => {
        if (dimensionBadge.classList.contains("editing")) {
          applyBadgeDimensions();
        }
      });
    }
    return preview;
  }

  let duplicateFrameHydrationRaf = 0;
  const pendingDuplicateFrameHydrations = [];

  function loadIframeSrcdocSafely(frameEl, primarySrcdoc, fallbackSrcdoc = "") {
    if (!frameEl) return;

    const primaryHtml = String(primarySrcdoc || "");
    const fallbackHtml = String(fallbackSrcdoc || primaryHtml || "");
    const loadToken = (Number(frameEl.__c2dPreviewLoadToken) || 0) + 1;
    frameEl.__c2dPreviewLoadToken = loadToken;

    const isCurrentLoad = () => frameEl.__c2dPreviewLoadToken === loadToken;

    const applySrcdoc = (html) => {
      if (!isCurrentLoad()) return;
      frameEl.removeAttribute("src");
      frameEl.srcdoc = String(html || "");
    };

    const appearsBlank = () => {
      if (!isCurrentLoad()) return false;
      try {
        const doc = frameEl.contentDocument || frameEl.contentWindow?.document;
        if (!doc?.body) return true;

        const body = doc.body;
        const textLength = (body.innerText || "").trim().length;
        const visualNodes = body.querySelectorAll(
          "img, svg, canvas, video, picture, iframe, object, embed, section, main, article, div",
        ).length;
        const elementChildren = body.childElementCount;

        return textLength === 0 && visualNodes === 0 && elementChildren === 0;
      } catch {
        return true;
      }
    };

    let recovered = false;
    const recoverOnce = () => {
      if (!isCurrentLoad() || recovered) return;
      recovered = true;
      applySrcdoc(fallbackHtml);
    };

    frameEl.onload = () => {
      if (!isCurrentLoad()) return;
      window.setTimeout(() => {
        if (appearsBlank()) recoverOnce();
      }, 420);
      window.setTimeout(() => {
        if (appearsBlank()) recoverOnce();
      }, 1350);
    };

    applySrcdoc(primaryHtml);
    window.setTimeout(() => {
      if (appearsBlank()) recoverOnce();
    }, 2100);
  }

  function scheduleDuplicateFrameHydration(frameEl, srcdoc) {
    if (!frameEl) return;
    pendingDuplicateFrameHydrations.push({ frameEl, srcdoc: srcdoc || "" });

    if (duplicateFrameHydrationRaf) return;
    duplicateFrameHydrationRaf = requestAnimationFrame(() => {
      duplicateFrameHydrationRaf = 0;
      while (pendingDuplicateFrameHydrations.length > 0) {
        const next = pendingDuplicateFrameHydrations.shift();
        if (!next?.frameEl?.isConnected) continue;
        loadIframeSrcdocSafely(next.frameEl, next.srcdoc, next.srcdoc);
      }
    });
  }

  function renderAttachmentsTree() {
    if (!attachmentsTree) return;
    attachmentsTree.innerHTML = "";

    state.imports.forEach((item, index) => {
      const orderNumber = index + 1;

      const artboardOrderLabel = item.previewEl?.querySelector(
        ".artboard-label-top-left",
      );
      if (artboardOrderLabel) {
        artboardOrderLabel.textContent = String(orderNumber);
      }

      const tab = document.createElement("div");
      tab.className = `tree-sub-tab ${item.id === state.activeImportId ? "active" : ""}`;
      tab.style.setProperty("--stagger-index", String(index));
      tab.dataset.importId = String(item.id);
      tab.innerHTML = `
              <div class="tree-sub-tab-content">
                                <span class="tree-sub-tab-active-indicator ${item.id === state.activeImportId ? "visible" : ""}" aria-hidden="true"></span>
                <span class="tree-sub-tab-text">${item.displayName}</span>
              </div>
            `;

      tab.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showPropertiesInspectorPanel();
        if (
          state.selectedImportIds.has(item.id) &&
          state.selectedImportIds.size > 1
        ) {
          // In multi-select mode, allow switching the primary active artboard
          // without dropping the rest of the selection.
          setActiveImport(item.id, {
            preserveSelection: true,
            deferNonCriticalUi: true,
          });
        } else {
          setActiveImport(item.id, { deferNonCriticalUi: true });
        }
        // Per request: no pan animation for sidemenu list selection (instant jump).
        focusArtboardInCanvas(item, { instant: true });
      });

      attachmentsTree.appendChild(tab);
    });

    syncAttachmentsTreeActiveState();
  }

  function renderStylesAttachmentsTree() {
    if (!stylesAttachmentsTree) return;
    stylesAttachmentsTree.innerHTML = "";

    state.imports.forEach((item, index) => {
      const tab = document.createElement("div");
      tab.className = `tree-sub-tab ${item.id === state.activeImportId ? "active" : ""}`;
      tab.style.setProperty("--stagger-index", String(index));
      tab.dataset.importId = String(item.id);
      tab.innerHTML = `
              <div class="tree-sub-tab-content">
                <span class="tree-sub-tab-active-indicator ${item.id === state.activeImportId ? "visible" : ""}" aria-hidden="true"></span>
                <span class="tree-sub-tab-text">${item.displayName}</span>
              </div>
            `;

      tab.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showStylesInspectorPanel();
        if (
          state.selectedImportIds.has(item.id) &&
          state.selectedImportIds.size > 1
        ) {
          setActiveImport(item.id, {
            preserveSelection: true,
            deferNonCriticalUi: true,
          });
        } else {
          setActiveImport(item.id, { deferNonCriticalUi: true });
        }
        updateStylesPanel();
      });

      stylesAttachmentsTree.appendChild(tab);
    });

    syncStylesAttachmentsTreeActiveState();
  }

  function syncAttachmentsTreeActiveState() {
    if (!attachmentsTree) return;

    const tabs = attachmentsTree.querySelectorAll(".tree-sub-tab");
    tabs.forEach((tab) => {
      const tabImportId = Number(tab.dataset.importId);
      const isActive = tabImportId === state.activeImportId;
      tab.classList.toggle("active", isActive);

      const content = tab.querySelector(".tree-sub-tab-content");
      if (!content) return;

      const indicator = content.querySelector(".tree-sub-tab-active-indicator");
      if (indicator) {
        indicator.classList.toggle("visible", isActive);
      }
    });
  }

  function syncStylesAttachmentsTreeActiveState() {
    if (!stylesAttachmentsTree) return;

    const tabs = stylesAttachmentsTree.querySelectorAll(".tree-sub-tab");
    tabs.forEach((tab) => {
      const tabImportId = Number(tab.dataset.importId);
      const isActive = tabImportId === state.activeImportId;
      tab.classList.toggle("active", isActive);

      const content = tab.querySelector(".tree-sub-tab-content");
      if (!content) return;

      const indicator = content.querySelector(".tree-sub-tab-active-indicator");
      if (indicator) {
        indicator.classList.toggle("visible", isActive);
      }
    });
  }

  function syncStateFromActiveImport(options = {}) {
    const { syncInputs = true } = options;
    const activeImport = getActiveImport();
    if (!activeImport) {
      state.file = null;
      state.rawHtml = "";
      state.preparedHtml = "";
      state.isFrameReady = false;
      state.captureUrl = "";
      state.assetBlobs = new Map();
      // Clear stale references instead of leaving canvasPreview/previewFrame
      // pointing at whatever import was previously active (or the orphaned
      // static placeholder from initial page load) — otherwise later code
      // (e.g. Convert Design) could act on/reveal the wrong element.
      canvasPreview = null;
      previewFrame = null;
      return;
    }

    state.file = activeImport.file;
    state.rawHtml = activeImport.rawHtml;
    state.preparedHtml = activeImport.preparedHtml || "";
    state.isFrameReady = Boolean(activeImport.isFrameReady);
    state.captureUrl = activeImport.captureUrl || "";
    state.assetBlobs = activeImport.assetBlobs || new Map();
    canvasPreview = activeImport.previewEl;
    previewFrame = activeImport.frameEl;
    dimensionLabel =
      canvasPreview?.querySelector(".artboard-dimension-label") ||
      dimensionLabel;
    if (syncInputs) {
      syncDimensionInputsFromItem(activeImport);
    }
  }

  function getArtboardDimensions(item) {
    if (!item?.previewEl) {
      return { width: 1440, height: 900 };
    }
    const width =
      parseInt(item.previewEl.style.width, 10) ||
      Math.round(item.previewEl.offsetWidth || 1440);
    const height =
      parseInt(item.previewEl.style.height, 10) ||
      Math.round(item.previewEl.offsetHeight || 900);
    return { width, height };
  }

  /**
   * Compute an item's screen-space bounding rect from world coordinates + camera,
   * avoiding getBoundingClientRect() layout thrash entirely.
   * Returns { left, top, right, bottom, centerX, centerY, width, height }.
   */
  function getWorldBoundsInScreen(item) {
    const vp = canvasViewport;
    if (!vp || !item?.previewEl) return null;
    // Cache viewport rect per frame (set by caller or compute once)
    const vpRect = _cachedViewportRect || vp.getBoundingClientRect();
    const vpCenterX = vpRect.width / 2;
    const vpCenterY = vpRect.height / 2;
    const { width: w, height: h } = getArtboardDimensions(item);
    const worldX = item.artboardX || 0;
    const worldY = item.artboardY || 0;
    const s = camera.scale;
    const left = vpRect.left + vpCenterX + camera.x + worldX * s;
    const top = vpRect.top + vpCenterY + camera.y + worldY * s;
    const right = left + w * s;
    const bottom = top + h * s;
    return {
      left,
      top,
      right,
      bottom,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
      width: w * s,
      height: h * s,
    };
  }
  // Per-frame viewport rect cache (set once at top of drag-move, cleared after)
  let _cachedViewportRect = null;

  /**
   * Filter items to only those within proximity of movingBounds (screen px).
   */
  function getNearbyItems(otherItems, movingBounds, rangePx) {
    const range = rangePx || SMART_GUIDE_PROXIMITY_RANGE_PX;
    return otherItems.filter((item) => {
      const rect = getWorldBoundsInScreen(item);
      if (!rect) return false;
      // Check if any part of the item is within range of the moving bounds
      return (
        rect.right >= movingBounds.left - range &&
        rect.left <= movingBounds.right + range &&
        rect.bottom >= movingBounds.top - range &&
        rect.top <= movingBounds.bottom + range
      );
    });
  }

  // Revokes stale capture blobs and resets conversion-ready state for the
  // given import ids — the actual "a resize/edit invalidates the previous
  // Convert Design output" bookkeeping, extracted so it can be deferred
  // during a live resize drag (see applyArtboardDimensions' `liveOnly`).
  function invalidateConversionForIds(idsToReset) {
    const revokedUrls = new Set();
    idsToReset.forEach((id) => {
      const target = state.imports.find((entry) => entry.id === id);
      if (!target) return;

      if (target.captureUrl) {
        URL.revokeObjectURL(target.captureUrl);
        revokedUrls.add(target.captureUrl);
      }

      target.captureUrl = "";
      target.preparedHtml = "";
      target.isFrameReady = false;
      target.conversionStats = null;
    });

    if (idsToReset.includes(state.activeImportId)) {
      if (state.captureUrl && !revokedUrls.has(state.captureUrl)) {
        URL.revokeObjectURL(state.captureUrl);
      }
      state.captureUrl = "";
      state.preparedHtml = "";
      state.isFrameReady = false;
      updateConvertButtonForActive();
    }

    syncConversionSummaryForSelection();
    schedulePersistWorkspaceState();
  }

  function applyArtboardDimensions(item, width, height, options = {}) {
    if (!item?.previewEl) return;
    const { syncInputs = false, liveOnly = false } = options;

    const parsedWidth = Number(width);
    const parsedHeight = Number(height);
    if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) return;

    const finalWidth = Math.max(0, Math.round(parsedWidth));
    const finalHeight = Math.max(0, Math.round(parsedHeight));
    const current = getArtboardDimensions(item);
    const didResize =
      current.width !== finalWidth || current.height !== finalHeight;

    item.previewEl.style.width = `${finalWidth}px`;
    item.previewEl.style.height = `${finalHeight}px`;

    const label = item.previewEl.querySelector(".artboard-dimension-label");
    if (label) {
      label.textContent = `${finalWidth} × ${finalHeight} Hug`;
    }

    if (didResize) {
      const shouldResetSelectedBatch =
        state.selectedImportIds.size > 1 &&
        state.selectedImportIds.has(item.id);
      const idsToReset = shouldResetSelectedBatch
        ? Array.from(state.selectedImportIds)
        : [item.id];

      if (liveOnly) {
        // During an active resize drag this runs on nearly every
        // mousemove tick (dozens of times per second). Revoking blob URLs
        // and rescheduling persistence that often contributes to visible
        // flicker/jank for no benefit, since only the final size matters —
        // defer it and flush once when the drag ends (mouseup).
        pendingResizeInvalidateIds = idsToReset;
      } else {
        pendingResizeInvalidateIds = null;
        invalidateConversionForIds(idsToReset);
      }
    }

    if (syncInputs && item.id === state.activeImportId) {
      syncDimensionInputsFromItem(item);
    }
  }

  function syncDimensionInputsFromItem(item) {
    if (!item?.previewEl) return;
    const { width, height } = getArtboardDimensions(item);
    if (viewportWidthInput) viewportWidthInput.value = String(width);
    if (viewportHeightInput) viewportHeightInput.value = String(height);
    if (dimensionLabel) dimensionLabel.textContent = `${width} × ${height} Hug`;
  }

  function persistActiveImportState() {
    const activeImport = getActiveImport();
    if (!activeImport) return;
    activeImport.file = state.file;
    activeImport.rawHtml = state.rawHtml;
    activeImport.preparedHtml = state.preparedHtml;
    activeImport.isFrameReady = state.isFrameReady;
    activeImport.captureUrl = state.captureUrl;
    activeImport.assetBlobs = state.assetBlobs;
    schedulePersistWorkspaceState({ showFeedback: false });
  }

  function saveWorkspaceNowWithFeedback() {
    return saveWorkspaceNowWithFeedbackOptions({ silent: false });
  }

  function saveWorkspaceNowWithFeedbackOptions({ silent = false } = {}) {
    persistActiveImportState();

    if (persistWorkspaceTimer) {
      clearTimeout(persistWorkspaceTimer);
      persistWorkspaceTimer = null;
    }

    if (!manualSavePromise) {
      manualSavePromise = persistWorkspaceStateNow()
        .then((saved) => {
          if (silent) return saved;

          if (saved) {
            updateStatus("All changes saved.", "success");
            showToast("Saved", "All changes saved.", "success");
          } else {
            updateStatus("Save failed. Retry Cmd/Ctrl + S.", "warning");
            showToast(
              "Save failed",
              "Could not save all changes. Retry.",
              "warning",
            );
          }
          return saved;
        })
        .catch((error) => {
          console.warn("Manual save failed:", error);
          if (!silent) {
            updateStatus("Save failed. Retry Cmd/Ctrl + S.", "warning");
            showToast(
              "Save failed",
              "Could not save all changes. Retry.",
              "warning",
            );
          }
          return false;
        })
        .finally(() => {
          manualSavePromise = null;
        });
    }

    return manualSavePromise;
  }

  function applySelectionClasses(changedIds = null) {
    const changedIdSet =
      Array.isArray(changedIds) && changedIds.length > 0
        ? new Set(changedIds.map((id) => Number(id)).filter((id) => id > 0))
        : null;

    state.imports.forEach((item, index) => {
      if (!item.previewEl) return;
      if (changedIdSet && !changedIdSet.has(item.id)) return;
      const isActive = item.id === state.activeImportId;
      const isSelected = state.selectedImportIds.has(item.id);
      item.previewEl.classList.toggle("visible", true);
      item.previewEl.classList.toggle("selected", isSelected);
      item.previewEl.classList.toggle(
        "primary-selected",
        isSelected && isActive,
      );
      item.previewEl.classList.toggle(
        "multi-selected",
        isSelected && !isActive,
      );
      item.previewEl.classList.toggle("inactive", false);
      item.previewEl.style.zIndex = isActive ? "20" : String(5 + index);
    });
    updateGroupSelectionBox();
  }

  function clearCanvasSelection() {
    state.selectedImportIds = new Set();
    applySelectionClasses();
    updateConvertButtonForActive();
    syncConversionSummaryForSelection();
  }

  function alignSelectedArtboards(mode) {
    const selectedItems = state.imports.filter(
      (item) => state.selectedImportIds.has(item.id) && item.previewEl,
    );
    if (selectedItems.length <= 1) return;

    const bounds = selectedItems.map((item) => {
      const { width, height } = getArtboardDimensions(item);
      const x = item.artboardX || 0;
      const y = item.artboardY || 0;
      return {
        item,
        x,
        y,
        width,
        height,
        right: x + width,
        bottom: y + height,
      };
    });

    const minLeft = Math.min(...bounds.map((b) => b.x));
    const minTop = Math.min(...bounds.map((b) => b.y));
    const maxRight = Math.max(...bounds.map((b) => b.right));
    const maxBottom = Math.max(...bounds.map((b) => b.bottom));

    bounds.forEach((entry) => {
      if (mode === "top") {
        entry.item.artboardY = minTop;
      } else if (mode === "bottom") {
        entry.item.artboardY = maxBottom - entry.height;
      } else if (mode === "left") {
        entry.item.artboardX = minLeft;
      } else if (mode === "right") {
        entry.item.artboardX = maxRight - entry.width;
      }

      entry.item.targetArtboardX = entry.item.artboardX;
      entry.item.targetArtboardY = entry.item.artboardY;
    });

    updateCamera();
    schedulePersistWorkspaceState({ showFeedback: true });
  }

  let groupSelectionBoxRaf = 0;

  function updateGroupSelectionBox() {
    if (!canvasViewport || !groupSelection.element) return;

    if (state.selectedImportIds.size <= 1) {
      if (groupSelection.element.classList.contains("active")) {
        groupSelection.element.classList.remove("active");
        if (groupSelection.toolbar)
          groupSelection.toolbar.classList.remove("active");
        canvasViewport.classList.remove("group-selection-active");
      }
      return;
    }

    const selectedItems = state.imports.filter(
      (item) =>
        state.selectedImportIds.has(item.id) &&
        item.previewEl &&
        item.previewEl.classList.contains("visible"),
    );

    if (selectedItems.length <= 1) {
      groupSelection.element.classList.remove("active");
      if (groupSelection.toolbar)
        groupSelection.toolbar.classList.remove("active");
      canvasViewport.classList.remove("group-selection-active");
      return;
    }

    // Use the per-frame cached rect when inside a drag loop to avoid a forced
    // layout reflow on every mousemove event with multiple artboards selected.
    const viewportRect =
      _cachedViewportRect || canvasViewport.getBoundingClientRect();
    const viewportCenterX = viewportRect.width / 2;
    const viewportCenterY = viewportRect.height / 2;
    const scale = camera.scale || 1;
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    selectedItems.forEach((item) => {
      const { width, height } = getArtboardDimensions(item);
      const x = Number(item.artboardX) || 0;
      const y = Number(item.artboardY) || 0;

      const left = viewportRect.left + viewportCenterX + camera.x + x * scale;
      const top = viewportRect.top + viewportCenterY + camera.y + y * scale;
      const right = left + width * scale;
      const bottom = top + height * scale;

      minLeft = Math.min(minLeft, left);
      minTop = Math.min(minTop, top);
      maxRight = Math.max(maxRight, right);
      maxBottom = Math.max(maxBottom, bottom);
    });

    const left = minLeft - viewportRect.left;
    const top = minTop - viewportRect.top;
    const width = Math.max(0, maxRight - minLeft);
    const height = Math.max(0, maxBottom - minTop);

    const modelWidth = Math.max(1, Math.round(width / (camera.scale || 1)));
    const modelHeight = Math.max(1, Math.round(height / (camera.scale || 1)));

    groupSelection.element.style.left = `${left}px`;
    groupSelection.element.style.top = `${top}px`;
    groupSelection.element.style.width = `${width}px`;
    groupSelection.element.style.height = `${height}px`;

    if (groupSelection.toolbar) {
      const toolbarTop = top + height / 2;
      const toolbarLeft = left + width + 14;
      groupSelection.toolbar.style.left = `${toolbarLeft}px`;
      groupSelection.toolbar.style.top = `${toolbarTop}px`;
      groupSelection.toolbar.classList.add("active");
    }

    const label = groupSelection.element.querySelector(
      ".group-selection-dimension-label",
    );
    if (label) {
      label.textContent = `${modelWidth} × ${modelHeight} Hug`;
    }

    groupSelection.element.classList.add("active");
    canvasViewport.classList.add("group-selection-active");
  }

  function scheduleGroupSelectionBoxUpdate() {
    if (groupSelectionBoxRaf) return;
    groupSelectionBoxRaf = requestAnimationFrame(() => {
      groupSelectionBoxRaf = 0;
      updateGroupSelectionBox();
    });
  }

  let deferredActiveImportUiRaf = 0;
  let lastSummarySignature = "";

  function setActiveImport(importId, options = {}) {
    const {
      preserveSelection = false,
      selectedIds = null,
      deferNonCriticalUi = false,
    } = options;
    if (!state.imports.some((item) => item.id === importId)) return;

    const hasSameSelectedIds = Array.isArray(selectedIds)
      ? selectedIds.length === state.selectedImportIds.size &&
        selectedIds.every((id) => state.selectedImportIds.has(id))
      : false;

    if (
      state.activeImportId === importId &&
      (hasSameSelectedIds ||
        (!Array.isArray(selectedIds) && preserveSelection) ||
        (!Array.isArray(selectedIds) &&
          !preserveSelection &&
          state.selectedImportIds.size === 1 &&
          state.selectedImportIds.has(importId)))
    ) {
      return;
    }

    if (state.activeImportId !== importId) {
      persistActiveImportState();
    }

    const prevActiveImportId = state.activeImportId;
    const prevSelectedImportIds = new Set(state.selectedImportIds);

    state.activeImportId = importId;

    if (Array.isArray(selectedIds)) {
      state.selectedImportIds = new Set(
        selectedIds.filter((id) =>
          state.imports.some((item) => item.id === id),
        ),
      );
      state.selectedImportIds.add(importId);
    } else if (!preserveSelection) {
      state.selectedImportIds = new Set([importId]);
    } else if (!state.selectedImportIds.has(importId)) {
      state.selectedImportIds.add(importId);
    }

    syncStateFromActiveImport({ syncInputs: !deferNonCriticalUi });

    const changedSelectionIds = new Set([
      prevActiveImportId,
      importId,
      ...prevSelectedImportIds,
      ...state.selectedImportIds,
    ]);
    changedSelectionIds.delete(null);
    changedSelectionIds.delete(undefined);

    applySelectionClasses(Array.from(changedSelectionIds));
    updateOptionSpacingGuides();

    const activeImport = getActiveImport();

    const applyNonCriticalActiveImportUi = (targetImport) => {
      if (!targetImport) return;

      const stylesActive = isStylesInspectorActive();
      const propertiesActive = isPropertiesInspectorActive();

      if (propertiesActive) {
        syncDimensionInputsFromItem(targetImport);
        updateLoadedCard(targetImport);
        updateConvertButtonForActive();
        syncConversionSummaryForSelection();
      }

      if (stylesActive) {
        updateStylesPanel();
      }

      refreshActiveExplorerTrees();

      updateStatus(`Selected: ${targetImport.displayName}`);
      schedulePersistWorkspaceState({ showFeedback: false });
    };

    if (deferNonCriticalUi) {
      // During rapid Tab/sidemenu navigation, avoid re-running heavy panel/stat sync on
      // every single keypress. Coalesce to one update in the next animation frame.
      if (deferredActiveImportUiRaf)
        cancelAnimationFrame(deferredActiveImportUiRaf);
      deferredActiveImportUiRaf = requestAnimationFrame(() => {
        deferredActiveImportUiRaf = 0;
        const latestActive = getActiveImport();
        applyNonCriticalActiveImportUi(latestActive);
      });
    } else {
      applyNonCriticalActiveImportUi(activeImport);
    }
  }

  function syncConversionSummaryForSelection(options = {}) {
    const { force = false } = options;
    if (!force && !isPropertiesInspectorActive()) {
      return;
    }

    const summarySection = document.getElementById("summarySection");

    if (state.selectedImportIds.size === 0) {
      if (summarySection) {
        summarySection.classList.remove("hidden");
        summarySection.classList.add("summary-inactive");
      }
      if (lastSummarySignature === "empty") return;
      lastSummarySignature = "empty";
      resetStats();
      return;
    }

    if (summarySection) {
      summarySection.classList.remove("hidden");
      summarySection.classList.remove("summary-inactive");
    }

    const selectedItems =
      state.selectedImportIds.size > 0
        ? state.imports.filter((item) => state.selectedImportIds.has(item.id))
        : [];

    const targetItems = selectedItems;

    if (!targetItems.length) {
      if (lastSummarySignature === "empty") return;
      lastSummarySignature = "empty";
      resetStats();
      return;
    }

    const summaries = targetItems
      .map((item) => item.conversionStats)
      .filter(Boolean);

    if (!summaries.length) {
      if (lastSummarySignature === "empty") return;
      lastSummarySignature = "empty";
      resetStats();
      return;
    }

    const aggregate = summaries.reduce(
      (acc, stat) => {
        acc.frames += Number(stat.frames) || 0;
        acc.text += Number(stat.text) || 0;
        acc.image += Number(stat.image) || 0;
        acc.container += Number(stat.container) || 0;
        return acc;
      },
      { frames: 0, text: 0, image: 0, container: 0 },
    );

    const nextSummarySignature = `stats:${aggregate.frames}|${aggregate.text}|${aggregate.image}|${aggregate.container}`;
    if (nextSummarySignature === lastSummarySignature) return;
    lastSummarySignature = nextSummarySignature;

    // Selection can fire very frequently; avoid animated counters in this path.
    renderStats(aggregate, { animate: false });
  }

  async function createImportItemFromFiles(files, folderName = "") {
    const candidates = Array.from(files || []);
    if (candidates.length === 0) return null;

    const htmlFile =
      candidates.find((f) => f.name.toLowerCase() === "files.html") ||
      candidates.find((f) => /\.html?$/i.test(f.name));

    if (!htmlFile) return null;

    const rawHtml = await htmlFile.text();
    const type = folderName || candidates.length > 1 ? "folder" : "file";
    const displayName = folderName || htmlFile.name;

    const assetBlobs = new Map();
    let totalSize = 0;
    candidates.forEach((file) => {
      totalSize += file.size || 0;
      const relPath = file.webkitRelativePath || file.customPath || file.name;
      const blobUrl = URL.createObjectURL(file);
      assetBlobs.set(relPath, blobUrl);
      assetBlobs.set(file.name, blobUrl);

      if (relPath.includes("/")) {
        const parts = relPath.split("/");
        if (parts.length > 1) {
          assetBlobs.set(parts.slice(1).join("/"), blobUrl);
        }
      }
    });

    const previewEl = createCanvasPreviewElement();
    const frameEl = previewEl.querySelector("iframe");

    const initWidth =
      (viewportWidthInput && parseInt(viewportWidthInput.value, 10)) || 1440;
    const initHeight =
      (viewportHeightInput && parseInt(viewportHeightInput.value, 10)) || 900;
    previewEl.style.width = `${initWidth}px`;
    previewEl.style.height = `${initHeight}px`;
    if (frameEl) {
      frameEl.style.width = "100%";
      frameEl.style.height = "100%";
      // For very large files (>50 MB), use a truncated preview to prevent
      // the browser from running out of memory (Chrome "Aw, Snap!" Error 5).
      // The full rawHtml is preserved on the import item for conversion.
      var previewSrcdoc =
        htmlFile.size > 50 * 1024 * 1024
          ? rawHtml.slice(0, 512 * 1024)
          : rawHtml;
      loadIframeSrcdocSafely(frameEl, previewSrcdoc, previewSrcdoc);
    }

    const item = {
      id: state.nextImportId++,
      type,
      sourceKind: "file",
      sourceUrl: "",
      displayName,
      file: htmlFile,
      rawHtml,
      preparedHtml: "",
      isFrameReady: false,
      conversionStats: null,
      captureUrl: "",
      totalSize,
      assetBlobs,
      artboardX: 0,
      artboardY: 0,
      targetArtboardX: 0,
      targetArtboardY: 0,
      previewEl,
      frameEl,
    };

    item.previewEl.dataset.importId = String(item.id);
    if (canvasContainer) canvasContainer.appendChild(item.previewEl);

    return item;
  }

  function createDuplicateImportItem(original, duplicateIndex = 0) {
    if (!original) return null;

    const previewEl = createCanvasPreviewElement();
    const frameEl = previewEl.querySelector("iframe");

    const originalWidth =
      original.previewEl?.style.width ||
      `${(viewportWidthInput && parseInt(viewportWidthInput.value, 10)) || 1440}px`;
    const originalHeight =
      original.previewEl?.style.height ||
      `${(viewportHeightInput && parseInt(viewportHeightInput.value, 10)) || 900}px`;
    previewEl.style.width = originalWidth;
    previewEl.style.height = originalHeight;

    if (frameEl) {
      frameEl.style.width = "100%";
      frameEl.style.height = "100%";
      // Defer iframe HTML parsing to the next frame so duplicate feedback
      // appears instantly (especially for Cmd/Ctrl+D and Option-drag copy).
      var dupSrcdoc = (original.rawHtml || "");
      if (dupSrcdoc.length > 50 * 1024 * 1024) dupSrcdoc = dupSrcdoc.slice(0, 512 * 1024);
      scheduleDuplicateFrameHydration(frameEl, dupSrcdoc);
    }

    const offsetStep = 36;
    const offset = offsetStep * (duplicateIndex + 1);

    const duplicatedItem = {
      id: state.nextImportId++,
      type: original.type,
      sourceKind: original.sourceKind || "file",
      sourceUrl: original.sourceUrl || "",
      displayName: `${original.displayName} Copy`,
      file: original.file,
      rawHtml: original.rawHtml,
      preparedHtml: "",
      isFrameReady: false,
      conversionStats: null,
      captureUrl: "",
      totalSize: original.totalSize || 0,
      assetBlobs:
        original.assetBlobs instanceof Map
          ? new Map(original.assetBlobs)
          : new Map(),
      artboardX: (original.artboardX || 0) + offset,
      artboardY: (original.artboardY || 0) + offset,
      targetArtboardX:
        (original.targetArtboardX || original.artboardX || 0) + offset,
      targetArtboardY:
        (original.targetArtboardY || original.artboardY || 0) + offset,
      previewEl,
      frameEl,
    };

    duplicatedItem.previewEl.dataset.importId = String(duplicatedItem.id);
    if (canvasContainer) canvasContainer.appendChild(duplicatedItem.previewEl);

    return duplicatedItem;
  }

  function rectsOverlap(a, b, padding = 0) {
    return !(
      a.right + padding <= b.left ||
      a.left >= b.right + padding ||
      a.bottom + padding <= b.top ||
      a.top >= b.bottom + padding
    );
  }

  function findDuplicatePlacement(
    original,
    duplicateWidth,
    duplicateHeight,
    occupiedBounds = [],
  ) {
    const originalBounds = getItemBounds(original);
    const spacing = Math.max(28, Math.round(IMPORT_ARTBOARD_GAP * 0.55));
    const preferredX = originalBounds.right + spacing;
    const preferredY = originalBounds.top;

    const hasOverlap = (x, y) => {
      const candidate = {
        left: x,
        top: y,
        right: x + duplicateWidth,
        bottom: y + duplicateHeight,
      };
      return occupiedBounds.some((bound) => rectsOverlap(candidate, bound, 0));
    };

    const rowBounds = occupiedBounds
      .filter((bound) => {
        const overlap =
          Math.min(bound.bottom, originalBounds.bottom) -
          Math.max(bound.top, originalBounds.top);
        return (
          overlap >
          Math.max(
            20,
            Math.min(bound.bottom - bound.top, originalBounds.height) * 0.22,
          )
        );
      })
      .sort((a, b) => a.left - b.left);

    let bestGapX = null;
    let bestGapDistance = Infinity;

    for (let idx = 0; idx < rowBounds.length - 1; idx += 1) {
      const leftItem = rowBounds[idx];
      const rightItem = rowBounds[idx + 1];

      const gapStart = leftItem.right + spacing;
      const gapEnd = rightItem.left - spacing;
      const maxX = gapEnd - duplicateWidth;

      if (maxX < gapStart) continue;

      const candidateX = Math.min(Math.max(preferredX, gapStart), maxX);
      const distance = Math.abs(candidateX - preferredX);

      if (distance < bestGapDistance && !hasOverlap(candidateX, preferredY)) {
        bestGapDistance = distance;
        bestGapX = candidateX;
      }
    }

    if (bestGapX != null) {
      return { x: Math.round(bestGapX), y: Math.round(preferredY) };
    }

    let scanX = preferredX;
    for (let step = 0; step < 120; step += 1) {
      if (!hasOverlap(scanX, preferredY)) {
        return { x: Math.round(scanX), y: Math.round(preferredY) };
      }
      scanX += 24;
    }

    const lowerY =
      originalBounds.bottom + Math.max(30, Math.round(spacing * 0.7));
    scanX = originalBounds.left;
    for (let step = 0; step < 120; step += 1) {
      if (!hasOverlap(scanX, lowerY)) {
        return { x: Math.round(scanX), y: Math.round(lowerY) };
      }
      scanX += 24;
    }

    return { x: Math.round(preferredX), y: Math.round(preferredY) };
  }

  async function duplicateSelectedImports() {
    const idsToDuplicate =
      state.selectedImportIds.size > 0
        ? Array.from(state.selectedImportIds)
        : state.activeImportId
          ? [state.activeImportId]
          : [];

    if (idsToDuplicate.length === 0) return;

    const availableSlots = state.maxImports - state.imports.length;
    if (availableSlots <= 0) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      return;
    }

    const duplicateIds = idsToDuplicate.slice(0, availableSlots);
    if (duplicateIds.length < idsToDuplicate.length) {
      showToast(
        "Limit reached",
        "Only some selected artboards were duplicated (max 5 total)",
        "warning",
      );
    }

    const originals = duplicateIds
      .map((id) => state.imports.find((item) => item.id === id))
      .filter(Boolean)
      .sort((a, b) => (a.artboardX || 0) - (b.artboardX || 0));

    const occupiedBounds = state.imports.map(getItemBounds);
    const duplicates = [];
    originals.forEach((original, idx) => {
      const duplicated = createDuplicateImportItem(original, idx);
      if (!duplicated) return;

      const { width, height } = getArtboardDimensions(duplicated);
      const placement = findDuplicatePlacement(
        original,
        width,
        height,
        occupiedBounds,
      );
      duplicated.artboardX = placement.x;
      duplicated.artboardY = placement.y;
      duplicated.targetArtboardX = placement.x;
      duplicated.targetArtboardY = placement.y;

      occupiedBounds.push({
        left: placement.x,
        top: placement.y,
        right: placement.x + width,
        bottom: placement.y + height,
      });

      duplicates.push(duplicated);
    });

    if (duplicates.length === 0) return;

    const duplicatedIds = duplicates.map((item) => item.id);
    const activeDuplicateId = duplicatedIds[duplicatedIds.length - 1];
    await appendImportItems(duplicates, {
      preservePlacement: true,
      selectNewItems: true,
      selectedIds: duplicatedIds,
      activeId: activeDuplicateId,
    });

    updateStatus(
      duplicates.length === 1
        ? "Artboard duplicated"
        : `${duplicates.length} artboards duplicated`,
      "success",
    );
  }

  function makeCopyName(name = "Artboard") {
    const base = String(name || "Artboard").trim();
    return /\bcopy\b$/i.test(base) ? `${base} 2` : `${base} Copy`;
  }

  function writeArtboardClipboard(importIds = []) {
    const uniqueIds = Array.from(new Set(importIds.filter(Boolean)));
    const selected = uniqueIds
      .map((id) => state.imports.find((item) => item.id === id))
      .filter(Boolean)
      .sort((a, b) => (a.artboardX || 0) - (b.artboardX || 0));

    if (!selected.length) {
      artboardClipboard.items = [];
      artboardClipboard.pasteCount = 0;
      return 0;
    }

    artboardClipboard.items = selected.map((item) => {
      const { width, height } = getArtboardDimensions(item);
      return {
        type: item.type,
        displayName: item.displayName,
        file: item.file,
        rawHtml: item.rawHtml || "",
        totalSize: item.totalSize || 0,
        assetBlobs:
          item.assetBlobs instanceof Map ? new Map(item.assetBlobs) : new Map(),
        conversionStats: item.conversionStats
          ? {
              frames: Number(item.conversionStats.frames) || 0,
              text: Number(item.conversionStats.text) || 0,
              image: Number(item.conversionStats.image) || 0,
              container: Number(item.conversionStats.container) || 0,
            }
          : null,
        width,
        height,
        x: item.artboardX || 0,
        y: item.artboardY || 0,
      };
    });
    artboardClipboard.pasteCount = 0;
    return artboardClipboard.items.length;
  }

  function createImportItemFromClipboardEntry(entry) {
    if (!entry) return null;

    const previewEl = createCanvasPreviewElement();
    const frameEl = previewEl.querySelector("iframe");

    const width = Math.max(0, Math.round(Number(entry.width) || 1440));
    const height = Math.max(0, Math.round(Number(entry.height) || 900));
    previewEl.style.width = `${width}px`;
    previewEl.style.height = `${height}px`;

    if (frameEl) {
      frameEl.style.width = "100%";
      frameEl.style.height = "100%";
      var clipSrcdoc = entry.rawHtml || "";
      if (clipSrcdoc.length > 50 * 1024 * 1024) clipSrcdoc = clipSrcdoc.slice(0, 512 * 1024);
      loadIframeSrcdocSafely(frameEl, clipSrcdoc, clipSrcdoc);
    }

    const item = {
      id: state.nextImportId++,
      type: entry.type,
      displayName: makeCopyName(entry.displayName),
      file: entry.file,
      rawHtml: entry.rawHtml || "",
      preparedHtml: "",
      isFrameReady: false,
      conversionStats: entry.conversionStats
        ? {
            frames: Number(entry.conversionStats.frames) || 0,
            text: Number(entry.conversionStats.text) || 0,
            image: Number(entry.conversionStats.image) || 0,
            container: Number(entry.conversionStats.container) || 0,
          }
        : null,
      captureUrl: "",
      totalSize: entry.totalSize || 0,
      assetBlobs:
        entry.assetBlobs instanceof Map ? new Map(entry.assetBlobs) : new Map(),
      artboardX: Number(entry.x) || 0,
      artboardY: Number(entry.y) || 0,
      targetArtboardX: Number(entry.x) || 0,
      targetArtboardY: Number(entry.y) || 0,
      previewEl,
      frameEl,
    };

    item.previewEl.dataset.importId = String(item.id);
    if (canvasContainer) canvasContainer.appendChild(item.previewEl);
    return item;
  }

  function createImportItemFromSnapshot(entry) {
    if (!entry || !entry.rawHtml) return null;

    const previewEl = createCanvasPreviewElement();
    const frameEl = previewEl.querySelector("iframe");

    const width = Math.max(0, Math.round(Number(entry.width) || 1440));
    const height = Math.max(0, Math.round(Number(entry.height) || 900));
    previewEl.style.width = `${width}px`;
    previewEl.style.height = `${height}px`;

    if (frameEl) {
      frameEl.style.width = "100%";
      frameEl.style.height = "100%";
      var snapPreview =
        entry.isFrameReady && entry.preparedHtml
          ? entry.preparedHtml
          : entry.rawHtml || "";
      if (snapPreview.length > 50 * 1024 * 1024) snapPreview = snapPreview.slice(0, 512 * 1024);
      var snapFallback = entry.rawHtml || snapPreview;
      if (snapFallback.length > 50 * 1024 * 1024) snapFallback = snapFallback.slice(0, 512 * 1024);
      loadIframeSrcdocSafely(frameEl, snapPreview, snapFallback);
    }

    const item = {
      id: Number(entry.id) || state.nextImportId++,
      type: entry.type || "file",
      displayName: entry.displayName || "Recovered Artboard",
      file: null,
      rawHtml: entry.rawHtml || "",
      preparedHtml: entry.preparedHtml || "",
      isFrameReady: Boolean(entry.isFrameReady),
      conversionStats: entry.conversionStats
        ? {
            frames: Number(entry.conversionStats.frames) || 0,
            text: Number(entry.conversionStats.text) || 0,
            image: Number(entry.conversionStats.image) || 0,
            container: Number(entry.conversionStats.container) || 0,
          }
        : null,
      captureUrl: "",
      totalSize: Number(entry.totalSize) || 0,
      assetBlobs: new Map(),
      artboardX: Number(entry.artboardX) || 0,
      artboardY: Number(entry.artboardY) || 0,
      targetArtboardX:
        Number(entry.targetArtboardX) || Number(entry.artboardX) || 0,
      targetArtboardY:
        Number(entry.targetArtboardY) || Number(entry.artboardY) || 0,
      previewEl,
      frameEl,
    };

    item.previewEl.dataset.importId = String(item.id);
    if (canvasContainer) canvasContainer.appendChild(item.previewEl);
    return item;
  }

  async function pasteArtboardClipboard() {
    if (!artboardClipboard.items.length) {
      showToast("Paste", "Nothing to paste.", "warning");
      updateStatus("Nothing to paste", "warning");
      return;
    }

    const availableSlots = state.maxImports - state.imports.length;
    if (availableSlots <= 0) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      return;
    }

    const entries = artboardClipboard.items.slice(0, availableSlots);
    if (!entries.length) return;

    const existingItems = state.imports.slice();
    const hasExistingItems = existingItems.length > 0;

    const pasteOffset = 36 * (artboardClipboard.pasteCount + 1);
    const incoming = entries
      .map((entry) => {
        const item = createImportItemFromClipboardEntry(entry);
        if (!item) return null;
        item.artboardX = (Number(entry.x) || 0) + pasteOffset;
        item.artboardY = (Number(entry.y) || 0) + pasteOffset;
        item.targetArtboardX = item.artboardX;
        item.targetArtboardY = item.artboardY;
        return item;
      })
      .filter(Boolean);

    if (!incoming.length) return;

    if (hasExistingItems) {
      const existingBounds = existingItems.map(getItemBounds);
      const baselineY = Math.min(...existingBounds.map((b) => b.top));
      let cursorX =
        Math.max(...existingBounds.map((b) => b.right)) + IMPORT_ARTBOARD_GAP;

      incoming.forEach((item) => {
        const { width } = getArtboardDimensions(item);
        item.artboardX = cursorX;
        item.artboardY = baselineY;
        item.targetArtboardX = cursorX;
        item.targetArtboardY = baselineY;
        cursorX += width + IMPORT_ARTBOARD_GAP;
      });
    }

    artboardClipboard.pasteCount += 1;

    const pastedIds = incoming.map((item) => item.id);
    await appendImportItems(incoming, {
      preservePlacement: true,
      selectNewItems: true,
      selectedIds: pastedIds,
      activeId: pastedIds[pastedIds.length - 1],
    });

    showToast(
      "Pasted",
      incoming.length === 1
        ? "Artboard pasted."
        : `${incoming.length} artboards pasted.`,
      "success",
    );
    updateStatus(
      incoming.length === 1
        ? "Artboard pasted"
        : `${incoming.length} artboards pasted`,
      "success",
    );
    schedulePersistWorkspaceState({ showFeedback: true, forceFeedback: true });
  }

  async function restoreWorkspaceStateFromStorage() {
    let snapshot = await idbGetWorkspaceSnapshot();

    if (!snapshot) {
      let snapshotRaw = null;
      try {
        snapshotRaw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      } catch (error) {
        console.warn("Unable to access persisted workspace:", error);
        return false;
      }

      if (!snapshotRaw) return false;

      try {
        snapshot = JSON.parse(snapshotRaw);
      } catch (error) {
        console.warn("Corrupt persisted workspace. Clearing...", error);
        clearPersistedWorkspaceState();
        return false;
      }
    }

    if (!snapshot || typeof snapshot !== "object") {
      clearPersistedWorkspaceState();
      return false;
    }

    const restoredUndoStack = deserializeHistoryStack(snapshot.undoStack);
    const restoredRedoStack = deserializeHistoryStack(snapshot.redoStack);
    const hasRestoredHistory =
      restoredUndoStack.length > 0 || restoredRedoStack.length > 0;

    if (!Array.isArray(snapshot.imports)) {
      snapshot.imports = [];
    }

    restoreClipboardState(snapshot);

    snapshot.imports = snapshot.imports.filter(
      (entry) =>
        entry && typeof entry.rawHtml === "string" && entry.rawHtml.length > 0,
    );
    if (!snapshot.imports.length) {
      if (!hasRestoredHistory) {
        clearPersistedWorkspaceState();
        return false;
      }

      state.undoStack = restoredUndoStack;
      state.redoStack = restoredRedoStack;
      updateStatus("Undo history restored after refresh.", "success");
      return true;
    }

    const incomingItems = snapshot.imports
      .map(createImportItemFromSnapshot)
      .filter(Boolean);

    if (!incomingItems.length) {
      clearPersistedWorkspaceState();
      return false;
    }

    const maxItemId = incomingItems.reduce(
      (max, item) => Math.max(max, Number(item.id) || 0),
      0,
    );
    const persistedNextImportId = Number(snapshot.nextImportId) || 0;
    state.nextImportId = Math.max(
      state.nextImportId,
      persistedNextImportId,
      maxItemId + 1,
    );

    if (typeof snapshot.smartAutoLayout === "boolean") {
      state.smartAutoLayout = snapshot.smartAutoLayout;
      const autoLayoutToggle = document.getElementById("autoLayoutToggle");
      if (autoLayoutToggle) {
        autoLayoutToggle.classList.toggle("on", state.smartAutoLayout);
      }
    }

    const persistedActiveId = Number(snapshot.activeImportId);
    const hasPersistedActive = incomingItems.some(
      (item) => item.id === persistedActiveId,
    );
    const targetActiveId = hasPersistedActive
      ? persistedActiveId
      : incomingItems[incomingItems.length - 1].id;
    const targetSelectedIds = [targetActiveId];

    isRestoringWorkspace = true;
    try {
      await appendImportItems(incomingItems, {
        recordHistory: false,
        preservePlacement: true,
        selectNewItems: true,
        selectedIds: targetSelectedIds,
        activeId: targetActiveId,
      });

      state.undoStack = restoredUndoStack;
      state.redoStack = restoredRedoStack;

      const summarySection = document.getElementById("summarySection");
      if (summarySection) summarySection.classList.remove("hidden");
      syncConversionSummaryForSelection();
      updateUndoRedoButtons();
      updateStatus("Workspace restored after refresh.", "success");
    } finally {
      isRestoringWorkspace = false;
      schedulePersistWorkspaceState({ showFeedback: false });
    }

    return true;
  }

  function duplicateImportsForOptionDrag(sourceIds = []) {
    const idsToDuplicate = Array.from(new Set(sourceIds.filter(Boolean)));
    if (idsToDuplicate.length === 0) return [];

    const availableSlots = state.maxImports - state.imports.length;
    if (availableSlots <= 0) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      return [];
    }

    const duplicateIds = idsToDuplicate.slice(0, availableSlots);
    const originals = duplicateIds
      .map((id) => state.imports.find((item) => item.id === id))
      .filter(Boolean)
      .sort((a, b) => (a.artboardX || 0) - (b.artboardX || 0));

    if (originals.length === 0) return [];

    const prevActiveId = state.activeImportId;
    const prevSelectedIds = Array.from(state.selectedImportIds);
    const startIndex = state.imports.length;

    const duplicates = [];
    originals.forEach((original, idx) => {
      const duplicated = createDuplicateImportItem(original, idx);
      if (!duplicated) return;

      // Option-drag should duplicate in place, then move with cursor.
      duplicated.artboardX = original.artboardX || 0;
      duplicated.artboardY = original.artboardY || 0;
      duplicated.targetArtboardX = duplicated.artboardX;
      duplicated.targetArtboardY = duplicated.artboardY;
      duplicates.push(duplicated);
    });

    if (!duplicates.length) return [];

    state.imports.push(...duplicates);
    updateDropzoneVisibility();

    const duplicatedIds = duplicates.map((item) => item.id);
    const nextActiveId = duplicatedIds[duplicatedIds.length - 1];
    // Defer non-critical UI (sidebar, tree, panel, stats) to the next RAF so the
    // artboard appears instantly under the cursor before any panel work fires.
    setActiveImport(nextActiveId, {
      preserveSelection: true,
      selectedIds: duplicatedIds,
      deferNonCriticalUi: true,
    });

    recordAction({
      type: "add",
      items: duplicates,
      startIndex,
      prevActiveId,
      prevSelectedIds,
      nextActiveId: state.activeImportId,
      nextSelectedIds: Array.from(state.selectedImportIds),
    });

    // Immediately apply transforms so duplicates appear at the correct
    // position on screen (not at the CSS default left:50%;top:50%).
    updateCamera();

    return duplicatedIds;
  }

  function clearImportResources(item) {
    if (!item) return;
    if (item.captureUrl) {
      URL.revokeObjectURL(item.captureUrl);
    }
    if (item.assetBlobs instanceof Map) {
      item.assetBlobs.forEach((url) => URL.revokeObjectURL(url));
      item.assetBlobs.clear();
    }
    if (item.previewEl && item.previewEl.parentNode) {
      item.previewEl.parentNode.removeChild(item.previewEl);
    }
  }

  function detachImportPreview(item) {
    if (!item || !item.previewEl) return;
    if (item.previewEl.parentNode) {
      item.previewEl.parentNode.removeChild(item.previewEl);
    }
  }

  function updateUndoRedoButtons() {
    if (toolbarUndoBtn) {
      const canUndo = state.undoStack.length > 0;
      toolbarUndoBtn.disabled = !canUndo;
      toolbarUndoBtn.setAttribute("aria-disabled", String(!canUndo));
      toolbarUndoBtn.style.opacity = canUndo ? "" : "0.38";
    }
    if (toolbarRedoBtn) {
      const canRedo = state.redoStack.length > 0;
      toolbarRedoBtn.disabled = !canRedo;
      toolbarRedoBtn.setAttribute("aria-disabled", String(!canRedo));
      toolbarRedoBtn.style.opacity = canRedo ? "" : "0.38";
    }
  }

  function recordAction(action) {
    state.undoStack.push(action);
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoButtons();
  }

  function restoreSelectionState(activeId, selectedIds = []) {
    updateDropzoneVisibility();
    renderAttachmentsTree();
    renderStylesAttachmentsTree();

    if (state.imports.length === 0) {
      resetAfterNoImports();
      return;
    }

    const idsInCanvas = new Set(state.imports.map((item) => item.id));
    const validSelected = (selectedIds || []).filter((id) =>
      idsInCanvas.has(id),
    );
    const fallbackActive = idsInCanvas.has(activeId)
      ? activeId
      : validSelected[0] || state.imports[0].id;
    const finalSelected =
      validSelected.length > 0 ? validSelected : [fallbackActive];

    setActiveImport(fallbackActive, {
      preserveSelection: true,
      selectedIds: finalSelected,
    });
  }

  function undoRecentAction() {
    const action = state.undoStack.pop();
    if (!action) {
      updateUndoRedoButtons();
      return false;
    }

    if (action.type === "add") {
      const addedIds = new Set((action.items || []).map((item) => item.id));
      state.imports.forEach((item) => {
        if (addedIds.has(item.id)) detachImportPreview(item);
      });
      state.imports = state.imports.filter((item) => !addedIds.has(item.id));
      restoreSelectionState(action.prevActiveId, action.prevSelectedIds);
    } else if (action.type === "delete") {
      const entries = [...(action.entries || [])].sort(
        (a, b) => a.index - b.index,
      );
      entries.forEach(({ item, index }) => {
        const insertAt = Math.max(0, Math.min(index, state.imports.length));
        state.imports.splice(insertAt, 0, item);
        if (item.previewEl && canvasContainer && !item.previewEl.parentNode) {
          canvasContainer.appendChild(item.previewEl);
        }
      });
      restoreSelectionState(action.prevActiveId, action.prevSelectedIds);
    } else if (action.type === "move") {
      (action.entries || []).forEach(({ id, prevX, prevY }) => {
        const item = state.imports.find((it) => it.id === id);
        if (!item) return;
        item.artboardX = prevX;
        item.artboardY = prevY;
        item.targetArtboardX = prevX;
        item.targetArtboardY = prevY;
      });
      updateCamera();
      const idsInCanvas = new Set(state.imports.map((it) => it.id));
      const validPrevSelected = (action.prevSelectedIds || []).filter((id) =>
        idsInCanvas.has(id),
      );
      if (action.prevActiveId && idsInCanvas.has(action.prevActiveId)) {
        setActiveImport(action.prevActiveId, {
          preserveSelection: true,
          selectedIds: validPrevSelected.length
            ? validPrevSelected
            : [action.prevActiveId],
        });
      }
    } else if (action.type === "resize") {
      (action.entries || []).forEach(
        ({ id, prevX, prevY, prevWidth, prevHeight }) => {
          const item = state.imports.find((it) => it.id === id);
          if (!item) return;
          item.artboardX = prevX;
          item.artboardY = prevY;
          item.targetArtboardX = prevX;
          item.targetArtboardY = prevY;
          applyArtboardDimensions(item, prevWidth, prevHeight, {
            syncInputs: item.id === state.activeImportId,
          });
        },
      );
      updateCamera();
      if (action.prevActiveId) {
        const idsInCanvas = new Set(state.imports.map((it) => it.id));
        const validPrevSelected = (action.prevSelectedIds || []).filter((id) =>
          idsInCanvas.has(id),
        );
        if (idsInCanvas.has(action.prevActiveId)) {
          setActiveImport(action.prevActiveId, {
            preserveSelection: true,
            selectedIds: validPrevSelected.length
              ? validPrevSelected
              : [action.prevActiveId],
          });
        }
      }
    }

    state.redoStack.push(action);
    updateUndoRedoButtons();
    return true;
  }

  function redoRecentAction() {
    const action = state.redoStack.pop();
    if (!action) {
      updateUndoRedoButtons();
      return false;
    }

    if (action.type === "add") {
      const startIndex =
        typeof action.startIndex === "number"
          ? action.startIndex
          : state.imports.length;
      (action.items || []).forEach((item, idx) => {
        const insertAt = Math.max(
          0,
          Math.min(startIndex + idx, state.imports.length),
        );
        state.imports.splice(insertAt, 0, item);
        if (item.previewEl && canvasContainer && !item.previewEl.parentNode) {
          canvasContainer.appendChild(item.previewEl);
        }
      });
      restoreSelectionState(action.nextActiveId, action.nextSelectedIds);
    } else if (action.type === "delete") {
      const idsToRemove = new Set(
        (action.entries || []).map((entry) => entry.item.id),
      );
      state.imports.forEach((item) => {
        if (idsToRemove.has(item.id)) detachImportPreview(item);
      });
      state.imports = state.imports.filter((item) => !idsToRemove.has(item.id));
      restoreSelectionState(action.nextActiveId, action.nextSelectedIds);
    } else if (action.type === "move") {
      (action.entries || []).forEach(({ id, nextX, nextY }) => {
        const item = state.imports.find((it) => it.id === id);
        if (!item) return;
        item.artboardX = nextX;
        item.artboardY = nextY;
        item.targetArtboardX = nextX;
        item.targetArtboardY = nextY;
      });
      updateCamera();
      const idsInCanvas = new Set(state.imports.map((it) => it.id));
      const validNextSelected = (action.nextSelectedIds || []).filter((id) =>
        idsInCanvas.has(id),
      );
      if (action.nextActiveId && idsInCanvas.has(action.nextActiveId)) {
        setActiveImport(action.nextActiveId, {
          preserveSelection: true,
          selectedIds: validNextSelected.length
            ? validNextSelected
            : [action.nextActiveId],
        });
      }
    } else if (action.type === "resize") {
      (action.entries || []).forEach(
        ({ id, nextX, nextY, nextWidth, nextHeight }) => {
          const item = state.imports.find((it) => it.id === id);
          if (!item) return;
          item.artboardX = nextX;
          item.artboardY = nextY;
          item.targetArtboardX = nextX;
          item.targetArtboardY = nextY;
          applyArtboardDimensions(item, nextWidth, nextHeight, {
            syncInputs: item.id === state.activeImportId,
          });
        },
      );
      updateCamera();
      if (action.prevActiveId) {
        const idsInCanvas = new Set(state.imports.map((it) => it.id));
        const validPrevSelected = (action.prevSelectedIds || []).filter((id) =>
          idsInCanvas.has(id),
        );
        if (idsInCanvas.has(action.prevActiveId)) {
          setActiveImport(action.prevActiveId, {
            preserveSelection: true,
            selectedIds: validPrevSelected.length
              ? validPrevSelected
              : [action.prevActiveId],
          });
        }
      }
    }

    state.undoStack.push(action);
    updateUndoRedoButtons();
    return true;
  }

  function resetAfterNoImports() {
    state.activeImportId = null;
    state.selectedImportIds = new Set();
    syncStateFromActiveImport();

    camera.x = 0;
    camera.y = 0;
    camera.scale = INITIAL_SCALE;
    camera.artboardX = 0;
    camera.artboardY = 0;
    camera.targetX = 0;
    camera.targetY = 0;
    camera.targetScale = INITIAL_SCALE;
    camera.targetArtboardX = 0;
    camera.targetArtboardY = 0;
    updateCamera();

    if (fileInput) fileInput.value = "";
    if (folderInput) folderInput.value = "";
    resetConvertButton();
    resetStats();

    const summarySection = document.getElementById("summarySection");
    if (summarySection) summarySection.classList.add("hidden");

    updateLoadedCard(null);
    renderAttachmentsTree();
    renderStylesAttachmentsTree();
    updateStatus("Load an HTML export to begin.");
  }

  function removeImportsByIds(importIds = [], options = {}) {
    const { recordHistory = true, showDeleteToast = true } = options;
    const idsToRemove = new Set(importIds.filter(Boolean));
    if (idsToRemove.size === 0) return;

    const prevActiveId = state.activeImportId;
    const prevSelectedIds = Array.from(state.selectedImportIds);

    const removedImports = state.imports
      .map((item, index) => ({ item, index }))
      .filter((entry) => idsToRemove.has(entry.item.id));

    if (removedImports.length === 0) return;

    removedImports.forEach(({ item }) => detachImportPreview(item));
    state.imports = state.imports.filter((item) => !idsToRemove.has(item.id));
    state.selectedImportIds = new Set(
      Array.from(state.selectedImportIds).filter((id) => !idsToRemove.has(id)),
    );

    updateDropzoneVisibility();
    renderAttachmentsTree();
    renderStylesAttachmentsTree();

    if (state.imports.length > 0) {
      const fallbackIndex = Math.max(0, removedImports[0].index - 1);
      const fallback = state.imports[fallbackIndex] || state.imports[0];
      const selectedIds =
        state.selectedImportIds.size > 0
          ? Array.from(state.selectedImportIds)
          : [fallback.id];
      setActiveImport(fallback.id, { preserveSelection: true, selectedIds });
      updateStatus(
        removedImports.length > 1
          ? `${removedImports.length} items removed`
          : "Item removed",
        "success",
      );
    } else {
      resetAfterNoImports();
    }

    if (recordHistory) {
      recordAction({
        type: "delete",
        entries: removedImports,
        prevActiveId,
        prevSelectedIds,
        nextActiveId: state.activeImportId,
        nextSelectedIds: Array.from(state.selectedImportIds),
      });
    }

    if (showDeleteToast) {
      showToast(
        "Deleted",
        removedImports.length > 1
          ? `${removedImports.length} artboards deleted.`
          : "Artboard deleted.",
        "error",
      );
    }

    // Sync deletion to connected folder (try both folders — one will silently fail)
    if (window.autoDeleteFile) {
      removedImports.forEach(({ item }) => {
        if (item.file && item.file.name) {
          window.autoDeleteFile(item.file.name, "File-convert");
          window.autoDeleteFile(item.file.name, "URL-convert");
        }
      });
    }

    schedulePersistWorkspaceState({ showFeedback: false });
  }

  function getItemBounds(item) {
    const { width, height } = getArtboardDimensions(item);
    const x = item.artboardX || 0;
    const y = item.artboardY || 0;
    return {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      width,
      height,
    };
  }

  function positionIncomingItems(incomingItems, options = {}) {
    const { hadItems = false, existingItems = [] } = options;
    if (!Array.isArray(incomingItems) || incomingItems.length === 0) return;

    if (!hadItems) {
      let cursorX = 0;
      let baselineY = 0;

      incomingItems.forEach((item, idx) => {
        const { width, height } = getArtboardDimensions(item);
        if (idx === 0) {
          const centerX = -Math.round(width / 2);
          const centerY = -Math.round(height / 2);
          item.artboardX = centerX;
          item.artboardY = centerY;
          item.targetArtboardX = centerX;
          item.targetArtboardY = centerY;

          cursorX = centerX + width + IMPORT_ARTBOARD_GAP;
          baselineY = centerY;
          return;
        }

        item.artboardX = cursorX;
        item.artboardY = baselineY;
        item.targetArtboardX = cursorX;
        item.targetArtboardY = baselineY;
        cursorX += width + IMPORT_ARTBOARD_GAP;
      });
      return;
    }

    let rightMost = -Infinity;
    let baselineY = 0;

    if (existingItems.length > 0) {
      const bounds = existingItems.map(getItemBounds);
      rightMost = Math.max(...bounds.map((b) => b.right));
      baselineY = Math.min(...bounds.map((b) => b.top));
    } else {
      rightMost = 0;
      baselineY = 0;
    }

    let cursorX = rightMost + IMPORT_ARTBOARD_GAP;
    incomingItems.forEach((item) => {
      const { width } = getArtboardDimensions(item);
      item.artboardX = cursorX;
      item.artboardY = baselineY;
      item.targetArtboardX = cursorX;
      item.targetArtboardY = baselineY;
      cursorX += width + IMPORT_ARTBOARD_GAP;
    });
  }

  function animateIncomingItems(incomingItems) {
    if (!Array.isArray(incomingItems) || incomingItems.length === 0) return;

    incomingItems.forEach((item) => {
      if (!item?.previewEl) return;
      item.previewEl.classList.add("import-enter");
    });

    requestAnimationFrame(() => {
      incomingItems.forEach((item) => {
        if (!item?.previewEl) return;

        item.previewEl.classList.add("import-enter-active");
      });

      window.setTimeout(() => {
        incomingItems.forEach((item) => {
          if (!item?.previewEl) return;
          item.previewEl.classList.remove("import-enter");
          item.previewEl.classList.remove("import-enter-active");
        });
      }, IMPORT_ENTER_DURATION_MS + 40);
    });
  }

  function revealArtboardInViewport(importItem, options = {}) {
    const { padding = 96 } = options;
    if (!canvasViewport || !importItem?.previewEl) return;

    const viewportRect = canvasViewport.getBoundingClientRect();
    const rect = importItem.previewEl.getBoundingClientRect();

    let deltaX = 0;
    if (rect.right > viewportRect.right - padding) {
      deltaX = viewportRect.right - padding - rect.right;
    } else if (rect.left < viewportRect.left + padding) {
      deltaX = viewportRect.left + padding - rect.left;
    }

    if (Math.abs(deltaX) > 0.5) {
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      camera.targetX += deltaX;
    }
  }

  async function appendImportItems(incomingItems, options = {}) {
    const {
      recordHistory = true,
      preservePlacement = false,
      selectNewItems = false,
      selectedIds = null,
      activeId = null,
    } = options;
    if (!incomingItems.length) return;

    const availableSlots = state.maxImports - state.imports.length;
    if (incomingItems.length > availableSlots) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      incomingItems.forEach(clearImportResources);
      return;
    }

    const hadItems = state.imports.length > 0;
    const previousCount = state.imports.length;
    const prevActiveId = state.activeImportId;
    const prevSelectedIds = Array.from(state.selectedImportIds);
    const existingItems = state.imports.slice();

    if (!preservePlacement) {
      positionIncomingItems(incomingItems, { hadItems, existingItems });
    }

    // Keep all newly added artboards visible immediately.
    // Selection styling (primary/multi) is still applied by setActiveImport/
    // applySelectionClasses, but visibility should never depend on selection.
    incomingItems.forEach((item) => {
      if (!item?.previewEl) return;
      item.previewEl.classList.add("visible");
    });

    state.imports.push(...incomingItems);

    ensureCode2DesignAccordionOpen();
    updateDropzoneVisibility();
    // Tree renders are intentionally deferred: the setActiveImport calls below all
    // use deferNonCriticalUi:true which schedules applyNonCriticalActiveImportUi in
    // a RAF — that function already handles renderAttachmentsTree / syncTree as
    // needed.  This way updateCamera() can run immediately after state is set,
    // letting the browser paint the new artboard before any sidebar work starts.

    if (selectNewItems && incomingItems.length > 0) {
      const selectableIds =
        Array.isArray(selectedIds) && selectedIds.length > 0
          ? selectedIds.filter((id) =>
              state.imports.some((item) => item.id === id),
            )
          : incomingItems.map((item) => item.id);
      const nextActiveId =
        activeId && selectableIds.includes(activeId)
          ? activeId
          : selectableIds[selectableIds.length - 1];
      setActiveImport(nextActiveId, {
        preserveSelection: true,
        selectedIds: selectableIds,
        deferNonCriticalUi: true,
      });
    } else if (!hadItems && incomingItems.length > 0) {
      setActiveImport(incomingItems[0].id, { deferNonCriticalUi: true });
    } else if (incomingItems.length > 0 && state.activeImportId == null) {
      setActiveImport(incomingItems[0].id, { deferNonCriticalUi: true });
    } else {
      // No setActiveImport called here: manually defer tree update so artboard
      // labels and sidebar reflect the new import in the next frame.
      applySelectionClasses();
      requestAnimationFrame(() => {
        renderAttachmentsTree();
        renderStylesAttachmentsTree();
      });
    }

    // Apply latest placement transforms before computing viewport focus/reveal.
    updateCamera();

    if (!hadItems && incomingItems.length > 0) {
      focusArtboardInCanvas(incomingItems[0], { instant: true });
    } else if (incomingItems.length > 0) {
      revealArtboardInViewport(incomingItems[incomingItems.length - 1]);
    }

    animateIncomingItems(incomingItems);

    updateConvertButtonForActive();
    updateStatus("File loaded", "success");

    if (recordHistory) {
      recordAction({
        type: "add",
        items: incomingItems,
        startIndex: previousCount,
        prevActiveId,
        prevSelectedIds,
        nextActiveId: state.activeImportId,
        nextSelectedIds: Array.from(state.selectedImportIds),
      });
    }

    schedulePersistWorkspaceState();
  }

  function updateCamera() {
    const main = canvasViewport;
    // translate3d forces GPU compositing layer — eliminates flicker/lag during zoom
    const nextTransform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`;
    const didCameraTransformChange =
      cameraRenderCache.containerTransform !== nextTransform;
    if (didCameraTransformChange) {
      cameraRenderCache.containerTransform = nextTransform;
      if (canvasContainer) {
        canvasContainer.style.transform = nextTransform;
      }
    }

    // Sync each artboard at its own position
    const aliveImportIds = new Set();
    state.imports.forEach((item) => {
      if (!item.previewEl) return;
      aliveImportIds.add(item.id);
      const nextItemTransform = `translate(${item.artboardX || 0}px, ${item.artboardY || 0}px)`;
      if (cameraRenderCache.itemTransforms.get(item.id) !== nextItemTransform) {
        cameraRenderCache.itemTransforms.set(item.id, nextItemTransform);
        item.previewEl.style.transform = nextItemTransform;
      }
    });
    cameraRenderCache.itemTransforms.forEach((_, id) => {
      if (!aliveImportIds.has(id)) {
        cameraRenderCache.itemTransforms.delete(id);
      }
    });
    scheduleGroupSelectionBoxUpdate();

    // Sync Infinite Grid / inverse-scale only when camera transform actually changes.
    if (main && didCameraTransformChange) {
      // Figma-like adaptive dot grid that stays readable at any zoom
      const baseGridPx = 24;
      const zoomRatio = camera.scale / INITIAL_SCALE; // 1.0 at default view

      // Below default zoom: dots stay a minimum screen-size so they remain visible.
      // Above default: dots grow proportionally, but we tier the multiplier so the
      // pattern doesn't become enormous at very high zoom.
      let gridScaleFactor;
      if (zoomRatio < 1) {
        // Slowly shrink, but floor at 0.55× so dots never vanish
        gridScaleFactor = Math.max(0.55, 0.72 * Math.sqrt(zoomRatio));
      } else if (zoomRatio <= 3) {
        // Gentle growth
        gridScaleFactor = 0.72 + 0.38 * (zoomRatio - 1);
      } else {
        // Flatten curve for very high zoom
        gridScaleFactor = 0.72 + 0.38 * 2 + Math.log2(zoomRatio / 3) * 0.5;
      }

      const gridSize = baseGridPx * INITIAL_SCALE * gridScaleFactor;
      const offsetX = (window.innerWidth / 2 + camera.x) % gridSize;
      const offsetY = (window.innerHeight / 2 - 48 / 2 + camera.y) % gridSize;

      // Quantize grid values to reduce per-frame CSS churn during animated pan.
      // This keeps visuals stable while lowering style recalculation/paint pressure.
      const gridSizeQ = Math.round(gridSize * 100) / 100;
      const offsetXQ = Math.round(offsetX);
      const offsetYQ = Math.round(offsetY);

      // Always visible grid: never fade out at any zoom level.
      const gridOpacity = 0.72;

      const nextGridCellSize = `${gridSizeQ}px`;
      const nextGridOffsetX = `${offsetXQ}px`;
      const nextGridOffsetY = `${offsetYQ}px`;
      const nextGridOpacity = String(gridOpacity);

      if (cameraRenderCache.gridCellSize !== nextGridCellSize) {
        cameraRenderCache.gridCellSize = nextGridCellSize;
        main.style.setProperty("--grid-cell-size", nextGridCellSize);
      }
      if (cameraRenderCache.gridOffsetX !== nextGridOffsetX) {
        cameraRenderCache.gridOffsetX = nextGridOffsetX;
        main.style.setProperty("--grid-offset-x", nextGridOffsetX);
      }
      if (cameraRenderCache.gridOffsetY !== nextGridOffsetY) {
        cameraRenderCache.gridOffsetY = nextGridOffsetY;
        main.style.setProperty("--grid-offset-y", nextGridOffsetY);
      }
      if (cameraRenderCache.gridOpacity !== nextGridOpacity) {
        cameraRenderCache.gridOpacity = nextGridOpacity;
        main.style.setProperty("--grid-opacity", nextGridOpacity);
      }

      // Non-scaling UI: Inversely scale selection elements so they stay fixed size on screen
      const nextInverseScale = String(1 / camera.scale);
      if (cameraRenderCache.inverseScale !== nextInverseScale) {
        cameraRenderCache.inverseScale = nextInverseScale;
        main.style.setProperty("--inverse-scale", nextInverseScale);
      }
    }

    if (
      didCameraTransformChange &&
      zoomInput &&
      document.activeElement !== zoomInput
    ) {
      const displayZoom = Math.round(camera.scale * 100);
      const nextZoomText = `${displayZoom}%`;
      if (cameraRenderCache.zoomText !== nextZoomText) {
        cameraRenderCache.zoomText = nextZoomText;
        zoomInput.textContent = nextZoomText;
      }
    }

    const isGuideDrivenDrag =
      camera?.isDragging &&
      (camera?.dragTarget === "artboard" ||
        camera?.dragTarget === "resize-artboard" ||
        camera?.dragTarget === "resize-group");

    const shouldUpdateSpacingGuides =
      modifierState.isOptionPressed && !isGuideDrivenDrag;

    if (shouldUpdateSpacingGuides) {
      updateOptionSpacingGuides();
    } else if (
      spacingGuides.layer &&
      spacingGuides.layer.childElementCount > 0
    ) {
      hideSpacingGuides();
    }
  }

  function focusArtboardInCanvas(importItem, options = {}) {
    const { instant = false } = options;
    if (!importItem?.previewEl || !canvasViewport) return;

    // Avoid getBoundingClientRect() reads here (layout thrash under rapid Tab presses).
    // Compute target camera directly from world coordinates.
    const dims = getArtboardDimensions(importItem);
    const artboardCenterWorldX = (importItem.artboardX || 0) + dims.width / 2;
    const artboardCenterWorldY = (importItem.artboardY || 0) + dims.height / 2;
    const focusScale = instant ? camera.scale : camera.targetScale;
    const targetX = -artboardCenterWorldX * focusScale;
    const targetY = -artboardCenterWorldY * focusScale;

    const now = performance.now();
    const isRapidFocusCycle =
      now - (camera.lastFocusPanAt || 0) < TAB_FOCUS_RAPID_THRESHOLD_MS;
    camera.lastFocusPanAt = now;

    if (instant) {
      camera.panLerpOverride = null;
      camera.x = targetX;
      camera.y = targetY;
      camera.targetX = targetX;
      camera.targetY = targetY;
      camera.dirty = true;
      updateCamera();
      return;
    }

    // If user is rapidly pressing Tab, "catch up" first so pan doesn't feel behind.
    if (isRapidFocusCycle) {
      camera.x = camera.targetX;
      camera.y = camera.targetY;
    }

    // Adaptive speed for long jumps between far artboards.
    const remainingDx = targetX - camera.x;
    const remainingDy = targetY - camera.y;
    const remainingDist = Math.hypot(remainingDx, remainingDy);
    let adaptiveLerp = TAB_FOCUS_PAN_LERP;
    if (remainingDist > 2600) adaptiveLerp = 0.62;
    else if (remainingDist > 1600) adaptiveLerp = 0.54;
    else if (remainingDist > 900) adaptiveLerp = 0.48;
    if (isRapidFocusCycle) adaptiveLerp = Math.max(adaptiveLerp, 0.62);

    camera.panLerpOverride = adaptiveLerp;
    camera.targetX = targetX;
    camera.targetY = targetY;
    camera.dirty = true;
  }

  // High-Speed Smooth Zoom Loop
  // Uses frame-rate-independent lerp so animation takes the same real time at
  // 30 fps, 60 fps, 120 fps, 144 fps, etc.  Formula:
  //   α_dt = 1 − (1 − α_60fps) ^ (dt / 16.667)
  let _rafPrevTime = 0;
  function render(now = performance.now()) {
    const dt = _rafPrevTime ? Math.min(now - _rafPrevTime, 50) : 16.667;
    _rafPrevTime = now;
    // 16.667 ms = one frame at 60 fps (the reference rate for our lerp constants)
    const FPS_BASE = 16.667;
    const basePanLerp = camera.panLerpOverride ?? PAN_LERP;
    const lerpPosition = 1 - Math.pow(1 - basePanLerp, dt / FPS_BASE);
    const lerpScale = 1 - Math.pow(1 - ZOOM_LERP, dt / FPS_BASE);

    const dx = camera.targetX - camera.x;
    const dy = camera.targetY - camera.y;
    const ds = camera.targetScale - camera.scale;

    // Consume the dirty flag — wheel/pan events batched since last frame
    let needsUpdate = camera.dirty;
    camera.dirty = false;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(ds) > 0.0001) {
      camera.x += dx * lerpPosition;
      camera.y += dy * lerpPosition;
      camera.scale += ds * lerpScale;
      // Snap to exact target when close enough — eliminates the slow asymptotic tail
      if (Math.abs(camera.targetX - camera.x) < 0.12) camera.x = camera.targetX;
      if (Math.abs(camera.targetY - camera.y) < 0.12) camera.y = camera.targetY;
      if (Math.abs(camera.targetScale - camera.scale) < 0.0002)
        camera.scale = camera.targetScale;
      needsUpdate = true;
    }

    if (
      camera.panLerpOverride != null &&
      Math.abs(dx) < 0.6 &&
      Math.abs(dy) < 0.6
    ) {
      camera.panLerpOverride = null;
    }

    state.imports.forEach((item) => {
      const targetX = item.targetArtboardX || 0;
      const targetY = item.targetArtboardY || 0;
      if (item.artboardX !== targetX || item.artboardY !== targetY) {
        // Snap immediately (no smoothing) for Figma-like artboard movement.
        item.artboardX = targetX;
        item.artboardY = targetY;
        needsUpdate = true;
      }
    });

    if (needsUpdate) updateCamera();

    requestAnimationFrame(render);
  }
  render();

  const canvasOverlay = document.getElementById("canvasOverlay");
  const marquee = {
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    moved: false,
    hasHits: false,
    baseSelection: new Set(),
    element: null,
  };
  const groupSelection = {
    element: null,
    toolbar: null,
  };
  const resizeSession = {
    active: false,
    itemId: null,
    handle: "",
    startMouseX: 0,
    startMouseY: 0,
    startWidth: 0,
    startHeight: 0,
    startArtboardX: 0,
    startArtboardY: 0,
    snapXLocked: false,
    snapXLinePx: null,
    snapYLocked: false,
    snapYLinePx: null,
    prevActiveId: null, // for undo/redo
    prevSelectedIds: [], // for undo/redo
  };
  const groupResizeSession = {
    active: false,
    edge: "",
    startMouseY: 0,
    items: [],
    prevActiveId: null, // for undo/redo
    prevSelectedIds: [], // for undo/redo
  };
  // Import ids whose conversion-invalidation bookkeeping (revoke blob URL,
  // reset captureUrl/isFrameReady, persist, re-summarize) was deferred
  // during a live resize drag (see applyArtboardDimensions' `liveOnly`
  // option) and still needs to run once the drag ends.
  let pendingResizeInvalidateIds = null;
  // ── Persistent drag-snap hysteresis state (Figma-like lock/release) ──
  const dragSnapState = {
    xLocked: false, // Currently locked to a vertical guide
    yLocked: false, // Currently locked to a horizontal guide
    xSnapScreenPx: null, // Screen X position of locked vertical guide line
    ySnapScreenPx: null, // Screen Y position of locked horizontal guide line
    xSnapType: null, // 'center' | 'edge' | 'spacing'
    ySnapType: null,
    xWorldOffset: 0, // World-unit correction applied while X-locked
    yWorldOffset: 0, // World-unit correction applied while Y-locked
  };
  function resetDragSnapState() {
    dragSnapState.xLocked = false;
    dragSnapState.yLocked = false;
    dragSnapState.xSnapScreenPx = null;
    dragSnapState.ySnapScreenPx = null;
    dragSnapState.xSnapType = null;
    dragSnapState.ySnapType = null;
    dragSnapState.xWorldOffset = 0;
    dragSnapState.yWorldOffset = 0;
    dragSnapState._xDriftPx = 0;
    dragSnapState._yDriftPx = 0;
  }
  const smartGuides = {
    vertical: null,
    horizontal: null,
  };
  const smartGuideStability = {
    vertical: null,
    horizontal: null,
  };
  const spacingGuides = {
    horizontal: null,
    horizontalLabel: null,
    horizontalSecondary: null,
    horizontalSecondaryLabel: null,
    vertical: null,
    verticalLabel: null,
    verticalSecondary: null,
    verticalSecondaryLabel: null,
    layer: null,
  };
  const cameraRenderCache = {
    containerTransform: "",
    itemTransforms: new Map(),
    gridCellSize: "",
    gridOffsetX: "",
    gridOffsetY: "",
    gridOpacity: "",
    inverseScale: "",
    zoomText: "",
  };
  let lastSpacingGuideRenderAt = 0;
  let lastDragMouseMoveAt = 0;
  let lastCursorMoveAt = 0;
  let cursorMoveRafId = null;
  let pendingCursorClientX = 0;
  let pendingCursorClientY = 0;
  const modifierState = {
    isOptionPressed: false,
  };
  let activeCanvasTool = "pointer";

  const applyCanvasToolUi = (tool) => {
    const isPointer = tool === "pointer";

    if (toolbarPointerToolBtn) {
      toolbarPointerToolBtn.classList.toggle("active", isPointer);
      toolbarPointerToolBtn.setAttribute(
        "aria-pressed",
        isPointer ? "true" : "false",
      );
    }

    if (toolbarHandToolBtn) {
      toolbarHandToolBtn.classList.toggle("active", !isPointer);
      toolbarHandToolBtn.setAttribute(
        "aria-pressed",
        isPointer ? "false" : "true",
      );
    }

    if (canvasViewport) {
      canvasViewport.setAttribute("data-canvas-tool", tool);
    }
  };

  const setActiveCanvasTool = (tool) => {
    const nextTool = tool === "hand" ? "hand" : "pointer";
    activeCanvasTool = nextTool;
    applyCanvasToolUi(nextTool);
  };

  if (toolbarPointerToolBtn) {
    toolbarPointerToolBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveCanvasTool("pointer");
    });
  }

  if (toolbarHandToolBtn) {
    toolbarHandToolBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveCanvasTool("hand");
    });
  }

  applyCanvasToolUi(activeCanvasTool);

  if (canvasViewport) {
    const marqueeElement = document.createElement("div");
    marqueeElement.className = "canvas-marquee";
    canvasViewport.appendChild(marqueeElement);
    marquee.element = marqueeElement;

    const groupSelectionElement = document.createElement("div");
    groupSelectionElement.className = "canvas-group-selection";
    groupSelectionElement.innerHTML = `
            <div class="group-selection-edge t"></div>
            <div class="group-selection-edge b"></div>
            <div class="group-selection-handle tl"></div>
            <div class="group-selection-handle tr"></div>
            <div class="group-selection-handle bl"></div>
            <div class="group-selection-handle br"></div>
            <div class="group-selection-dimension-label">0 × 0</div>
        `;
    canvasViewport.appendChild(groupSelectionElement);
    groupSelection.element = groupSelectionElement;

    const vGuide = document.createElement("div");
    vGuide.className = "canvas-smart-guide vertical";
    canvasViewport.appendChild(vGuide);
    smartGuides.vertical = vGuide;

    const hGuide = document.createElement("div");
    hGuide.className = "canvas-smart-guide horizontal";
    canvasViewport.appendChild(hGuide);
    smartGuides.horizontal = hGuide;

    const hSpacingGuide = document.createElement("div");
    hSpacingGuide.className = "canvas-smart-guide horizontal spacing";
    canvasViewport.appendChild(hSpacingGuide);
    spacingGuides.horizontal = hSpacingGuide;

    const hSpacingLabel = document.createElement("div");
    hSpacingLabel.className = "canvas-smart-guide-distance-label horizontal";
    canvasViewport.appendChild(hSpacingLabel);
    spacingGuides.horizontalLabel = hSpacingLabel;

    const hSpacingGuideSecondary = document.createElement("div");
    hSpacingGuideSecondary.className = "canvas-smart-guide horizontal spacing";
    canvasViewport.appendChild(hSpacingGuideSecondary);
    spacingGuides.horizontalSecondary = hSpacingGuideSecondary;

    const hSpacingLabelSecondary = document.createElement("div");
    hSpacingLabelSecondary.className =
      "canvas-smart-guide-distance-label horizontal";
    canvasViewport.appendChild(hSpacingLabelSecondary);
    spacingGuides.horizontalSecondaryLabel = hSpacingLabelSecondary;

    const vSpacingGuide = document.createElement("div");
    vSpacingGuide.className = "canvas-smart-guide vertical spacing";
    canvasViewport.appendChild(vSpacingGuide);
    spacingGuides.vertical = vSpacingGuide;

    const vSpacingLabel = document.createElement("div");
    vSpacingLabel.className = "canvas-smart-guide-distance-label vertical";
    canvasViewport.appendChild(vSpacingLabel);
    spacingGuides.verticalLabel = vSpacingLabel;

    const vSpacingGuideSecondary = document.createElement("div");
    vSpacingGuideSecondary.className = "canvas-smart-guide vertical spacing";
    canvasViewport.appendChild(vSpacingGuideSecondary);
    spacingGuides.verticalSecondary = vSpacingGuideSecondary;

    const vSpacingLabelSecondary = document.createElement("div");
    vSpacingLabelSecondary.className =
      "canvas-smart-guide-distance-label vertical";
    canvasViewport.appendChild(vSpacingLabelSecondary);
    spacingGuides.verticalSecondaryLabel = vSpacingLabelSecondary;

    const spacingLayer = document.createElement("div");
    spacingLayer.className = "canvas-spacing-guides-layer";
    canvasViewport.appendChild(spacingLayer);
    spacingGuides.layer = spacingLayer;
  }

  function hideSmartGuides() {
    if (smartGuides.vertical) smartGuides.vertical.classList.remove("active");
    if (smartGuides.horizontal)
      smartGuides.horizontal.classList.remove("active");
    smartGuideStability.vertical = null;
    smartGuideStability.horizontal = null;
  }

  function pickStableGuideCandidate(candidates, prevCandidate) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    const sorted = [...candidates].sort(
      (a, b) => a.priority - b.priority || a.abs - b.abs,
    );
    const best = sorted[0];
    if (!prevCandidate) return best;

    // Prefer keeping the same guide line/type when still valid to avoid rapid switching.
    const sticky = sorted.find(
      (candidate) =>
        candidate.snapType === prevCandidate.snapType &&
        Math.abs(candidate.line - prevCandidate.line) <=
          SMART_GUIDE_STICKY_LINE_TOLERANCE_PX,
    );

    if (!sticky) return best;

    // Keep sticky candidate unless best is clearly better beyond hysteresis margin.
    const stickyScore = sticky.priority * 1000 + sticky.abs;
    const bestScore = best.priority * 1000 + best.abs;
    if (bestScore + SMART_GUIDE_SWITCH_HYSTERESIS_PX < stickyScore) {
      return best;
    }
    return sticky;
  }

  function hideSpacingGuides() {
    const hasAnyActive =
      (spacingGuides.horizontal &&
        spacingGuides.horizontal.classList.contains("active")) ||
      (spacingGuides.vertical &&
        spacingGuides.vertical.classList.contains("active")) ||
      (spacingGuides.horizontalLabel &&
        spacingGuides.horizontalLabel.classList.contains("active")) ||
      (spacingGuides.verticalLabel &&
        spacingGuides.verticalLabel.classList.contains("active")) ||
      (spacingGuides.horizontalSecondary &&
        spacingGuides.horizontalSecondary.classList.contains("active")) ||
      (spacingGuides.horizontalSecondaryLabel &&
        spacingGuides.horizontalSecondaryLabel.classList.contains("active")) ||
      (spacingGuides.verticalSecondary &&
        spacingGuides.verticalSecondary.classList.contains("active")) ||
      (spacingGuides.verticalSecondaryLabel &&
        spacingGuides.verticalSecondaryLabel.classList.contains("active")) ||
      (spacingGuides.layer && spacingGuides.layer.childElementCount > 0);

    if (!hasAnyActive) return;

    if (spacingGuides.horizontal)
      spacingGuides.horizontal.classList.remove("active");
    if (spacingGuides.vertical)
      spacingGuides.vertical.classList.remove("active");
    if (spacingGuides.horizontalLabel)
      spacingGuides.horizontalLabel.classList.remove("active");
    if (spacingGuides.verticalLabel)
      spacingGuides.verticalLabel.classList.remove("active");
    if (spacingGuides.horizontalSecondary)
      spacingGuides.horizontalSecondary.classList.remove("active");
    if (spacingGuides.horizontalSecondaryLabel)
      spacingGuides.horizontalSecondaryLabel.classList.remove("active");
    if (spacingGuides.verticalSecondary)
      spacingGuides.verticalSecondary.classList.remove("active");
    if (spacingGuides.verticalSecondaryLabel)
      spacingGuides.verticalSecondaryLabel.classList.remove("active");
    if (spacingGuides.layer && spacingGuides.layer.childElementCount > 0)
      spacingGuides.layer.innerHTML = "";
  }

  function renderStackedSpacingGuides(options = {}) {
    const {
      selectedRects = [],
      otherItems = [],
      viewportRect,
      scale = 1,
      enabled = false,
    } = options;

    if (!spacingGuides.layer) return;
    spacingGuides.layer.innerHTML = "";
    if (!enabled || !viewportRect) return;

    const entries = [];
    selectedRects.forEach((rect) => entries.push({ rect }));
    otherItems.forEach((item) => {
      const rect = getWorldBoundsInScreen(item);
      if (rect) entries.push({ rect });
    });

    if (entries.length < 2) return;

    const minOverlapPx = 20;
    const maxPerAxis = 12;

    const createHorizontalGuide = (x1, x2, y, gap) => {
      const line = document.createElement("div");
      line.className = "canvas-smart-guide horizontal spacing active";
      line.style.left = `${x1 - viewportRect.left}px`;
      line.style.top = `${y - viewportRect.top}px`;
      line.style.width = `${Math.max(1, x2 - x1)}px`;
      spacingGuides.layer.appendChild(line);

      const label = document.createElement("div");
      label.className = "canvas-smart-guide-distance-label horizontal active";
      label.textContent = `${Math.max(0, Math.round(gap / (scale || 1)))}`;
      label.style.left = `${(x1 + x2) / 2 - viewportRect.left}px`;
      label.style.top = `${y - viewportRect.top - 9}px`;
      spacingGuides.layer.appendChild(label);
    };

    const createVerticalGuide = (x, y1, y2, gap) => {
      const line = document.createElement("div");
      line.className = "canvas-smart-guide vertical spacing active";
      line.style.left = `${x - viewportRect.left}px`;
      line.style.top = `${y1 - viewportRect.top}px`;
      line.style.height = `${Math.max(1, y2 - y1)}px`;
      spacingGuides.layer.appendChild(line);

      const label = document.createElement("div");
      label.className = "canvas-smart-guide-distance-label vertical active";
      label.textContent = `${Math.max(0, Math.round(gap / (scale || 1)))}`;
      label.style.left = `${x - viewportRect.left + 10}px`;
      label.style.top = `${(y1 + y2) / 2 - viewportRect.top}px`;
      spacingGuides.layer.appendChild(label);
    };

    const byLeft = [...entries].sort((a, b) => a.rect.left - b.rect.left);
    let horizontalCount = 0;
    for (
      let i = 0;
      i < byLeft.length - 1 && horizontalCount < maxPerAxis;
      i += 1
    ) {
      const current = byLeft[i].rect;
      const next = byLeft[i + 1].rect;
      const overlapTop = Math.max(current.top, next.top);
      const overlapBottom = Math.min(current.bottom, next.bottom);
      const overlap = overlapBottom - overlapTop;
      const gap = next.left - current.right;
      if (overlap < minOverlapPx || gap < 0) continue;

      const y = (overlapTop + overlapBottom) / 2;
      createHorizontalGuide(current.right, next.left, y, gap);
      horizontalCount += 1;
    }

    const byTop = [...entries].sort((a, b) => a.rect.top - b.rect.top);
    let verticalCount = 0;
    for (
      let i = 0;
      i < byTop.length - 1 && verticalCount < maxPerAxis;
      i += 1
    ) {
      const current = byTop[i].rect;
      const next = byTop[i + 1].rect;
      const overlapLeft = Math.max(current.left, next.left);
      const overlapRight = Math.min(current.right, next.right);
      const overlap = overlapRight - overlapLeft;
      const gap = next.top - current.bottom;
      if (overlap < minOverlapPx || gap < 0) continue;

      const x = (overlapLeft + overlapRight) / 2;
      createVerticalGuide(x, current.bottom, next.top, gap);
      verticalCount += 1;
    }
  }

  function updateOptionSpacingGuides(options = {}) {
    const {
      force = false,
      selectedIds: selectedIdsOverride = null,
      equalSpacingGuides = null,
    } = options;

    if (force) {
      const now = performance.now();
      if (now - lastSpacingGuideRenderAt < 16) {
        return;
      }
      lastSpacingGuideRenderAt = now;
    }

    const shouldForceFromDrag =
      camera?.isDragging && camera?.dragTarget === "artboard";

    if (
      !canvasViewport ||
      (!force && !modifierState.isOptionPressed && !shouldForceFromDrag)
    ) {
      hideSpacingGuides();
      return;
    }

    const selectedIds = Array.isArray(selectedIdsOverride)
      ? new Set(selectedIdsOverride)
      : state.selectedImportIds.size > 0
        ? new Set(state.selectedImportIds)
        : state.activeImportId
          ? new Set([state.activeImportId])
          : new Set();

    if (selectedIds.size === 0) {
      hideSpacingGuides();
      return;
    }

    const selectedItems = state.imports.filter(
      (item) =>
        selectedIds.has(item.id) &&
        item.previewEl?.classList.contains("visible"),
    );
    const otherItems = state.imports.filter(
      (item) =>
        !selectedIds.has(item.id) &&
        item.previewEl?.classList.contains("visible"),
    );

    if (selectedItems.length === 0 || otherItems.length === 0) {
      hideSpacingGuides();
      return;
    }

    const viewportRect =
      _cachedViewportRect || canvasViewport.getBoundingClientRect();
    const selectedRects = selectedItems
      .map((item) => getWorldBoundsInScreen(item))
      .filter(Boolean);

    renderStackedSpacingGuides({
      selectedRects,
      otherItems,
      viewportRect,
      scale: camera.scale || 1,
      enabled: !!(force || shouldForceFromDrag),
    });

    const movingBounds = {
      left: Math.min(...selectedRects.map((r) => r.left)),
      top: Math.min(...selectedRects.map((r) => r.top)),
      right: Math.max(...selectedRects.map((r) => r.right)),
      bottom: Math.max(...selectedRects.map((r) => r.bottom)),
    };

    let bestHorizontal = null;
    let bestVertical = null;

    otherItems.forEach((item) => {
      const rect = getWorldBoundsInScreen(item);
      if (!rect) return;

      const verticalOverlapTop = Math.max(movingBounds.top, rect.top);
      const verticalOverlapBottom = Math.min(movingBounds.bottom, rect.bottom);
      if (verticalOverlapBottom > verticalOverlapTop) {
        const y = (verticalOverlapTop + verticalOverlapBottom) / 2;

        if (rect.right <= movingBounds.left) {
          const gap = movingBounds.left - rect.right;
          if (gap >= 0 && (!bestHorizontal || gap < bestHorizontal.gap)) {
            bestHorizontal = { gap, x1: rect.right, x2: movingBounds.left, y };
          }
        }

        if (rect.left >= movingBounds.right) {
          const gap = rect.left - movingBounds.right;
          if (gap >= 0 && (!bestHorizontal || gap < bestHorizontal.gap)) {
            bestHorizontal = { gap, x1: movingBounds.right, x2: rect.left, y };
          }
        }
      }

      const horizontalOverlapLeft = Math.max(movingBounds.left, rect.left);
      const horizontalOverlapRight = Math.min(movingBounds.right, rect.right);
      if (horizontalOverlapRight > horizontalOverlapLeft) {
        const x = (horizontalOverlapLeft + horizontalOverlapRight) / 2;

        if (rect.bottom <= movingBounds.top) {
          const gap = movingBounds.top - rect.bottom;
          if (gap >= 0 && (!bestVertical || gap < bestVertical.gap)) {
            bestVertical = { gap, y1: rect.bottom, y2: movingBounds.top, x };
          }
        }

        if (rect.top >= movingBounds.bottom) {
          const gap = rect.top - movingBounds.bottom;
          if (gap >= 0 && (!bestVertical || gap < bestVertical.gap)) {
            bestVertical = { gap, y1: movingBounds.bottom, y2: rect.top, x };
          }
        }
      }
    });

    const scale = camera.scale || 1;

    if (equalSpacingGuides?.horizontal) {
      const h = equalSpacingGuides.horizontal;
      const gapValue = Math.max(0, Math.round(h.gap / scale));

      if (spacingGuides.horizontal && spacingGuides.horizontalLabel) {
        spacingGuides.horizontal.style.left = `${h.leftStart - viewportRect.left}px`;
        spacingGuides.horizontal.style.top = `${h.y - viewportRect.top}px`;
        spacingGuides.horizontal.style.width = `${Math.max(1, h.leftEnd - h.leftStart)}px`;
        spacingGuides.horizontal.classList.add("active");

        spacingGuides.horizontalLabel.textContent = `${gapValue}`;
        spacingGuides.horizontalLabel.style.left = `${(h.leftStart + h.leftEnd) / 2 - viewportRect.left}px`;
        spacingGuides.horizontalLabel.style.top = `${h.y - viewportRect.top - 9}px`;
        spacingGuides.horizontalLabel.classList.add("active");
      }

      if (
        spacingGuides.horizontalSecondary &&
        spacingGuides.horizontalSecondaryLabel
      ) {
        spacingGuides.horizontalSecondary.style.left = `${h.rightStart - viewportRect.left}px`;
        spacingGuides.horizontalSecondary.style.top = `${h.y - viewportRect.top}px`;
        spacingGuides.horizontalSecondary.style.width = `${Math.max(1, h.rightEnd - h.rightStart)}px`;
        spacingGuides.horizontalSecondary.classList.add("active");

        spacingGuides.horizontalSecondaryLabel.textContent = `${gapValue}`;
        spacingGuides.horizontalSecondaryLabel.style.left = `${(h.rightStart + h.rightEnd) / 2 - viewportRect.left}px`;
        spacingGuides.horizontalSecondaryLabel.style.top = `${h.y - viewportRect.top - 9}px`;
        spacingGuides.horizontalSecondaryLabel.classList.add("active");
      }

      if (spacingGuides.vertical)
        spacingGuides.vertical.classList.remove("active");
      if (spacingGuides.verticalLabel)
        spacingGuides.verticalLabel.classList.remove("active");
      if (spacingGuides.verticalSecondary)
        spacingGuides.verticalSecondary.classList.remove("active");
      if (spacingGuides.verticalSecondaryLabel)
        spacingGuides.verticalSecondaryLabel.classList.remove("active");
      return;
    }

    if (equalSpacingGuides?.vertical) {
      const v = equalSpacingGuides.vertical;
      const gapValue = Math.max(0, Math.round(v.gap / scale));

      if (spacingGuides.vertical && spacingGuides.verticalLabel) {
        spacingGuides.vertical.style.left = `${v.x - viewportRect.left}px`;
        spacingGuides.vertical.style.top = `${v.topStart - viewportRect.top}px`;
        spacingGuides.vertical.style.height = `${Math.max(1, v.topEnd - v.topStart)}px`;
        spacingGuides.vertical.classList.add("active");

        spacingGuides.verticalLabel.textContent = `${gapValue}`;
        spacingGuides.verticalLabel.style.left = `${v.x - viewportRect.left + 10}px`;
        spacingGuides.verticalLabel.style.top = `${(v.topStart + v.topEnd) / 2 - viewportRect.top}px`;
        spacingGuides.verticalLabel.classList.add("active");
      }

      if (
        spacingGuides.verticalSecondary &&
        spacingGuides.verticalSecondaryLabel
      ) {
        spacingGuides.verticalSecondary.style.left = `${v.x - viewportRect.left}px`;
        spacingGuides.verticalSecondary.style.top = `${v.bottomStart - viewportRect.top}px`;
        spacingGuides.verticalSecondary.style.height = `${Math.max(1, v.bottomEnd - v.bottomStart)}px`;
        spacingGuides.verticalSecondary.classList.add("active");

        spacingGuides.verticalSecondaryLabel.textContent = `${gapValue}`;
        spacingGuides.verticalSecondaryLabel.style.left = `${v.x - viewportRect.left + 10}px`;
        spacingGuides.verticalSecondaryLabel.style.top = `${(v.bottomStart + v.bottomEnd) / 2 - viewportRect.top}px`;
        spacingGuides.verticalSecondaryLabel.classList.add("active");
      }

      if (spacingGuides.horizontal)
        spacingGuides.horizontal.classList.remove("active");
      if (spacingGuides.horizontalLabel)
        spacingGuides.horizontalLabel.classList.remove("active");
      if (spacingGuides.horizontalSecondary)
        spacingGuides.horizontalSecondary.classList.remove("active");
      if (spacingGuides.horizontalSecondaryLabel)
        spacingGuides.horizontalSecondaryLabel.classList.remove("active");
      return;
    }

    if (spacingGuides.horizontalSecondary)
      spacingGuides.horizontalSecondary.classList.remove("active");
    if (spacingGuides.horizontalSecondaryLabel)
      spacingGuides.horizontalSecondaryLabel.classList.remove("active");
    if (spacingGuides.verticalSecondary)
      spacingGuides.verticalSecondary.classList.remove("active");
    if (spacingGuides.verticalSecondaryLabel)
      spacingGuides.verticalSecondaryLabel.classList.remove("active");

    if (
      bestHorizontal &&
      spacingGuides.horizontal &&
      spacingGuides.horizontalLabel
    ) {
      const left =
        Math.min(bestHorizontal.x1, bestHorizontal.x2) - viewportRect.left;
      const width = Math.max(
        1,
        Math.abs(bestHorizontal.x2 - bestHorizontal.x1),
      );
      const top = bestHorizontal.y - viewportRect.top;
      const gapValue = Math.max(0, Math.round(bestHorizontal.gap / scale));

      spacingGuides.horizontal.style.left = `${left}px`;
      spacingGuides.horizontal.style.top = `${top}px`;
      spacingGuides.horizontal.style.width = `${width}px`;
      spacingGuides.horizontal.classList.add("active");

      spacingGuides.horizontalLabel.textContent = `${gapValue}`;
      spacingGuides.horizontalLabel.style.left = `${left + width / 2}px`;
      spacingGuides.horizontalLabel.style.top = `${top - 9}px`;
      spacingGuides.horizontalLabel.classList.add("active");
    } else {
      if (spacingGuides.horizontal)
        spacingGuides.horizontal.classList.remove("active");
      if (spacingGuides.horizontalLabel)
        spacingGuides.horizontalLabel.classList.remove("active");
    }

    if (bestVertical && spacingGuides.vertical && spacingGuides.verticalLabel) {
      const top = Math.min(bestVertical.y1, bestVertical.y2) - viewportRect.top;
      const height = Math.max(1, Math.abs(bestVertical.y2 - bestVertical.y1));
      const left = bestVertical.x - viewportRect.left;
      const gapValue = Math.max(0, Math.round(bestVertical.gap / scale));

      spacingGuides.vertical.style.left = `${left}px`;
      spacingGuides.vertical.style.top = `${top}px`;
      spacingGuides.vertical.style.height = `${height}px`;
      spacingGuides.vertical.classList.add("active");

      spacingGuides.verticalLabel.textContent = `${gapValue}`;
      spacingGuides.verticalLabel.style.left = `${left + 10}px`;
      spacingGuides.verticalLabel.style.top = `${top + height / 2}px`;
      spacingGuides.verticalLabel.classList.add("active");
    } else {
      if (spacingGuides.vertical)
        spacingGuides.vertical.classList.remove("active");
      if (spacingGuides.verticalLabel)
        spacingGuides.verticalLabel.classList.remove("active");
    }
  }

  function updateSmartGuides(options = {}) {
    const {
      selectedIds: selectedIdsOverride = null,
      thresholdPx = SMART_GUIDE_SNAP_THRESHOLD_PX,
      xPointMode = "all",
      yPointMode = "all",
      // New: caller can pass pre-computed bounds/items to avoid redundant work
      precomputedMovingBounds = null,
      precomputedNearbyItems = null,
      renderGuides = true, // false = candidates only, no DOM writes
    } = options;
    if (!canvasViewport) {
      if (renderGuides) hideSmartGuides();
      smartGuideStability.vertical = null;
      smartGuideStability.horizontal = null;
      return { snapDxPx: 0, snapDyPx: 0, bestV: null, bestH: null };
    }

    const selectedIds = Array.isArray(selectedIdsOverride)
      ? new Set(selectedIdsOverride)
      : state.selectedImportIds.size > 0
        ? new Set(state.selectedImportIds)
        : state.activeImportId
          ? new Set([state.activeImportId])
          : new Set();

    if (selectedIds.size === 0) {
      if (renderGuides) hideSmartGuides();
      smartGuideStability.vertical = null;
      smartGuideStability.horizontal = null;
      return { snapDxPx: 0, snapDyPx: 0, bestV: null, bestH: null };
    }

    // Use pre-computed moving bounds when available (drag handler computes once)
    let movingBounds = precomputedMovingBounds;
    if (!movingBounds) {
      const selectedItems = state.imports.filter(
        (item) =>
          selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      if (selectedItems.length === 0) {
        if (renderGuides) hideSmartGuides();
        smartGuideStability.vertical = null;
        smartGuideStability.horizontal = null;
        return { snapDxPx: 0, snapDyPx: 0, bestV: null, bestH: null };
      }
      const selectedRects = selectedItems
        .map((item) => getWorldBoundsInScreen(item))
        .filter(Boolean);
      if (selectedRects.length === 0) {
        if (renderGuides) hideSmartGuides();
        smartGuideStability.vertical = null;
        smartGuideStability.horizontal = null;
        return { snapDxPx: 0, snapDyPx: 0, bestV: null, bestH: null };
      }
      movingBounds = {
        left: Math.min(...selectedRects.map((r) => r.left)),
        top: Math.min(...selectedRects.map((r) => r.top)),
        right: Math.max(...selectedRects.map((r) => r.right)),
        bottom: Math.max(...selectedRects.map((r) => r.bottom)),
      };
      movingBounds.centerX = (movingBounds.left + movingBounds.right) / 2;
      movingBounds.centerY = (movingBounds.top + movingBounds.bottom) / 2;
    }

    // Use pre-filtered nearby items when available
    let otherItems = precomputedNearbyItems;
    if (!otherItems) {
      const allOther = state.imports.filter(
        (item) =>
          !selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      otherItems = getNearbyItems(allOther, movingBounds);
    }

    if (otherItems.length === 0) {
      if (renderGuides) hideSmartGuides();
      smartGuideStability.vertical = null;
      smartGuideStability.horizontal = null;
      return { snapDxPx: 0, snapDyPx: 0, bestV: null, bestH: null };
    }

    const vpRect =
      _cachedViewportRect || canvasViewport.getBoundingClientRect();
    const threshold = thresholdPx;
    const thresholdWithHysteresis =
      threshold + SMART_GUIDE_SWITCH_HYSTERESIS_PX;
    let bestV = null; // best vertical guide (X-axis snap)
    let bestH = null; // best horizontal guide (Y-axis snap)
    const verticalCandidates = [];
    const horizontalCandidates = [];
    const prevV = smartGuideStability.vertical;
    const prevH = smartGuideStability.horizontal;

    const movingXPoints =
      xPointMode === "left"
        ? [{ val: movingBounds.left, type: "edge" }]
        : xPointMode === "right"
          ? [{ val: movingBounds.right, type: "edge" }]
          : [
              { val: movingBounds.left, type: "edge" },
              { val: movingBounds.centerX, type: "center" },
              { val: movingBounds.right, type: "edge" },
            ];
    const movingYPoints =
      yPointMode === "top"
        ? [{ val: movingBounds.top, type: "edge" }]
        : yPointMode === "bottom"
          ? [{ val: movingBounds.bottom, type: "edge" }]
          : [
              { val: movingBounds.top, type: "edge" },
              { val: movingBounds.centerY, type: "center" },
              { val: movingBounds.bottom, type: "edge" },
            ];

    otherItems.forEach((item) => {
      const rect = getWorldBoundsInScreen(item);
      if (!rect) return;
      const candidateXs = [
        { val: rect.left, type: "edge" },
        { val: rect.centerX, type: "center" },
        { val: rect.right, type: "edge" },
      ];
      const candidateYs = [
        { val: rect.top, type: "edge" },
        { val: rect.centerY, type: "center" },
        { val: rect.bottom, type: "edge" },
      ];

      movingXPoints.forEach((mPt) => {
        candidateXs.forEach((cPt) => {
          const diff = cPt.val - mPt.val;
          const abs = Math.abs(diff);
          // Type priority: center = 0, edge = 1 (lower is better)
          const snapType =
            mPt.type === "center" && cPt.type === "center" ? "center" : "edge";
          const isNearPrevLine =
            !!prevV &&
            prevV.snapType === snapType &&
            Math.abs(cPt.val - prevV.line) <=
              SMART_GUIDE_STICKY_LINE_TOLERANCE_PX;
          const allowedThreshold = isNearPrevLine
            ? thresholdWithHysteresis
            : threshold;
          if (abs > allowedThreshold) return;
          const priority = snapType === "center" ? 0 : 1;
          const candidate = {
            abs,
            diff,
            line: cPt.val,
            rect,
            snapType,
            priority,
          };
          verticalCandidates.push(candidate);
          if (
            !bestV ||
            priority < bestV.priority ||
            (priority === bestV.priority && abs < bestV.abs)
          ) {
            bestV = candidate;
          }
        });
      });

      movingYPoints.forEach((mPt) => {
        candidateYs.forEach((cPt) => {
          const diff = cPt.val - mPt.val;
          const abs = Math.abs(diff);
          const snapType =
            mPt.type === "center" && cPt.type === "center" ? "center" : "edge";
          const isNearPrevLine =
            !!prevH &&
            prevH.snapType === snapType &&
            Math.abs(cPt.val - prevH.line) <=
              SMART_GUIDE_STICKY_LINE_TOLERANCE_PX;
          const allowedThreshold = isNearPrevLine
            ? thresholdWithHysteresis
            : threshold;
          if (abs > allowedThreshold) return;
          const priority = snapType === "center" ? 0 : 1;
          const candidate = {
            abs,
            diff,
            line: cPt.val,
            rect,
            snapType,
            priority,
          };
          horizontalCandidates.push(candidate);
          if (
            !bestH ||
            priority < bestH.priority ||
            (priority === bestH.priority && abs < bestH.abs)
          ) {
            bestH = candidate;
          }
        });
      });
    });

    bestV = pickStableGuideCandidate(
      verticalCandidates,
      smartGuideStability.vertical,
    );
    bestH = pickStableGuideCandidate(
      horizontalCandidates,
      smartGuideStability.horizontal,
    );

    smartGuideStability.vertical = bestV
      ? {
          line: bestV.line,
          snapType: bestV.snapType,
          priority: bestV.priority,
          abs: bestV.abs,
        }
      : null;
    smartGuideStability.horizontal = bestH
      ? {
          line: bestH.line,
          snapType: bestH.snapType,
          priority: bestH.priority,
          abs: bestH.abs,
        }
      : null;

    if (renderGuides) {
      if (bestV && smartGuides.vertical) {
        const y1 = Math.min(movingBounds.top, bestV.rect.top) - vpRect.top;
        const y2 =
          Math.max(movingBounds.bottom, bestV.rect.bottom) - vpRect.top;
        smartGuides.vertical.style.left = `${bestV.line - vpRect.left}px`;
        smartGuides.vertical.style.top = `${y1}px`;
        smartGuides.vertical.style.height = `${Math.max(1, y2 - y1)}px`;
        smartGuides.vertical.classList.add("active");
      } else if (smartGuides.vertical) {
        smartGuides.vertical.classList.remove("active");
      }

      if (bestH && smartGuides.horizontal) {
        const x1 = Math.min(movingBounds.left, bestH.rect.left) - vpRect.left;
        const x2 = Math.max(movingBounds.right, bestH.rect.right) - vpRect.left;
        smartGuides.horizontal.style.top = `${bestH.line - vpRect.top}px`;
        smartGuides.horizontal.style.left = `${x1}px`;
        smartGuides.horizontal.style.width = `${Math.max(1, x2 - x1)}px`;
        smartGuides.horizontal.classList.add("active");
      } else if (smartGuides.horizontal) {
        smartGuides.horizontal.classList.remove("active");
      }
    }

    return {
      snapDxPx: bestV ? bestV.diff : 0,
      snapDyPx: bestH ? bestH.diff : 0,
      bestV: bestV || null,
      bestH: bestH || null,
    };
  }

  function updateEqualSpacingSnap(options = {}) {
    const {
      selectedIds: selectedIdsOverride = null,
      thresholdPx = SMART_GUIDE_EQUAL_SPACING_THRESHOLD_PX,
      precomputedMovingBounds = null,
      precomputedNearbyItems = null,
    } = options;

    if (!canvasViewport) {
      return { snapDxPx: 0, snapDyPx: 0 };
    }

    const selectedIds = Array.isArray(selectedIdsOverride)
      ? new Set(selectedIdsOverride)
      : state.selectedImportIds.size > 0
        ? new Set(state.selectedImportIds)
        : state.activeImportId
          ? new Set([state.activeImportId])
          : new Set();

    if (selectedIds.size === 0) {
      return { snapDxPx: 0, snapDyPx: 0 };
    }

    let movingBounds = precomputedMovingBounds;
    if (!movingBounds) {
      const selectedItems = state.imports.filter(
        (item) =>
          selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      if (selectedItems.length === 0) return { snapDxPx: 0, snapDyPx: 0 };
      const selectedRects = selectedItems
        .map((item) => getWorldBoundsInScreen(item))
        .filter(Boolean);
      if (selectedRects.length === 0) return { snapDxPx: 0, snapDyPx: 0 };
      movingBounds = {
        left: Math.min(...selectedRects.map((r) => r.left)),
        top: Math.min(...selectedRects.map((r) => r.top)),
        right: Math.max(...selectedRects.map((r) => r.right)),
        bottom: Math.max(...selectedRects.map((r) => r.bottom)),
      };
    }

    let otherItems = precomputedNearbyItems;
    if (!otherItems) {
      const allOther = state.imports.filter(
        (item) =>
          !selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      otherItems = getNearbyItems(allOther, movingBounds);
    }

    if (otherItems.length < 2) {
      return { snapDxPx: 0, snapDyPx: 0 };
    }

    const otherRects = otherItems
      .map((item) => getWorldBoundsInScreen(item))
      .filter(Boolean);

    let bestX = null;
    let bestY = null;

    const minOverlapPx = 20;

    for (let i = 0; i < otherRects.length; i += 1) {
      const leftRect = otherRects[i];
      if (leftRect.right > movingBounds.left) continue;

      for (let j = 0; j < otherRects.length; j += 1) {
        if (i === j) continue;
        const rightRect = otherRects[j];
        if (rightRect.left < movingBounds.right) continue;

        const overlapTop = Math.max(
          leftRect.top,
          movingBounds.top,
          rightRect.top,
        );
        const overlapBottom = Math.min(
          leftRect.bottom,
          movingBounds.bottom,
          rightRect.bottom,
        );
        const overlapY = overlapBottom - overlapTop;
        if (overlapY < minOverlapPx) continue;

        const leftGap = movingBounds.left - leftRect.right;
        const rightGap = rightRect.left - movingBounds.right;
        if (leftGap < 0 || rightGap < 0) continue;

        const dx = (rightGap - leftGap) / 2;
        const abs = Math.abs(dx);
        if (abs > thresholdPx) continue;

        if (!bestX || abs < bestX.abs) {
          const y = (overlapTop + overlapBottom) / 2;
          const targetGap = (leftGap + rightGap) / 2;
          bestX = {
            abs,
            diff: dx,
            guides: {
              leftStart: leftRect.right,
              leftEnd: movingBounds.left + dx,
              rightStart: movingBounds.right + dx,
              rightEnd: rightRect.left,
              y,
              gap: targetGap,
            },
          };
        }
      }
    }

    for (let i = 0; i < otherRects.length; i += 1) {
      const topRect = otherRects[i];
      if (topRect.bottom > movingBounds.top) continue;

      for (let j = 0; j < otherRects.length; j += 1) {
        if (i === j) continue;
        const bottomRect = otherRects[j];
        if (bottomRect.top < movingBounds.bottom) continue;

        const overlapLeft = Math.max(
          topRect.left,
          movingBounds.left,
          bottomRect.left,
        );
        const overlapRight = Math.min(
          topRect.right,
          movingBounds.right,
          bottomRect.right,
        );
        const overlapX = overlapRight - overlapLeft;
        if (overlapX < minOverlapPx) continue;

        const topGap = movingBounds.top - topRect.bottom;
        const bottomGap = bottomRect.top - movingBounds.bottom;
        if (topGap < 0 || bottomGap < 0) continue;

        const dy = (bottomGap - topGap) / 2;
        const abs = Math.abs(dy);
        if (abs > thresholdPx) continue;

        if (!bestY || abs < bestY.abs) {
          const x = (overlapLeft + overlapRight) / 2;
          const targetGap = (topGap + bottomGap) / 2;
          bestY = {
            abs,
            diff: dy,
            guides: {
              x,
              topStart: topRect.bottom,
              topEnd: movingBounds.top + dy,
              bottomStart: movingBounds.bottom + dy,
              bottomEnd: bottomRect.top,
              gap: targetGap,
            },
          };
        }
      }
    }

    return {
      snapDxPx: bestX ? bestX.diff : 0,
      snapDyPx: bestY ? bestY.diff : 0,
      guides: {
        horizontal: bestX ? bestX.guides : null,
        vertical: bestY ? bestY.guides : null,
      },
    };
  }

  function updateGapMatchSnap(options = {}) {
    const {
      selectedIds: selectedIdsOverride = null,
      thresholdPx = SMART_GUIDE_GAP_MATCH_THRESHOLD_PX,
      precomputedMovingBounds = null,
      precomputedNearbyItems = null,
    } = options;

    if (!canvasViewport) return { snapDxPx: 0, snapDyPx: 0 };

    const selectedIds = Array.isArray(selectedIdsOverride)
      ? new Set(selectedIdsOverride)
      : state.selectedImportIds.size > 0
        ? new Set(state.selectedImportIds)
        : state.activeImportId
          ? new Set([state.activeImportId])
          : new Set();

    if (selectedIds.size === 0) return { snapDxPx: 0, snapDyPx: 0 };

    let movingBounds = precomputedMovingBounds;
    if (!movingBounds) {
      const selectedItems = state.imports.filter(
        (item) =>
          selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      if (selectedItems.length === 0) return { snapDxPx: 0, snapDyPx: 0 };
      const selectedRects = selectedItems
        .map((item) => getWorldBoundsInScreen(item))
        .filter(Boolean);
      if (selectedRects.length === 0) return { snapDxPx: 0, snapDyPx: 0 };
      movingBounds = {
        left: Math.min(...selectedRects.map((r) => r.left)),
        top: Math.min(...selectedRects.map((r) => r.top)),
        right: Math.max(...selectedRects.map((r) => r.right)),
        bottom: Math.max(...selectedRects.map((r) => r.bottom)),
      };
    }

    let otherItems = precomputedNearbyItems;
    if (!otherItems) {
      const allOther = state.imports.filter(
        (item) =>
          !selectedIds.has(item.id) &&
          item.previewEl?.classList.contains("visible"),
      );
      otherItems = getNearbyItems(allOther, movingBounds);
    }
    if (otherItems.length === 0) return { snapDxPx: 0, snapDyPx: 0 };

    const otherRects = otherItems
      .map((item) => getWorldBoundsInScreen(item))
      .filter(Boolean);

    const horizontalGapValues = [];
    const verticalGapValues = [];

    for (let i = 0; i < otherRects.length; i += 1) {
      for (let j = i + 1; j < otherRects.length; j += 1) {
        const a = otherRects[i];
        const b = otherRects[j];

        const leftRect = a.left <= b.left ? a : b;
        const rightRect = a.left <= b.left ? b : a;
        const overlapY =
          Math.min(leftRect.bottom, rightRect.bottom) -
          Math.max(leftRect.top, rightRect.top);
        const gapX = rightRect.left - leftRect.right;
        if (gapX >= 0 && overlapY >= SMART_GUIDE_GAP_MATCH_MIN_OVERLAP_PX) {
          horizontalGapValues.push(gapX);
        }

        const topRect = a.top <= b.top ? a : b;
        const bottomRect = a.top <= b.top ? b : a;
        const overlapX =
          Math.min(topRect.right, bottomRect.right) -
          Math.max(topRect.left, bottomRect.left);
        const gapY = bottomRect.top - topRect.bottom;
        if (gapY >= 0 && overlapX >= SMART_GUIDE_GAP_MATCH_MIN_OVERLAP_PX) {
          verticalGapValues.push(gapY);
        }
      }
    }

    let bestDx = null;
    let bestDy = null;

    otherRects.forEach((rect) => {
      const overlapY =
        Math.min(movingBounds.bottom, rect.bottom) -
        Math.max(movingBounds.top, rect.top);
      if (overlapY >= SMART_GUIDE_GAP_MATCH_MIN_OVERLAP_PX) {
        if (rect.right <= movingBounds.left) {
          const currentGap = movingBounds.left - rect.right;
          horizontalGapValues.forEach((targetGap) => {
            const dx = targetGap - currentGap;
            const abs = Math.abs(dx);
            if (abs <= thresholdPx && (!bestDx || abs < bestDx.abs)) {
              bestDx = { abs, diff: dx };
            }
          });
        }

        if (rect.left >= movingBounds.right) {
          const currentGap = rect.left - movingBounds.right;
          horizontalGapValues.forEach((targetGap) => {
            const dx = currentGap - targetGap;
            const abs = Math.abs(dx);
            if (abs <= thresholdPx && (!bestDx || abs < bestDx.abs)) {
              bestDx = { abs, diff: dx };
            }
          });
        }
      }

      const overlapX =
        Math.min(movingBounds.right, rect.right) -
        Math.max(movingBounds.left, rect.left);
      if (overlapX >= SMART_GUIDE_GAP_MATCH_MIN_OVERLAP_PX) {
        if (rect.bottom <= movingBounds.top) {
          const currentGap = movingBounds.top - rect.bottom;
          verticalGapValues.forEach((targetGap) => {
            const dy = targetGap - currentGap;
            const abs = Math.abs(dy);
            if (abs <= thresholdPx && (!bestDy || abs < bestDy.abs)) {
              bestDy = { abs, diff: dy };
            }
          });
        }

        if (rect.top >= movingBounds.bottom) {
          const currentGap = rect.top - movingBounds.bottom;
          verticalGapValues.forEach((targetGap) => {
            const dy = currentGap - targetGap;
            const abs = Math.abs(dy);
            if (abs <= thresholdPx && (!bestDy || abs < bestDy.abs)) {
              bestDy = { abs, diff: dy };
            }
          });
        }
      }
    });

    return {
      snapDxPx: bestDx ? bestDx.diff : 0,
      snapDyPx: bestDy ? bestDy.diff : 0,
    };
  }

  if (canvasViewport) {
    const mainCanvas = document.querySelector("main");

    if (mainCanvas) {
      canvasViewport.addEventListener("mousemove", (e) => {
        pendingCursorClientX = e.clientX;
        pendingCursorClientY = e.clientY;

        const now = performance.now();
        if (now - lastCursorMoveAt < 16) return;
        lastCursorMoveAt = now;

        if (cursorMoveRafId) return;
        cursorMoveRafId = requestAnimationFrame(() => {
          cursorMoveRafId = null;
          const rect = canvasViewport.getBoundingClientRect();
          const x = pendingCursorClientX - rect.left;
          const y = pendingCursorClientY - rect.top;
          mainCanvas.style.setProperty("--cursor-x", `${x}px`);
          mainCanvas.style.setProperty("--cursor-y", `${y}px`);
          mainCanvas.style.setProperty("--cursor-glow-opacity", "1");
        });
      });

      canvasViewport.addEventListener("mouseenter", () => {
        mainCanvas.style.setProperty("--cursor-glow-opacity", "1");
      });

      canvasViewport.addEventListener("mouseleave", () => {
        mainCanvas.style.setProperty("--cursor-glow-opacity", "0");
      });
    }

    const listeners = [canvasViewport, canvasOverlay].filter(Boolean);

    listeners.forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        // Same event can be received by both canvasOverlay and canvasViewport listeners.
        // Guard to avoid double-toggle (select then immediate unselect).
        if (e.__canvasHandled) return;
        e.__canvasHandled = true;

        if (
          e.target.closest(".canvas-toolbar") ||
          e.target.closest(".group-align-toolbar") ||
          e.target.closest("button") ||
          e.target.closest("input") ||
          e.target.closest(".artboard-dimension-label.editing")
        )
          return;
        e.preventDefault();

        // ── Figma: clicking the canvas steals focus from any input/contenteditable
        //    so Cmd+Z / Ctrl+Z fires on the very first keypress, not the second. ──
        const _focusedEl = document.activeElement;
        if (
          _focusedEl &&
          _focusedEl !== document.body &&
          (_focusedEl.tagName === "INPUT" ||
            _focusedEl.tagName === "TEXTAREA" ||
            _focusedEl.isContentEditable)
        ) {
          _focusedEl.blur();
        }

        shouldAutoSaveForCanvasMutation = false;

        // ── Figma: Middle mouse button always pans ───────────────
        if (e.button === 1) {
          hideSmartGuides();
          hideSpacingGuides();
          camera.isDragging = true;
          camera.dragTarget = "canvas";
          canvasViewport.classList.add("dragging");
          camera.lastMouseX = e.clientX;
          camera.lastMouseY = e.clientY;
          return;
        }

        if (activeCanvasTool === "hand") {
          hideSmartGuides();
          hideSpacingGuides();
          camera.isDragging = true;
          camera.dragTarget = "canvas";
          canvasViewport.classList.add("dragging");
          camera.lastMouseX = e.clientX;
          camera.lastMouseY = e.clientY;
          return;
        }

        const groupResizeEdge = e.target.closest(".group-selection-edge");
        if (groupResizeEdge) {
          const selectedItems = state.imports.filter(
            (item) => state.selectedImportIds.has(item.id) && item.previewEl,
          );
          if (selectedItems.length > 1) {
            groupResizeSession.active = true;
            groupResizeSession.edge = groupResizeEdge.classList.contains("t")
              ? "t"
              : "b";
            groupResizeSession.startMouseY = e.clientY;
            groupResizeSession.prevActiveId = state.activeImportId;
            groupResizeSession.prevSelectedIds = Array.from(
              state.selectedImportIds,
            );
            groupResizeSession.items = selectedItems.map((item) => {
              const { width, height } = getArtboardDimensions(item);
              return {
                id: item.id,
                startX: item.artboardX || 0,
                startY: item.artboardY || 0,
                startWidth: width,
                startHeight: height,
              };
            });

            camera.isDragging = true;
            camera.dragTarget = "resize-group";
            canvasViewport.classList.add("resizing");
            canvasViewport.classList.add("dragging");
            camera.lastMouseX = e.clientX;
            camera.lastMouseY = e.clientY;
          }
          return;
        }

        // Determine if we are dragging the artboard or panning the canvas
        const isArtboardClick = !!e.target.closest(".canvas-preview");

        if (isArtboardClick) {
          const clickedPreview = e.target.closest(".canvas-preview");
          const resizeHandle = e.target.closest(
            ".selection-handle, .selection-edge",
          );
          if (clickedPreview?.dataset.importId) {
            const clickedId = Number(clickedPreview.dataset.importId);
            const isMultiToggleKey = e.shiftKey || e.metaKey || e.ctrlKey;
            const isOptionDuplicate = e.altKey && !resizeHandle;

            if (isOptionDuplicate) {
              const sourceSelection = state.selectedImportIds.has(clickedId)
                ? Array.from(state.selectedImportIds)
                : [clickedId];
              const duplicatedIds =
                duplicateImportsForOptionDrag(sourceSelection);
              if (duplicatedIds.length > 0) {
                camera.optionDuplicateDrag = true;
                camera.optionDragCumulDist = 0;
                canvasViewport.classList.add("option-duplicate-drag");
              } else {
                // Duplication failed (e.g. max imports reached).
                // Fall back to normal artboard selection + drag (move, no copy).
                camera.optionDuplicateDrag = false;
                if (!state.selectedImportIds.has(clickedId)) {
                  setActiveImport(clickedId, { deferNonCriticalUi: true });
                }
              }
            } else if (isMultiToggleKey) {
              camera.optionDuplicateDrag = false;
              const next = new Set(state.selectedImportIds);
              if (next.has(clickedId) && next.size > 1) {
                next.delete(clickedId);
              } else {
                next.add(clickedId);
              }
              setActiveImport(clickedId, {
                preserveSelection: true,
                selectedIds: Array.from(next),
                deferNonCriticalUi: true,
              });
            } else if (
              state.selectedImportIds.has(clickedId) &&
              state.selectedImportIds.size > 1
            ) {
              camera.optionDuplicateDrag = false;
              // Keep multi-selection when dragging an already-selected artboard.
              setActiveImport(clickedId, {
                preserveSelection: true,
                deferNonCriticalUi: true,
              });
            } else {
              camera.optionDuplicateDrag = false;
              setActiveImport(clickedId, { deferNonCriticalUi: true });
            }

            if (
              resizeHandle &&
              clickedPreview.classList.contains("primary-selected")
            ) {
              const item = state.imports.find(
                (entry) => entry.id === clickedId,
              );
              const { width, height } = getArtboardDimensions(item);
              resizeSession.active = true;
              resizeSession.itemId = clickedId;
              resizeSession.handle = resizeHandle.classList.contains("tl")
                ? "tl"
                : resizeHandle.classList.contains("tr")
                  ? "tr"
                  : resizeHandle.classList.contains("bl")
                    ? "bl"
                    : resizeHandle.classList.contains("br")
                      ? "br"
                      : resizeHandle.classList.contains("t")
                        ? "t"
                        : resizeHandle.classList.contains("r")
                          ? "r"
                          : resizeHandle.classList.contains("b")
                            ? "b"
                            : "l";
              resizeSession.startMouseX = e.clientX;
              resizeSession.startMouseY = e.clientY;
              resizeSession.startWidth = width;
              resizeSession.startHeight = height;
              resizeSession.startArtboardX = item?.artboardX || 0;
              resizeSession.startArtboardY = item?.artboardY || 0;
              resizeSession.snapXLocked = false;
              resizeSession.snapXLinePx = null;
              resizeSession.snapYLocked = false;
              resizeSession.snapYLinePx = null;
              resizeSession.prevActiveId = state.activeImportId;
              resizeSession.prevSelectedIds = Array.from(
                state.selectedImportIds,
              );

              camera.isDragging = true;
              camera.dragTarget = "resize-artboard";
              canvasViewport.classList.add("resizing");
              canvasViewport.classList.add("dragging");
              camera.lastMouseX = e.clientX;
              camera.lastMouseY = e.clientY;
              return;
            }

            // Capture pre-drag positions for "move" undo action.
            camera.dragStartActiveId = state.activeImportId;
            camera.dragStartSelectedIds = Array.from(state.selectedImportIds);
            camera.dragStartPositions = new Map();
            const dragIds =
              state.selectedImportIds.size > 0
                ? Array.from(state.selectedImportIds)
                : state.activeImportId
                  ? [state.activeImportId]
                  : [];
            dragIds.forEach((id) => {
              const it = state.imports.find((entry) => entry.id === id);
              if (it)
                camera.dragStartPositions.set(id, {
                  x: it.artboardX || 0,
                  y: it.artboardY || 0,
                });
            });

            camera.isDragging = true;
            camera.dragTarget = "artboard";
            resetDragSnapState(); // Fresh hysteresis state for new drag
          }
          // If clickedPreview has no importId (initial HTML element), fall
          // through to the marquee/empty-canvas path below.
          if (!camera.isDragging) {
            // Drag on empty canvas: marquee multi-select like Figma.
            marquee.isSelecting = true;
            marquee.startX = e.clientX;
            marquee.startY = e.clientY;
            marquee.currentX = e.clientX;
            marquee.currentY = e.clientY;
            marquee.moved = false;
            marquee.hasHits = false;
            marquee.baseSelection =
              e.shiftKey || e.metaKey || e.ctrlKey
                ? new Set(state.selectedImportIds)
                : new Set();
            if (marquee.element) {
              marquee.element.classList.add("active");
              marquee.element.style.left = `${e.clientX}px`;
              marquee.element.style.top = `${e.clientY}px`;
              marquee.element.style.width = "0px";
              marquee.element.style.height = "0px";
            }

            camera.isDragging = false;
            camera.dragTarget = null;
          }
        } else {
          // Drag on empty canvas: marquee multi-select like Figma.
          marquee.isSelecting = true;
          marquee.startX = e.clientX;
          marquee.startY = e.clientY;
          marquee.currentX = e.clientX;
          marquee.currentY = e.clientY;
          marquee.moved = false;
          marquee.hasHits = false;
          marquee.baseSelection =
            e.shiftKey || e.metaKey || e.ctrlKey
              ? new Set(state.selectedImportIds)
              : new Set();
          if (marquee.element) {
            marquee.element.classList.add("active");
            marquee.element.style.left = `${e.clientX}px`;
            marquee.element.style.top = `${e.clientY}px`;
            marquee.element.style.width = "0px";
            marquee.element.style.height = "0px";
          }

          camera.isDragging = false;
          camera.dragTarget = null;
        }

        canvasViewport.classList.add("dragging");
        camera.lastMouseX = e.clientX;
        camera.lastMouseY = e.clientY;
      });
    });

    window.addEventListener("mousemove", (e) => {
      if (marquee.isSelecting || camera.isDragging) {
        const now = performance.now();
        const minIntervalMs = marquee.isSelecting
          ? 8
          : camera.dragTarget === "canvas"
            ? 4
            : camera.dragTarget === "artboard" ||
                camera.dragTarget === "resize-artboard" ||
                camera.dragTarget === "resize-group"
              ? 8
              : 0;
        if (now - lastDragMouseMoveAt < minIntervalMs) {
          return;
        }
        lastDragMouseMoveAt = now;
      }

      if (marquee.isSelecting) {
        hideSmartGuides();
        hideSpacingGuides();
        marquee.currentX = e.clientX;
        marquee.currentY = e.clientY;

        _cachedViewportRect = canvasViewport
          ? canvasViewport.getBoundingClientRect()
          : null;

        const left = Math.min(marquee.startX, marquee.currentX);
        const top = Math.min(marquee.startY, marquee.currentY);
        const width = Math.abs(marquee.currentX - marquee.startX);
        const height = Math.abs(marquee.currentY - marquee.startY);
        marquee.moved = width > 2 || height > 2;

        if (marquee.element) {
          marquee.element.style.left = `${left}px`;
          marquee.element.style.top = `${top}px`;
          marquee.element.style.width = `${width}px`;
          marquee.element.style.height = `${height}px`;
        }

        const hits = [];
        const selectionRect = {
          left,
          top,
          right: left + width,
          bottom: top + height,
        };
        state.imports.forEach((item) => {
          if (!item.previewEl) return;
          const rect = getWorldBoundsInScreen(item);
          if (!rect) return;
          const intersects =
            rect.right >= selectionRect.left &&
            rect.left <= selectionRect.right &&
            rect.bottom >= selectionRect.top &&
            rect.top <= selectionRect.bottom;
          if (intersects) hits.push(item.id);
        });

        _cachedViewportRect = null;

        const nextSelection = new Set(marquee.baseSelection);
        hits.forEach((id) => nextSelection.add(id));
        marquee.hasHits = hits.length > 0;
        if (nextSelection.size > 0) {
          const activeId = nextSelection.has(state.activeImportId)
            ? state.activeImportId
            : hits[0] || Array.from(nextSelection)[0];

          const nextSelectedIds = Array.from(nextSelection);
          const hasSameSelection =
            nextSelection.size === state.selectedImportIds.size &&
            nextSelectedIds.every((id) => state.selectedImportIds.has(id));
          const shouldUpdateSelectionState =
            state.activeImportId !== activeId || !hasSameSelection;

          if (shouldUpdateSelectionState) {
            setActiveImport(activeId, {
              preserveSelection: true,
              selectedIds: nextSelectedIds,
              deferNonCriticalUi: true,
            });
          }
        }
        return;
      }

      if (!camera.isDragging) return;

      if (camera.dragTarget === "resize-group" && groupResizeSession.active) {
        hideSmartGuides();
        hideSpacingGuides();

        const dyWorld =
          ((e.clientY - groupResizeSession.startMouseY) / (camera.scale || 1)) *
          ARTBOARD_RESIZE_SPEED;
        if (Math.abs(dyWorld) > 0.01) {
          shouldAutoSaveForCanvasMutation = true;
        }
        const isTopEdge = groupResizeSession.edge === "t";

        groupResizeSession.items.forEach((entry) => {
          const item = state.imports.find((it) => it.id === entry.id);
          if (!item) return;

          const newHeight = Math.max(
            0,
            Math.round(
              isTopEdge
                ? entry.startHeight - dyWorld
                : entry.startHeight + dyWorld,
            ),
          );
          const nextY = isTopEdge
            ? entry.startY + (entry.startHeight - newHeight)
            : entry.startY;

          item.artboardX = entry.startX;
          item.artboardY = nextY;
          item.targetArtboardX = item.artboardX;
          item.targetArtboardY = item.artboardY;
          applyArtboardDimensions(item, entry.startWidth, newHeight, {
            syncInputs: item.id === state.activeImportId,
            liveOnly: true,
          });
        });

        updateCamera();
        camera.lastMouseX = e.clientX;
        camera.lastMouseY = e.clientY;
        return;
      }

      if (camera.dragTarget === "resize-artboard" && resizeSession.active) {
        const item = state.imports.find(
          (entry) => entry.id === resizeSession.itemId,
        );
        if (!item) return;

        const dxWorld =
          ((e.clientX - resizeSession.startMouseX) / (camera.scale || 1)) *
          ARTBOARD_RESIZE_SPEED;
        const dyWorld =
          ((e.clientY - resizeSession.startMouseY) / (camera.scale || 1)) *
          ARTBOARD_RESIZE_SPEED;
        if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
          shouldAutoSaveForCanvasMutation = true;
        }

        const affectsWidth = ["tl", "tr", "bl", "br", "l", "r"].includes(
          resizeSession.handle,
        );
        const affectsHeight = ["tl", "tr", "bl", "br", "t", "b"].includes(
          resizeSession.handle,
        );
        const isLeft = ["tl", "bl", "l"].includes(resizeSession.handle);
        const isTop = ["tl", "tr", "t"].includes(resizeSession.handle);

        const widthSign = isLeft ? -1 : 1;
        const heightSign = isTop ? -1 : 1;

        const widthRaw =
          resizeSession.startWidth + (affectsWidth ? dxWorld * widthSign : 0);
        const heightRaw =
          resizeSession.startHeight +
          (affectsHeight ? dyWorld * heightSign : 0);

        const newWidth = Math.max(0, Math.round(widthRaw));
        const newHeight = Math.max(0, Math.round(heightRaw));

        const widthDelta = resizeSession.startWidth - newWidth;
        const heightDelta = resizeSession.startHeight - newHeight;

        item.artboardX =
          affectsWidth && isLeft
            ? resizeSession.startArtboardX + widthDelta
            : resizeSession.startArtboardX;
        item.artboardY =
          affectsHeight && isTop
            ? resizeSession.startArtboardY + heightDelta
            : resizeSession.startArtboardY;
        item.targetArtboardX = item.artboardX;
        item.targetArtboardY = item.artboardY;

        applyArtboardDimensions(item, newWidth, newHeight, {
          syncInputs: true,
          liveOnly: true,
        });
        updateCamera();

        if (affectsWidth || affectsHeight) {
          const selectedIds = [item.id];
          const resizeXPointMode = affectsWidth
            ? isLeft
              ? "left"
              : "right"
            : "all";
          const resizeYPointMode = affectsHeight
            ? isTop
              ? "top"
              : "bottom"
            : "all";
          const dynamicThresholdX = affectsWidth
            ? resizeSession.snapXLocked
              ? SMART_GUIDE_RESIZE_SNAP_RELEASE_PX
              : SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX
            : 0;
          const dynamicThresholdY = affectsHeight
            ? resizeSession.snapYLocked
              ? SMART_GUIDE_RESIZE_SNAP_RELEASE_PX
              : SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX
            : 0;
          const dynamicThreshold = Math.max(
            dynamicThresholdX,
            dynamicThresholdY,
            SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX,
          );

          const precomputedMovingBounds = getWorldBoundsInScreen(item);
          const allOtherItems = state.imports.filter(
            (entry) =>
              entry.id !== item.id &&
              entry.previewEl?.classList.contains("visible"),
          );
          const precomputedNearbyItems = precomputedMovingBounds
            ? getNearbyItems(allOtherItems, precomputedMovingBounds)
            : [];

          const { snapDxPx, snapDyPx } = updateSmartGuides({
            selectedIds,
            thresholdPx: dynamicThreshold,
            xPointMode: resizeXPointMode,
            yPointMode: resizeYPointMode,
            precomputedMovingBounds,
            precomputedNearbyItems,
          });

          // Also detect spacing/gap matches while resizing so between-artboard guides
          // (e.g. artboard 2 ↔ 3) are detected consistently.
          const spacingResult = updateEqualSpacingSnap({
            selectedIds,
            precomputedMovingBounds,
            precomputedNearbyItems,
          });
          const gapResult = updateGapMatchSnap({
            selectedIds,
            precomputedMovingBounds,
            precomputedNearbyItems,
          });

          const xCandidates = [];
          const yCandidates = [];
          if (affectsWidth && snapDxPx)
            xCandidates.push({
              diff: snapDxPx,
              abs: Math.abs(snapDxPx),
              priority: 1,
            });
          if (affectsHeight && snapDyPx)
            yCandidates.push({
              diff: snapDyPx,
              abs: Math.abs(snapDyPx),
              priority: 1,
            });
          if (affectsWidth && spacingResult.snapDxPx)
            xCandidates.push({
              diff: spacingResult.snapDxPx,
              abs: Math.abs(spacingResult.snapDxPx),
              priority: 2,
            });
          if (affectsHeight && spacingResult.snapDyPx)
            yCandidates.push({
              diff: spacingResult.snapDyPx,
              abs: Math.abs(spacingResult.snapDyPx),
              priority: 2,
            });
          if (affectsWidth && gapResult.snapDxPx)
            xCandidates.push({
              diff: gapResult.snapDxPx,
              abs: Math.abs(gapResult.snapDxPx),
              priority: 2,
            });
          if (affectsHeight && gapResult.snapDyPx)
            yCandidates.push({
              diff: gapResult.snapDyPx,
              abs: Math.abs(gapResult.snapDyPx),
              priority: 2,
            });
          xCandidates.sort((a, b) => a.priority - b.priority || a.abs - b.abs);
          yCandidates.sort((a, b) => a.priority - b.priority || a.abs - b.abs);

          let effectiveSnapDxPx = affectsWidth ? xCandidates[0]?.diff || 0 : 0;
          let effectiveSnapDyPx = affectsHeight ? yCandidates[0]?.diff || 0 : 0;

          const itemScreenRect = getWorldBoundsInScreen(item);
          const activeEdgeX =
            affectsWidth && itemScreenRect
              ? isLeft
                ? itemScreenRect.left
                : itemScreenRect.right
              : null;
          const activeEdgeY =
            affectsHeight && itemScreenRect
              ? isTop
                ? itemScreenRect.top
                : itemScreenRect.bottom
              : null;

          if (
            affectsWidth &&
            resizeSession.snapXLocked &&
            activeEdgeX != null &&
            Number.isFinite(resizeSession.snapXLinePx)
          ) {
            const lockedDiffX = resizeSession.snapXLinePx - activeEdgeX;
            if (Math.abs(lockedDiffX) <= SMART_GUIDE_RESIZE_SNAP_RELEASE_PX) {
              effectiveSnapDxPx = lockedDiffX;
            } else {
              resizeSession.snapXLocked = false;
              resizeSession.snapXLinePx = null;
            }
          }

          if (
            affectsHeight &&
            resizeSession.snapYLocked &&
            activeEdgeY != null &&
            Number.isFinite(resizeSession.snapYLinePx)
          ) {
            const lockedDiffY = resizeSession.snapYLinePx - activeEdgeY;
            if (Math.abs(lockedDiffY) <= SMART_GUIDE_RESIZE_SNAP_RELEASE_PX) {
              effectiveSnapDyPx = lockedDiffY;
            } else {
              resizeSession.snapYLocked = false;
              resizeSession.snapYLinePx = null;
            }
          }

          if (
            affectsWidth &&
            !resizeSession.snapXLocked &&
            effectiveSnapDxPx &&
            activeEdgeX != null
          ) {
            if (
              Math.abs(effectiveSnapDxPx) <=
              SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX
            ) {
              resizeSession.snapXLocked = true;
              resizeSession.snapXLinePx = activeEdgeX + effectiveSnapDxPx;
            }
          }

          if (
            affectsHeight &&
            !resizeSession.snapYLocked &&
            effectiveSnapDyPx &&
            activeEdgeY != null
          ) {
            if (
              Math.abs(effectiveSnapDyPx) <=
              SMART_GUIDE_RESIZE_SNAP_THRESHOLD_PX
            ) {
              resizeSession.snapYLocked = true;
              resizeSession.snapYLinePx = activeEdgeY + effectiveSnapDyPx;
            }
          }

          let snappedWidth = newWidth;
          let snappedHeight = newHeight;

          if (affectsWidth && effectiveSnapDxPx) {
            const isHardLockX =
              resizeSession.snapXLocked ||
              Math.abs(effectiveSnapDxPx) <= SMART_GUIDE_RESIZE_SNAP_LOCK_PX;
            const snapFactorX = isHardLockX
              ? 1
              : SMART_GUIDE_RESIZE_SNAP_STRENGTH;
            const snapDxWorld =
              (effectiveSnapDxPx * snapFactorX) / (camera.scale || 1);
            snappedWidth = Math.max(
              0,
              Math.round(
                isLeft ? newWidth - snapDxWorld : newWidth + snapDxWorld,
              ),
            );
          }

          if (affectsHeight && effectiveSnapDyPx) {
            const isHardLockY =
              resizeSession.snapYLocked ||
              Math.abs(effectiveSnapDyPx) <= SMART_GUIDE_RESIZE_SNAP_LOCK_PX;
            const snapFactorY = isHardLockY
              ? 1
              : SMART_GUIDE_RESIZE_SNAP_STRENGTH;
            const snapDyWorld =
              (effectiveSnapDyPx * snapFactorY) / (camera.scale || 1);
            snappedHeight = Math.max(
              0,
              Math.round(
                isTop ? newHeight - snapDyWorld : newHeight + snapDyWorld,
              ),
            );
          }

          const snappedWidthDelta = resizeSession.startWidth - snappedWidth;
          const snappedHeightDelta = resizeSession.startHeight - snappedHeight;

          item.artboardX =
            affectsWidth && isLeft
              ? resizeSession.startArtboardX + snappedWidthDelta
              : resizeSession.startArtboardX;
          item.artboardY =
            affectsHeight && isTop
              ? resizeSession.startArtboardY + snappedHeightDelta
              : resizeSession.startArtboardY;
          item.targetArtboardX = item.artboardX;
          item.targetArtboardY = item.artboardY;
          applyArtboardDimensions(item, snappedWidth, snappedHeight, {
            syncInputs: true,
            liveOnly: true,
          });
          updateCamera();

          updateSmartGuides({
            selectedIds,
            thresholdPx: dynamicThreshold,
            xPointMode: resizeXPointMode,
            yPointMode: resizeYPointMode,
          });

          updateOptionSpacingGuides({
            force: true,
            selectedIds,
            equalSpacingGuides: spacingResult.guides,
          });
        } else {
          resizeSession.snapXLocked = false;
          resizeSession.snapXLinePx = null;
          resizeSession.snapYLocked = false;
          resizeSession.snapYLinePx = null;
          hideSmartGuides();
          hideSpacingGuides();
        }

        camera.lastMouseX = e.clientX;
        camera.lastMouseY = e.clientY;
        return;
      }

      const dx = e.clientX - camera.lastMouseX;
      const dy = e.clientY - camera.lastMouseY;

      if (camera.dragTarget === "artboard") {
        // Figma: option-drag enables smart guides once the duplicate has
        // moved far enough from the original to avoid snapping back.
        const OPTION_DRAG_GUIDE_THRESHOLD = 20; // px in canvas coords
        const isOptionDrag = camera.optionDuplicateDrag === true;
        if (isOptionDrag) {
          camera.optionDragCumulDist +=
            Math.sqrt(dx * dx + dy * dy) / (camera.scale || 1);
        }
        const suppressGuides =
          isOptionDrag &&
          camera.optionDragCumulDist < OPTION_DRAG_GUIDE_THRESHOLD;

        const speedMultiplier = ARTBOARD_DRAG_SPEED;
        const scale = camera.scale || 1;
        let moveX = (dx / scale) * speedMultiplier;
        let moveY = (dy / scale) * speedMultiplier;
        if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
          shouldAutoSaveForCanvasMutation = true;
        }

        const selectedIds =
          state.selectedImportIds.size > 0
            ? Array.from(state.selectedImportIds)
            : state.activeImportId
              ? [state.activeImportId]
              : [];
        const selectedIdSet = new Set(selectedIds);

        const selectedItems = selectedIds
          .map((id) => state.imports.find((entry) => entry.id === id))
          .filter(Boolean);

        if (!selectedItems.length) {
          camera.lastMouseX = e.clientX;
          camera.lastMouseY = e.clientY;
          return;
        }

        const applyDeltaToSelected = (deltaX, deltaY) => {
          selectedItems.forEach((item) => {
            item.artboardX = (item.artboardX || 0) + deltaX;
            item.artboardY = (item.artboardY || 0) + deltaY;
            item.targetArtboardX = item.artboardX;
            item.targetArtboardY = item.artboardY;
          });
        };

        // ── HYSTERESIS: While locked on an axis, suppress mouse delta on that axis ──
        if (dragSnapState.xLocked) {
          // Item is locked to a vertical guide — don't move horizontally
          moveX = 0;
        }
        if (dragSnapState.yLocked) {
          // Item is locked to a horizontal guide — don't move vertically
          moveY = 0;
        }

        // Apply the (possibly axis-constrained) delta
        applyDeltaToSelected(moveX, moveY);

        // ── Cache viewport rect ONCE for this entire frame ──
        _cachedViewportRect = canvasViewport.getBoundingClientRect();

        // Compute moving bounds from world coords (no layout thrash)
        const selRects = selectedItems
          .map((item) => getWorldBoundsInScreen(item))
          .filter(Boolean);
        const movingBounds = {
          left: Math.min(...selRects.map((r) => r.left)),
          top: Math.min(...selRects.map((r) => r.top)),
          right: Math.max(...selRects.map((r) => r.right)),
          bottom: Math.max(...selRects.map((r) => r.bottom)),
        };
        movingBounds.centerX = (movingBounds.left + movingBounds.right) / 2;
        movingBounds.centerY = (movingBounds.top + movingBounds.bottom) / 2;

        // Pre-filter to nearby items (spatial proximity)
        const allOtherItems = state.imports.filter(
          (item) =>
            !selectedIdSet.has(item.id) &&
            item.previewEl?.classList.contains("visible"),
        );
        const nearbyItems = getNearbyItems(allOtherItems, movingBounds);

        // ── SINGLE-PASS: Collect ALL snap candidates without applying or rendering ──
        let winnerX = null; // Best X-axis candidate { diff (screen px), type, priority }
        let winnerY = null; // Best Y-axis candidate

        let equalSpacingResult = { snapDxPx: 0, snapDyPx: 0, guides: null };
        let gapMatchResult = { snapDxPx: 0, snapDyPx: 0 };

        if (!suppressGuides) {
          // 1) Alignment snap candidates (center/edge)
          const alignResult = updateSmartGuides({
            selectedIds,
            precomputedMovingBounds: movingBounds,
            precomputedNearbyItems: nearbyItems,
            renderGuides: false, // don't render yet
          });

          // 2) Equal spacing candidates
          equalSpacingResult = updateEqualSpacingSnap({
            selectedIds,
            precomputedMovingBounds: movingBounds,
            precomputedNearbyItems: nearbyItems,
          });

          // 3) Gap match candidates
          gapMatchResult = updateGapMatchSnap({
            selectedIds,
            precomputedMovingBounds: movingBounds,
            precomputedNearbyItems: nearbyItems,
          });

          // ── PRIORITY SELECTION: Pick ONE winner per axis ──
          // Priority: center (0) > edge (1) > spacing (2)
          const xCandidates = [];
          const yCandidates = [];

          // Alignment candidates
          if (alignResult.bestV) {
            xCandidates.push({
              diff: alignResult.bestV.diff,
              abs: alignResult.bestV.abs,
              type: alignResult.bestV.snapType,
              priority: alignResult.bestV.priority,
              source: "align",
            });
          }
          if (alignResult.bestH) {
            yCandidates.push({
              diff: alignResult.bestH.diff,
              abs: alignResult.bestH.abs,
              type: alignResult.bestH.snapType,
              priority: alignResult.bestH.priority,
              source: "align",
            });
          }

          // Equal spacing candidates (priority = 2)
          if (equalSpacingResult.snapDxPx) {
            xCandidates.push({
              diff: equalSpacingResult.snapDxPx,
              abs: Math.abs(equalSpacingResult.snapDxPx),
              type: "spacing",
              priority: 2,
              source: "equalSpacing",
            });
          }
          if (equalSpacingResult.snapDyPx) {
            yCandidates.push({
              diff: equalSpacingResult.snapDyPx,
              abs: Math.abs(equalSpacingResult.snapDyPx),
              type: "spacing",
              priority: 2,
              source: "equalSpacing",
            });
          }

          // Gap match candidates (priority = 2)
          if (gapMatchResult.snapDxPx) {
            xCandidates.push({
              diff: gapMatchResult.snapDxPx,
              abs: Math.abs(gapMatchResult.snapDxPx),
              type: "spacing",
              priority: 2,
              source: "gapMatch",
            });
          }
          if (gapMatchResult.snapDyPx) {
            yCandidates.push({
              diff: gapMatchResult.snapDyPx,
              abs: Math.abs(gapMatchResult.snapDyPx),
              type: "spacing",
              priority: 2,
              source: "gapMatch",
            });
          }

          // Sort by priority (lower first), then by abs distance
          xCandidates.sort((a, b) => a.priority - b.priority || a.abs - b.abs);
          yCandidates.sort((a, b) => a.priority - b.priority || a.abs - b.abs);

          winnerX = xCandidates[0] || null;
          winnerY = yCandidates[0] || null;
        }

        // ── HYSTERESIS: Snap-in / Lock / Release cycle ──
        const snapThreshold = SMART_GUIDE_SNAP_THRESHOLD_PX;
        const releaseThreshold = SMART_GUIDE_SNAP_RELEASE_PX;

        // --- X axis ---
        if (dragSnapState.xLocked) {
          // Currently locked: check if we should release
          const currentSnapLine = dragSnapState.xSnapScreenPx;
          // Compute where the moving bounds center-X would be without the lock
          // We need to check how far the user has tried to move away
          const rawScreenDx = dx; // raw mouse delta in screen px
          dragSnapState._xDriftPx =
            (dragSnapState._xDriftPx || 0) + rawScreenDx;

          if (Math.abs(dragSnapState._xDriftPx) > releaseThreshold) {
            // Release: undo the lock offset and re-apply the accumulated drift
            const releaseMoveX = dragSnapState._xDriftPx / scale;
            applyDeltaToSelected(releaseMoveX - dragSnapState.xWorldOffset, 0);
            dragSnapState.xLocked = false;
            dragSnapState.xSnapScreenPx = null;
            dragSnapState.xSnapType = null;
            dragSnapState.xWorldOffset = 0;
            dragSnapState._xDriftPx = 0;
          }
          // else: stay locked, moveX was already zeroed above
        } else if (winnerX && winnerX.abs <= snapThreshold) {
          // Snap in: apply correction and lock
          const snapWorldX = winnerX.diff / scale;
          applyDeltaToSelected(snapWorldX, 0);
          dragSnapState.xLocked = true;
          dragSnapState.xSnapScreenPx = movingBounds.centerX + winnerX.diff;
          dragSnapState.xSnapType = winnerX.type;
          dragSnapState.xWorldOffset = snapWorldX;
          dragSnapState._xDriftPx = 0;
        }

        // --- Y axis ---
        if (dragSnapState.yLocked) {
          const rawScreenDy = dy;
          dragSnapState._yDriftPx =
            (dragSnapState._yDriftPx || 0) + rawScreenDy;

          if (Math.abs(dragSnapState._yDriftPx) > releaseThreshold) {
            const releaseMoveY = dragSnapState._yDriftPx / scale;
            applyDeltaToSelected(0, releaseMoveY - dragSnapState.yWorldOffset);
            dragSnapState.yLocked = false;
            dragSnapState.ySnapScreenPx = null;
            dragSnapState.ySnapType = null;
            dragSnapState.yWorldOffset = 0;
            dragSnapState._yDriftPx = 0;
          }
        } else if (winnerY && winnerY.abs <= snapThreshold) {
          const snapWorldY = winnerY.diff / scale;
          applyDeltaToSelected(0, snapWorldY);
          dragSnapState.yLocked = true;
          dragSnapState.ySnapScreenPx = movingBounds.centerY + winnerY.diff;
          dragSnapState.ySnapType = winnerY.type;
          dragSnapState.yWorldOffset = snapWorldY;
          dragSnapState._yDriftPx = 0;
        }

        // ── SINGLE updateCamera + guide render ──
        updateCamera();

        if (suppressGuides) {
          hideSmartGuides();
          hideSpacingGuides();
        } else {
          // Re-compute moving bounds after snap correction for accurate guide rendering
          const finalSelRects = selectedItems
            .map((item) => getWorldBoundsInScreen(item))
            .filter(Boolean);
          const finalMovingBounds = {
            left: Math.min(...finalSelRects.map((r) => r.left)),
            top: Math.min(...finalSelRects.map((r) => r.top)),
            right: Math.max(...finalSelRects.map((r) => r.right)),
            bottom: Math.max(...finalSelRects.map((r) => r.bottom)),
          };
          finalMovingBounds.centerX =
            (finalMovingBounds.left + finalMovingBounds.right) / 2;
          finalMovingBounds.centerY =
            (finalMovingBounds.top + finalMovingBounds.bottom) / 2;

          // Render alignment guides (only the winning axis)
          updateSmartGuides({
            selectedIds,
            precomputedMovingBounds: finalMovingBounds,
            precomputedNearbyItems: nearbyItems,
            renderGuides: true,
          });

          // If no alignment snap is active on an axis, hide that guide
          if (
            !dragSnapState.xLocked &&
            !(winnerX && winnerX.source === "align")
          ) {
            if (smartGuides.vertical)
              smartGuides.vertical.classList.remove("active");
          }
          if (
            !dragSnapState.yLocked &&
            !(winnerY && winnerY.source === "align")
          ) {
            if (smartGuides.horizontal)
              smartGuides.horizontal.classList.remove("active");
          }

          // Render spacing guides
          updateOptionSpacingGuides({
            force: true,
            selectedIds,
            equalSpacingGuides: equalSpacingResult.guides,
          });
        }

        // Clear per-frame viewport cache
        _cachedViewportRect = null;
      } else {
        hideSmartGuides();
        hideSpacingGuides();
        // Panning canvas is 1:1 with mouse movement
        camera.x += dx;
        camera.y += dy;
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        updateCamera();
      }

      camera.lastMouseX = e.clientX;
      camera.lastMouseY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      const shouldPersistCanvasMutation = shouldAutoSaveForCanvasMutation;

      // Snapshot mutable state BEFORE resetting so we can record undo actions.
      const prevDragTarget = camera.dragTarget;
      const wasResizingArtboard = resizeSession.active;
      const wasResizingGroup = groupResizeSession.active;
      const resizeSnap = wasResizingArtboard
        ? {
            itemId: resizeSession.itemId,
            startX: resizeSession.startArtboardX,
            startY: resizeSession.startArtboardY,
            startWidth: resizeSession.startWidth,
            startHeight: resizeSession.startHeight,
            prevActiveId: resizeSession.prevActiveId,
            prevSelectedIds: resizeSession.prevSelectedIds.slice(),
          }
        : null;
      const groupResizeSnap = wasResizingGroup
        ? {
            items: groupResizeSession.items.slice(),
            prevActiveId: groupResizeSession.prevActiveId,
            prevSelectedIds: groupResizeSession.prevSelectedIds.slice(),
          }
        : null;
      const dragStartPositions = camera.dragStartPositions;
      const dragStartActiveId = camera.dragStartActiveId;
      const dragStartSelectedIds = camera.dragStartSelectedIds;

      // Flush any conversion-invalidation bookkeeping that was deferred
      // during a live resize drag (see applyArtboardDimensions' `liveOnly`)
      // now that the drag has actually ended.
      if ((wasResizingArtboard || wasResizingGroup) && pendingResizeInvalidateIds) {
        invalidateConversionForIds(pendingResizeInvalidateIds);
        pendingResizeInvalidateIds = null;
      }

      if (marquee.isSelecting) {
        const shouldClearSelection =
          !marquee.hasHits && !marquee.baseSelection.size;
        marquee.isSelecting = false;
        if (marquee.element) {
          marquee.element.classList.remove("active");
          marquee.element.style.width = "0px";
          marquee.element.style.height = "0px";
        }
        if (shouldClearSelection) {
          clearCanvasSelection();
        }
      }

      camera.isDragging = false;
      camera.dragTarget = null;
      camera.optionDuplicateDrag = false;
      camera.optionDragCumulDist = 0;
      camera.dragStartPositions = new Map();
      camera.dragStartActiveId = null;
      camera.dragStartSelectedIds = [];
      canvasViewport.classList.remove("option-duplicate-drag");
      shouldAutoSaveForCanvasMutation = false;
      resizeSession.active = false;
      resizeSession.itemId = null;
      resizeSession.handle = "";
      resizeSession.snapXLocked = false;
      resizeSession.snapXLinePx = null;
      resizeSession.snapYLocked = false;
      resizeSession.snapYLinePx = null;
      resizeSession.prevActiveId = null;
      resizeSession.prevSelectedIds = [];
      groupResizeSession.active = false;
      groupResizeSession.edge = "";
      groupResizeSession.startMouseY = 0;
      groupResizeSession.items = [];
      groupResizeSession.prevActiveId = null;
      groupResizeSession.prevSelectedIds = [];
      resetDragSnapState(); // Clear hysteresis locks on drag end
      hideSmartGuides();
      if (!modifierState.isOptionPressed) hideSpacingGuides();
      updateOptionSpacingGuides();

      // ── Record "move" action ─────────────────────────────────────
      if (
        prevDragTarget === "artboard" &&
        shouldPersistCanvasMutation &&
        dragStartPositions?.size > 0
      ) {
        const moveEntries = [];
        dragStartPositions.forEach((prev, id) => {
          const item = state.imports.find((it) => it.id === id);
          if (!item) return;
          const nextX = item.artboardX || 0;
          const nextY = item.artboardY || 0;
          if (
            Math.abs(nextX - prev.x) > 0.5 ||
            Math.abs(nextY - prev.y) > 0.5
          ) {
            moveEntries.push({
              id,
              prevX: prev.x,
              prevY: prev.y,
              nextX,
              nextY,
            });
          }
        });
        if (moveEntries.length > 0) {
          recordAction({
            type: "move",
            entries: moveEntries,
            prevActiveId: dragStartActiveId,
            prevSelectedIds: dragStartSelectedIds || [],
            nextActiveId: state.activeImportId,
            nextSelectedIds: Array.from(state.selectedImportIds),
          });
        }
      }

      // ── Record single-artboard "resize" action ───────────────────
      if (wasResizingArtboard && resizeSnap && shouldPersistCanvasMutation) {
        const item = state.imports.find((it) => it.id === resizeSnap.itemId);
        if (item) {
          const { width: nextWidth, height: nextHeight } =
            getArtboardDimensions(item);
          const nextX = item.artboardX || 0;
          const nextY = item.artboardY || 0;
          const changed =
            nextWidth !== resizeSnap.startWidth ||
            nextHeight !== resizeSnap.startHeight ||
            Math.abs(nextX - resizeSnap.startX) > 0.5 ||
            Math.abs(nextY - resizeSnap.startY) > 0.5;
          if (changed) {
            recordAction({
              type: "resize",
              entries: [
                {
                  id: resizeSnap.itemId,
                  prevX: resizeSnap.startX,
                  prevY: resizeSnap.startY,
                  prevWidth: resizeSnap.startWidth,
                  prevHeight: resizeSnap.startHeight,
                  nextX,
                  nextY,
                  nextWidth,
                  nextHeight,
                },
              ],
              prevActiveId: resizeSnap.prevActiveId,
              prevSelectedIds: resizeSnap.prevSelectedIds,
            });
          }
        }
      }

      // ── Record group "resize" action ─────────────────────────────
      if (wasResizingGroup && groupResizeSnap && shouldPersistCanvasMutation) {
        const resizeEntries = [];
        groupResizeSnap.items.forEach((entry) => {
          const item = state.imports.find((it) => it.id === entry.id);
          if (!item) return;
          const { width: nextWidth, height: nextHeight } =
            getArtboardDimensions(item);
          const nextX = item.artboardX || 0;
          const nextY = item.artboardY || 0;
          const changed =
            nextWidth !== entry.startWidth ||
            nextHeight !== entry.startHeight ||
            Math.abs(nextX - entry.startX) > 0.5 ||
            Math.abs(nextY - entry.startY) > 0.5;
          if (changed) {
            resizeEntries.push({
              id: entry.id,
              prevX: entry.startX,
              prevY: entry.startY,
              prevWidth: entry.startWidth,
              prevHeight: entry.startHeight,
              nextX,
              nextY,
              nextWidth,
              nextHeight,
            });
          }
        });
        if (resizeEntries.length > 0) {
          recordAction({
            type: "resize",
            entries: resizeEntries,
            prevActiveId: groupResizeSnap.prevActiveId,
            prevSelectedIds: groupResizeSnap.prevSelectedIds,
          });
        }
      }

      if (shouldPersistCanvasMutation) {
        schedulePersistWorkspaceState({ showFeedback: true });
      }
      canvasViewport.classList.remove("dragging");
      canvasViewport.classList.remove("resizing");
    });

    canvasViewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        const deltaMultiplier =
          e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;

        if (e.ctrlKey || e.metaKey) {
          // ── Zoom (Ctrl/Cmd + scroll  OR  trackpad pinch) ──────────
          // Trackpad pinch fires ctrlKey=true with small, fractional deltas.
          // Discrete mouse wheel fires larger integer deltas.
          const rawDelta = e.deltaY * deltaMultiplier;
          const isTrackpadPinch = Math.abs(e.deltaY) < 10 && e.deltaMode === 0;
          const sensitivity = isTrackpadPinch
            ? PINCH_ZOOM_SENSITIVITY
            : WHEEL_ZOOM_SENSITIVITY;

          // Exponential zoom: each px of delta multiplies scale by e^(−δ·k)
          const zoomFactor = Math.exp(-rawDelta * sensitivity);
          const newScale = clampScale(camera.targetScale * zoomFactor);

          // Anchor zoom at cursor position (Figma-like)
          const rect = canvasViewport.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const worldX =
            (mouseX - rect.width / 2 - camera.targetX) / camera.targetScale;
          const worldY =
            (mouseY - rect.height / 2 - camera.targetY) / camera.targetScale;

          camera.targetScale = newScale;
          camera.targetX = mouseX - rect.width / 2 - worldX * newScale;
          camera.targetY = mouseY - rect.height / 2 - worldY * newScale;

          // Instant for responsiveness (no lerp lag on wheel/pinch).
          // DON'T call updateCamera() here — multiple wheel events fire per RAF frame.
          // Set dirty so the render loop batches all of them into ONE DOM write per frame.
          camera.scale = camera.targetScale;
          camera.x = camera.targetX;
          camera.y = camera.targetY;
          camera.dirty = true;
        } else {
          // ── Pan (two-finger scroll / mouse wheel) ────────────────
          // Figma: 1 : 1 mapping of scroll delta to canvas pixels.
          // Shift + scroll → horizontal pan (like Figma).
          let panX = e.deltaX * deltaMultiplier;
          let panY = e.deltaY * deltaMultiplier;

          if (e.shiftKey && panX === 0) {
            // Shift + vertical scroll → horizontal pan
            panX = panY;
            panY = 0;
          }

          camera.x -= panX;
          camera.y -= panY;
          camera.targetX = camera.x;
          camera.targetY = camera.y;
          camera.dirty = true; // batch to RAF — no mid-frame DOM writes
        }
      },
      { passive: false },
    );
  }

  updateCamera(); // Initial state
  window.addEventListener("beforeunload", () => {
    persistActiveImportState();
    void persistWorkspaceStateNow();
  });
  window.addEventListener("pagehide", () => {
    void saveWorkspaceNowWithFeedbackOptions({ silent: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void saveWorkspaceNowWithFeedbackOptions({ silent: true });
    }
  });
  void restoreWorkspaceStateFromStorage().finally(() => {
    window._workspaceRestoreReady = true;
  });

  // Zoom Value Handler (Editable span)
  if (zoomInput) {
    zoomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Stop newline
        let val = parseFloat(zoomInput.textContent);
        if (!isNaN(val) && val > 0) {
          // User types the real percentage (e.g. 100 = scale 1.0, like Figma)
          camera.targetScale = clampScale(val / 100);
          camera.scale = camera.targetScale;
          zoomInput.blur();
        } else {
          updateCamera();
        }
      }
    });

    zoomInput.addEventListener("blur", () => {
      updateCamera(); // Restore symbol
    });

    zoomInput.addEventListener("focus", () => {
      // No auto-select for cleaner look, but we can just place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(zoomInput);
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  // Viewport Dimensions Handlers (Live Preview)
  if (viewportWidthInput && viewportHeightInput) {
    const updatePreviewDimensions = () => {
      const widthRaw = viewportWidthInput.value.trim();
      const heightRaw = viewportHeightInput.value.trim();

      // Allow user to temporarily clear a field while typing.
      if (!widthRaw || !heightRaw) return;

      const w = parseInt(widthRaw, 10);
      const h = parseInt(heightRaw, 10);
      if (Number.isNaN(w) || Number.isNaN(h)) return;

      const selectedItems =
        state.selectedImportIds.size > 0
          ? state.imports.filter((item) => state.selectedImportIds.has(item.id))
          : [];

      if (selectedItems.length > 0) {
        selectedItems.forEach((item) =>
          applyArtboardDimensions(item, w, h, { syncInputs: false }),
        );
        const activeItem = getActiveImport();
        if (activeItem) syncDimensionInputsFromItem(activeItem);
      } else if (canvasPreview) {
        const activeItem = getActiveImport();
        if (activeItem) {
          applyArtboardDimensions(activeItem, w, h, { syncInputs: true });
        } else {
          canvasPreview.style.width = w + "px";
          canvasPreview.style.height = h + "px";
          if (previewFrame) {
            previewFrame.style.width = "100%";
            previewFrame.style.height = "100%";
          }
          if (dimensionLabel) {
            dimensionLabel.textContent = `${w} × ${h} Hug`;
          }
        }
      }

      updateCamera();
    };

    [viewportWidthInput, viewportHeightInput].forEach((input) => {
      input.addEventListener("input", updatePreviewDimensions);

      input.addEventListener("blur", () => {
        const raw = input.value.trim();
        if (!raw || Number.isNaN(parseInt(raw, 10))) {
          const activeItem = getActiveImport();
          if (activeItem) {
            syncDimensionInputsFromItem(activeItem);
          } else {
            input.value = input === viewportWidthInput ? "1440" : "900";
          }
        } else {
          input.value = String(parseInt(raw, 10));
        }
        updatePreviewDimensions();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      });
    });
  }

  // Zoom Fit Button Handler — fits all artboards in view (like Shift+1 in Figma)
  const zoomToFitAll = () => {
    if (state.imports.length === 0) {
      camera.targetScale = INITIAL_SCALE;
      camera.targetX = 0;
      camera.targetY = 0;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      updateCamera();
      return;
    }
    const vpRect = canvasViewport.getBoundingClientRect();
    const padding = 64;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    state.imports.forEach((item) => {
      if (!item.previewEl) return;
      const dims = getArtboardDimensions(item);
      const ax = item.artboardX || 0;
      const ay = item.artboardY || 0;
      minX = Math.min(minX, ax);
      minY = Math.min(minY, ay);
      maxX = Math.max(maxX, ax + dims.width);
      maxY = Math.max(maxY, ay + dims.height);
    });
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 1440;
      maxY = 900;
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const fitScale = clampScale(
      Math.min(
        (vpRect.width - padding * 2) / contentW,
        (vpRect.height - padding * 2) / contentH,
      ),
    );
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    // canvasContainer origin is center, so translate content center to viewport center
    camera.targetScale = fitScale;
    camera.targetX = -contentCenterX * fitScale;
    camera.targetY = -contentCenterY * fitScale;
    camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
    updateCamera();
  };
  if (btnZoomFit) {
    btnZoomFit.addEventListener("click", zoomToFitAll);
  }

  // Keyboard Shortcuts (Delete/Backspace to remove attachment)
  window.addEventListener("keydown", (e) => {
    const isCommandPaletteShortcut = isCommandPaletteShortcutEvent(e);

    if (isCommandPaletteShortcut && !e.repeat) {
      e.preventDefault();
      if (isCommandPaletteOpen()) {
        closeCommandPalette();
      } else {
        openCommandPalette("");
      }
      return;
    }

    if (isCommandPaletteOpen()) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveCommandPaletteSelection(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveCommandPaletteSelection(-1);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        executeCommandPaletteResult();
        return;
      }

      // Keep existing shortcuts inactive while command palette is open.
      return;
    }

    if (e.key === "Alt") {
      modifierState.isOptionPressed = true;
      updateOptionSpacingGuides();
    }

    // ── Figma: Space held → temporary hand tool ──────────────────
    if (e.code === "Space" && !e.repeat && !camera.spaceHeld) {
      const activeEl = document.activeElement;
      const isTyping =
        !!activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);
      if (!isTyping) {
        e.preventDefault();
        camera.spaceHeld = true;
        camera.priorToolBeforeSpace = activeCanvasTool;
        setActiveCanvasTool("hand");
      }
    }

    // Save all changes immediately (Cmd/Ctrl + S)
    const isSaveKey =
      e.code === "KeyS" ||
      (typeof e.key === "string" && e.key.toLowerCase() === "s");
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.shiftKey &&
      !e.altKey &&
      isSaveKey &&
      !e.repeat
    ) {
      e.preventDefault();
      saveWorkspaceNowWithFeedback();
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const isPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;

    // ── Undo / Redo: always intercept before the typing-context guard ────────────
    // This ensures Cmd+Z / Cmd+Shift+Z reach the canvas even if an input somehow
    // still has focus (e.g. user tabbed to zoom field then clicked canvas without
    // the blur firing first). Matches Figma behaviour.
    {
      const _isUndoKey =
        e.key.toLowerCase() === "z" &&
        (isMac ? e.metaKey : e.ctrlKey) &&
        !e.shiftKey;
      const _isRedoKey =
        (e.key.toLowerCase() === "z" &&
          (isMac ? e.metaKey : e.ctrlKey) &&
          e.shiftKey) ||
        (!isMac && e.key.toLowerCase() === "y" && e.ctrlKey);
      if (_isUndoKey || _isRedoKey) {
        e.preventDefault();
        if (_isUndoKey) {
          const nextUndo = state.undoStack[state.undoStack.length - 1];
          const undoLabel =
            nextUndo?.type === "move"
              ? "Move"
              : nextUndo?.type === "resize"
                ? "Resize"
                : nextUndo?.type === "delete"
                  ? "Delete"
                  : nextUndo?.type === "add"
                    ? "Add"
                    : "Action";
          const didUndo = undoRecentAction();
          if (didUndo) showToast("Undo", `${undoLabel} undone.`, "success");
        } else {
          const nextRedo = state.redoStack[state.redoStack.length - 1];
          const redoLabel =
            nextRedo?.type === "move"
              ? "Move"
              : nextRedo?.type === "resize"
                ? "Resize"
                : nextRedo?.type === "delete"
                  ? "Delete"
                  : nextRedo?.type === "add"
                    ? "Add"
                    : "Action";
          const didRedo = redoRecentAction();
          if (didRedo) showToast("Redo", `${redoLabel} redone.`, "success");
        }
        return;
      }
    }

    // Prevent other shortcuts while typing/editing text
    const activeEl = document.activeElement;
    const isTypingContext =
      !!activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable);
    if (isTypingContext) return;

    // ── Figma: Ctrl/Cmd + 0 → zoom to 100% ─────────────────────
    if (isPrimaryModifier && e.key === "0" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const rect = canvasViewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - rect.width / 2 - camera.x) / camera.scale;
      const worldY = (cy - rect.height / 2 - camera.y) / camera.scale;
      camera.targetScale = 1.0;
      camera.targetX = cx - rect.width / 2 - worldX * 1.0;
      camera.targetY = cy - rect.height / 2 - worldY * 1.0;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      return;
    }

    // ── Figma: Shift + 1 → zoom to fit all ──────────────────────
    if (!isPrimaryModifier && e.shiftKey && e.key === "1" && !e.altKey) {
      e.preventDefault();
      zoomToFitAll();
      return;
    }

    // ── Figma: + / = → zoom in one step, − → zoom out one step ─
    if (
      !isPrimaryModifier &&
      !e.shiftKey &&
      !e.altKey &&
      (e.key === "=" || e.key === "+")
    ) {
      e.preventDefault();
      const nextScale = nextZoomStopUp(camera.targetScale);
      const rect = canvasViewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - rect.width / 2 - camera.x) / camera.scale;
      const worldY = (cy - rect.height / 2 - camera.y) / camera.scale;
      camera.targetScale = nextScale;
      camera.targetX = cx - rect.width / 2 - worldX * nextScale;
      camera.targetY = cy - rect.height / 2 - worldY * nextScale;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      return;
    }
    if (!isPrimaryModifier && !e.shiftKey && !e.altKey && e.key === "-") {
      e.preventDefault();
      const nextScale = nextZoomStopDown(camera.targetScale);
      const rect = canvasViewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - rect.width / 2 - camera.x) / camera.scale;
      const worldY = (cy - rect.height / 2 - camera.y) / camera.scale;
      camera.targetScale = nextScale;
      camera.targetX = cx - rect.width / 2 - worldX * nextScale;
      camera.targetY = cy - rect.height / 2 - worldY * nextScale;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      return;
    }

    // ── Figma: Ctrl/Cmd + = → zoom in, Ctrl/Cmd + - → zoom out ──
    if (isPrimaryModifier && !e.altKey && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      const nextScale = nextZoomStopUp(camera.targetScale);
      const rect = canvasViewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - rect.width / 2 - camera.x) / camera.scale;
      const worldY = (cy - rect.height / 2 - camera.y) / camera.scale;
      camera.targetScale = nextScale;
      camera.targetX = cx - rect.width / 2 - worldX * nextScale;
      camera.targetY = cy - rect.height / 2 - worldY * nextScale;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      return;
    }
    if (isPrimaryModifier && !e.altKey && e.key === "-") {
      e.preventDefault();
      const nextScale = nextZoomStopDown(camera.targetScale);
      const rect = canvasViewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - rect.width / 2 - camera.x) / camera.scale;
      const worldY = (cy - rect.height / 2 - camera.y) / camera.scale;
      camera.targetScale = nextScale;
      camera.targetX = cx - rect.width / 2 - worldX * nextScale;
      camera.targetY = cy - rect.height / 2 - worldY * nextScale;
      camera.panLerpOverride = TAB_FOCUS_PAN_LERP;
      return;
    }

    // Tab cycles through artboards. Shift+Tab cycles backward.
    if (
      !isPrimaryModifier &&
      !e.altKey &&
      e.key === "Tab" &&
      state.imports.length > 0
    ) {
      e.preventDefault();

      const currentIndex = state.imports.findIndex(
        (item) => item.id === state.activeImportId,
      );
      const direction = e.shiftKey ? -1 : 1;
      const fallbackIndex = e.shiftKey ? state.imports.length : -1;
      const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
      const nextIndex =
        (baseIndex + direction + state.imports.length) % state.imports.length;
      const nextItem = state.imports[nextIndex];

      if (nextItem) {
        setActiveImport(nextItem.id, { deferNonCriticalUi: true });
        // Per request: no pan animation while cycling via Tab (instant jump).
        focusArtboardInCanvas(nextItem, { instant: true });
      }
      return;
    }

    // Number shortcuts: 1..5 selects artboard by visible order.
    // Shift + number toggles into multi-selection.
    if (!isPrimaryModifier && !e.altKey && /^[1-5]$/.test(e.key)) {
      const order = parseInt(e.key, 10);
      const target = state.imports[order - 1];
      if (target) {
        e.preventDefault();
        if (e.shiftKey) {
          const next = new Set(state.selectedImportIds);
          if (next.has(target.id) && next.size > 1) {
            next.delete(target.id);
          } else {
            next.add(target.id);
          }
          setActiveImport(target.id, {
            preserveSelection: true,
            selectedIds: Array.from(next),
            deferNonCriticalUi: true,
          });
        } else {
          setActiveImport(target.id, { deferNonCriticalUi: true });
        }
      }
      return;
    }

    // Select all artboards (Figma-like)
    if (isPrimaryModifier && e.key.toLowerCase() === "a") {
      if (state.imports.length > 0) {
        e.preventDefault();
        const ids = state.imports.map((item) => item.id);
        const activeId = state.activeImportId || ids[0];
        setActiveImport(activeId, {
          preserveSelection: true,
          selectedIds: ids,
          deferNonCriticalUi: true,
        });
        updateStatus(`Selected ${ids.length} artboards`, "success");
      }
      return;
    }

    if (e.key === "Escape") {
      if (toolbarAlignMenu?.classList.contains("open")) {
        toolbarAlignMenu.classList.remove("open");
        if (toolbarAlignArrow)
          toolbarAlignArrow.setAttribute("aria-expanded", "false");
      }
      if (toolbarAddMenu?.classList.contains("open")) {
        toolbarAddMenu.classList.remove("open");
        if (toolbarAddBtn) toolbarAddBtn.setAttribute("aria-expanded", "false");
      }
      clearCanvasSelection();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      const selectedIds =
        state.selectedImportIds.size > 0
          ? Array.from(state.selectedImportIds)
          : state.activeImportId
            ? [state.activeImportId]
            : [];

      if (selectedIds.length > 0) {
        e.preventDefault();
        removeImportsByIds(selectedIds);
      }
    }

    // Undo / Redo Shortcuts are handled early (before isTypingContext guard) — see above.

    const hasCopyModifier = isPrimaryModifier || e.ctrlKey;
    const isCopyKey =
      hasCopyModifier &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "c";
    const isPasteKey =
      hasCopyModifier &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "v";
    const isCutKey =
      hasCopyModifier &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "x";

    if (isCopyKey) {
      const selectedIds =
        state.selectedImportIds.size > 0
          ? Array.from(state.selectedImportIds)
          : state.activeImportId
            ? [state.activeImportId]
            : [];
      if (selectedIds.length > 0) {
        e.preventDefault();
        const copiedCount = writeArtboardClipboard(selectedIds);
        if (copiedCount > 0) {
          updateStatus(
            copiedCount === 1
              ? "Artboard copied"
              : `${copiedCount} artboards copied`,
            "success",
          );
        }
      }
      return;
    }

    if (isCutKey) {
      const selectedIds =
        state.selectedImportIds.size > 0
          ? Array.from(state.selectedImportIds)
          : state.activeImportId
            ? [state.activeImportId]
            : [];
      if (selectedIds.length > 0) {
        e.preventDefault();
        const copiedCount = writeArtboardClipboard(selectedIds);
        if (copiedCount > 0) {
          removeImportsByIds(selectedIds, { showDeleteToast: false });
          showToast(
            copiedCount === 1 ? "Cut" : "Cut",
            copiedCount === 1
              ? "Artboard cut."
              : `${copiedCount} artboards cut.`,
            "warning",
          );
          updateStatus(
            copiedCount === 1 ? "Artboard cut" : `${copiedCount} artboards cut`,
            "success",
          );
        }
      }
      return;
    }

    if (isPasteKey) {
      e.preventDefault();
      void pasteArtboardClipboard();
      return;
    }

    // Duplicate selected artboard(s): Cmd/Ctrl + D
    if (
      isPrimaryModifier &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "d"
    ) {
      e.preventDefault();
      void duplicateSelectedImports();
      return;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
      modifierState.isOptionPressed = false;
      hideSpacingGuides();
    }
    // ── Figma: release Space → restore prior tool ────────────────
    if (e.code === "Space" && camera.spaceHeld) {
      camera.spaceHeld = false;
      setActiveCanvasTool(camera.priorToolBeforeSpace || "pointer");
      camera.priorToolBeforeSpace = null;
    }
  });

  window.addEventListener("blur", () => {
    modifierState.isOptionPressed = false;
    hideSpacingGuides();
    // Reset space-held state when window loses focus
    if (camera.spaceHeld) {
      camera.spaceHeld = false;
      setActiveCanvasTool(camera.priorToolBeforeSpace || "pointer");
      camera.priorToolBeforeSpace = null;
    }
  });

  removeFileBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const selectedIds =
      state.selectedImportIds.size > 0
        ? Array.from(state.selectedImportIds)
        : state.activeImportId
          ? [state.activeImportId]
          : [];

    removeImportsByIds(selectedIds);
  });

  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isHidden = btnDropdown.classList.toggle("hidden");
      browseBtn.classList.toggle("open", !isHidden);
    });
  }

  if (toolbarUndoBtn) {
    toolbarUndoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextUndo = state.undoStack[state.undoStack.length - 1];
      const undoLabel =
        nextUndo?.type === "move"
          ? "Move"
          : nextUndo?.type === "resize"
            ? "Resize"
            : nextUndo?.type === "delete"
              ? "Delete"
              : nextUndo?.type === "add"
                ? "Add"
                : "Action";
      const didUndo = undoRecentAction();
      if (didUndo) showToast("Undo", `${undoLabel} undone.`, "success");
    });
  }

  if (toolbarRedoBtn) {
    toolbarRedoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextRedo = state.redoStack[state.redoStack.length - 1];
      const redoLabel =
        nextRedo?.type === "move"
          ? "Move"
          : nextRedo?.type === "resize"
            ? "Resize"
            : nextRedo?.type === "delete"
              ? "Delete"
              : nextRedo?.type === "add"
                ? "Add"
                : "Action";
      const didRedo = redoRecentAction();
      if (didRedo) showToast("Redo", `${redoLabel} redone.`, "success");
    });
  }

  // Initialize button states on load (both start disabled — no history yet).
  updateUndoRedoButtons();

  if (toolbarAddBtn && toolbarAddMenu) {
    const preloadAddMenuAssets = () => {
      const srcSet = new Set();
      toolbarAddMenu.querySelectorAll("img").forEach((img) => {
        if (img.src) srcSet.add(img.src);
      });
      srcSet.forEach((src) => {
        const preloadImg = new Image();
        preloadImg.decoding = "sync";
        preloadImg.src = src;
      });
    };

    preloadAddMenuAssets();

    toolbarAddBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = toolbarAddMenu.classList.contains("open");
      toolbarAddMenu.classList.toggle("open", !isOpen);
      toolbarAddBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");

      if (!isOpen && toolbarAlignMenu?.classList.contains("open")) {
        toolbarAlignMenu.classList.remove("open");
        if (toolbarAlignArrow)
          toolbarAlignArrow.setAttribute("aria-expanded", "false");
      }
    });

    toolbarAddMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".figma-align-menu-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();

      const action = item.dataset.action;
      if (action === "undo") {
        undoRecentAction();
      } else if (action === "redo") {
        redoRecentAction();
      } else if (action === "delete") {
        const selectedIds =
          state.selectedImportIds.size > 0
            ? Array.from(state.selectedImportIds)
            : state.activeImportId
              ? [state.activeImportId]
              : [];
        if (selectedIds.length > 0) {
          removeImportsByIds(selectedIds);
        }
      } else if (action === "fit") {
        if (btnZoomFit) btnZoomFit.click();
      }

      toolbarAddMenu.classList.remove("open");
      toolbarAddBtn.setAttribute("aria-expanded", "false");
    });
  }

  if (toolbarAlignArrow && toolbarAlignMenu) {
    const preloadAlignMenuAssets = () => {
      const srcSet = new Set();
      toolbarAlignMenu.querySelectorAll("img").forEach((img) => {
        if (img.src) srcSet.add(img.src);
        if (img.dataset.defaultSrc) srcSet.add(img.dataset.defaultSrc);
        if (img.dataset.hoverSrc) srcSet.add(img.dataset.hoverSrc);
      });
      srcSet.forEach((src) => {
        const preloadImg = new Image();
        preloadImg.decoding = "sync";
        preloadImg.src = src;
      });
    };

    const syncAlignMenuIconStates = () => {
      toolbarAlignMenu
        .querySelectorAll(".figma-align-menu-item img[data-default-src]")
        .forEach((img) => {
          const targetSrc = img.dataset.defaultSrc;
          if (targetSrc) img.src = targetSrc;
        });
    };

    preloadAlignMenuAssets();
    syncAlignMenuIconStates();

    toolbarAlignMenu
      .querySelectorAll(".figma-align-menu-item")
      .forEach((menuItem) => {
        menuItem.addEventListener("mouseenter", () => {
          const img = menuItem.querySelector("img[data-hover-src]");
          if (!img?.dataset.hoverSrc) return;
          img.src = img.dataset.hoverSrc;
        });

        menuItem.addEventListener("mouseleave", () => {
          syncAlignMenuIconStates();
        });
      });

    toolbarAlignArrow.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = toolbarAlignMenu.classList.contains("open");
      toolbarAlignMenu.classList.toggle("open", !isOpen);
      toolbarAlignArrow.setAttribute(
        "aria-expanded",
        isOpen ? "false" : "true",
      );

      if (!isOpen && toolbarAddMenu?.classList.contains("open")) {
        toolbarAddMenu.classList.remove("open");
        if (toolbarAddBtn) toolbarAddBtn.setAttribute("aria-expanded", "false");
      }
    });

    toolbarAlignMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".figma-align-menu-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();

      const mode = item.dataset.align;
      if (
        mode === "top" ||
        mode === "bottom" ||
        mode === "left" ||
        mode === "right"
      ) {
        alignSelectedArtboards(mode);
        syncAlignMenuIconStates();
      }

      toolbarAlignMenu.classList.remove("open");
      toolbarAlignArrow.setAttribute("aria-expanded", "false");
    });
  }

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (btnDropdown && !btnDropdown.classList.contains("hidden")) {
      if (!browseBtn.contains(e.target) && !btnDropdown.contains(e.target)) {
        btnDropdown.classList.add("hidden");
        browseBtn.classList.remove("open");
      }
    }

    if (
      toolbarAlignMenu &&
      toolbarAlignArrow &&
      toolbarAlignMenu.classList.contains("open")
    ) {
      if (!toolbarAlignWrap || !toolbarAlignWrap.contains(e.target)) {
        toolbarAlignMenu.classList.remove("open");
        toolbarAlignArrow.setAttribute("aria-expanded", "false");
      }
    }

    if (
      toolbarAddMenu &&
      toolbarAddBtn &&
      toolbarAddMenu.classList.contains("open")
    ) {
      if (!toolbarAddWrap || !toolbarAddWrap.contains(e.target)) {
        toolbarAddMenu.classList.remove("open");
        toolbarAddBtn.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Dropdown Items Clicks
  const dropdownItems = document.querySelectorAll(".dropdown-item");
  dropdownItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = item.dataset.type;
      if (type === "file") {
        fileInput.click();
      } else if (type === "folder") {
        selectFolder();
      }
      btnDropdown.classList.add("hidden");
      browseBtn.classList.remove("open");
    });
  });

  async function selectFolder() {
    if (state.imports.length >= state.maxImports) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      return;
    }

    if ("showDirectoryPicker" in window) {
      try {
        const directoryHandle = await window.showDirectoryPicker();
        const files = [];

        async function scanEntries(handle, path = "") {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              const fullPath = path ? `${path}/${entry.name}` : entry.name;

              // Use Object.defineProperty to set 'webkitRelativePath' if supported
              try {
                Object.defineProperty(file, "webkitRelativePath", {
                  value: fullPath,
                  writable: true,
                  configurable: true,
                });
              } catch (e) {
                file.customPath = fullPath;
              }
              files.push(file);
            } else if (entry.kind === "directory") {
              await scanEntries(
                entry,
                path ? `${path}/${entry.name}` : entry.name,
              );
            }
          }
        }

        updateStatus("Scanning files from folder...");
        await scanEntries(directoryHandle);
        handleFiles(files, directoryHandle.name);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Directory picker error:", err);
          folderInput.click();
        }
      }
    } else {
      folderInput.click();
    }
  }

  if (fileInput) {
    fileInput.addEventListener("change", (event) =>
      handleFiles(event.target.files),
    );
  }

  if (folderInput) {
    folderInput.addEventListener("change", (event) =>
      handleFiles(event.target.files),
    );
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("dropzone-active");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (eventName === "drop") {
          handleFiles(event.dataTransfer.files);
        }
        dropzone.classList.remove("dropzone-active");
      });
    });
  }

  const CAPTURE_DELAY_MS = 2500;

  const getImportPayloadSize = (importItem) => {
    if (!importItem) return 0;
    const byTotal = Number(importItem.totalSize) || 0;
    if (byTotal > 0) return byTotal;
    return typeof importItem.rawHtml === "string" ? importItem.rawHtml.length : 0;
  };

  const getCaptureDelayMsForImport = (importItem) => {
    const payloadSize = getImportPayloadSize(importItem);
    if (payloadSize >= 200 * 1024 * 1024) return 15000;
    if (payloadSize >= 100 * 1024 * 1024) return 10000;
    if (payloadSize >= 50 * 1024 * 1024) return 7000;
    return CAPTURE_DELAY_MS;
  };

  const getCaptureApiWaitTimeoutMs = (importItem) => {
    const payloadSize = getImportPayloadSize(importItem);
    if (payloadSize >= 200 * 1024 * 1024) return 60000;
    if (payloadSize >= 100 * 1024 * 1024) return 45000;
    if (payloadSize >= 50 * 1024 * 1024) return 30000;
    return 15000;
  };

  const getSelectedImportsForAction = () => {
    const selected =
      state.selectedImportIds.size > 0
        ? state.imports.filter((item) => state.selectedImportIds.has(item.id))
        : [];
    return selected;
  };

  const buildCaptureHref = (captureUrl, importItem) => {
    const { width, height } = importItem
      ? getArtboardDimensions(importItem)
      : { width: 1440, height: 900 };
    const desiredInnerWidth = Math.max(320, Math.round(width));
    const desiredInnerHeight = Math.max(320, Math.round(height));
    const delayMs = getCaptureDelayMsForImport(importItem);

    return `${captureUrl}#figmacapture&figmadelay=${delayMs}&figmawidth=${desiredInnerWidth}&figmaheight=${desiredInnerHeight}`;
  };

  const openCapturePopup = (captureUrl, importItem = null) => {
    const targetImport = importItem || getActiveImport();
    const { width, height } = targetImport
      ? getArtboardDimensions(targetImport)
      : { width: 1440, height: 900 };
    const desiredInnerWidth = Math.max(320, Math.round(width));
    const desiredInnerHeight = Math.max(320, Math.round(height));

    const chromeWidth = Math.max(
      12,
      (window.outerWidth || 0) - (window.innerWidth || 0),
    );
    const chromeHeight = Math.max(
      96,
      (window.outerHeight || 0) - (window.innerHeight || 0),
    );

    const popupWidth = Math.max(
      360,
      Math.min(2600, desiredInnerWidth + chromeWidth),
    );
    const popupHeight = Math.max(
      420,
      Math.min(1800, desiredInnerHeight + chromeHeight),
    );

    // Place popup on the right side of the current machine/window area.
    const screenLeft = Number.isFinite(window.screen?.availLeft)
      ? window.screen.availLeft
      : typeof window.screenX === "number"
        ? window.screenX
        : window.screenLeft || 0;
    const screenTop = Number.isFinite(window.screen?.availTop)
      ? window.screen.availTop
      : typeof window.screenY === "number"
        ? window.screenY
        : window.screenTop || 0;
    const availWidth =
      window.screen?.availWidth || window.innerWidth || popupWidth;
    const availHeight =
      window.screen?.availHeight || window.innerHeight || popupHeight;
    const currentWindowRight =
      (typeof window.screenX === "number" ? window.screenX : screenLeft) +
      (window.outerWidth || availWidth);
    const rightGap = 24;
    const leftFromCurrentWindow = Math.round(
      currentWindowRight - popupWidth - rightGap,
    );
    const leftFromScreen = Math.round(
      screenLeft + availWidth - popupWidth - rightGap,
    );
    const left = Math.max(0, Math.max(leftFromCurrentWindow, leftFromScreen));
    const top = Math.max(
      0,
      Math.round(screenTop + (availHeight - popupHeight) / 2),
    );

    const popup = window.open(
      buildCaptureHref(captureUrl, targetImport),
      "code2design_capture_popup",
      `popup=yes,width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`,
    );

    if (popup) {
      try {
        popup.moveTo(left, top);
      } catch (_) {
        // Ignore browsers that block scripted window positioning.
      }

      let attempts = 0;
      const syncPopupInnerSize = () => {
        if (popup.closed || attempts >= 18) return;
        attempts += 1;
        try {
          const deltaW = Math.max(0, popup.outerWidth - popup.innerWidth);
          const deltaH = Math.max(0, popup.outerHeight - popup.innerHeight);
          const targetOuterW = Math.min(
            2600,
            Math.max(360, desiredInnerWidth + deltaW),
          );
          const targetOuterH = Math.min(
            1800,
            Math.max(420, desiredInnerHeight + deltaH),
          );
          popup.moveTo(left, top);
          popup.resizeTo(targetOuterW, targetOuterH);
        } catch (_) {
          // Ignore transient resize access errors while the popup initializes.
        }
        window.setTimeout(syncPopupInnerSize, 120);
      };
      window.setTimeout(syncPopupInnerSize, 90);
    }

    return popup;
  };

  const getLivePreviewSnapshotHtml = (importItem) => {
    if (!importItem?.frameEl) return null;
    try {
      const frameDoc =
        importItem.frameEl.contentDocument ||
        importItem.frameEl.contentWindow?.document;
      const frameWin = importItem.frameEl.contentWindow;
      const htmlRoot = frameDoc?.documentElement;
      if (!htmlRoot) return null;

      // Serialise the live DOM first.
      const rawSerialized = htmlRoot.outerHTML || "";
      if (!rawSerialized.trim()) return null;

      // If we can access the iframe's computed styles, walk the original
      // elements in parallel with a DOMParser clone and inline the critical
      // visual properties (opacity, visibility).  This preserves exactly what
      // the user sees in the artboard even after all scripts are stripped in
      // prepareHtmlForCapture, preventing elements from disappearing.
      if (frameWin?.getComputedStyle) {
        try {
          const parser = new DOMParser();
          const cloneDoc = parser.parseFromString(
            "<!DOCTYPE html>\n" + rawSerialized,
            "text/html",
          );
          const origEls = Array.from(htmlRoot.querySelectorAll("*"));
          const cloneEls = Array.from(cloneDoc.querySelectorAll("*"));
          const len = Math.min(origEls.length, cloneEls.length);
          for (let i = 0; i < len; i++) {
            const orig = origEls[i];
            const clone = cloneEls[i];
            if (!clone) continue;
            try {
              const cs = frameWin.getComputedStyle(orig);
              if (!cs || cs.display === "none") continue;
              const additions = [];
              // Only unhide fully-invisible elements (opacity≤0.02).
              // Never freeze a partial opacity like 0.3 — that is a
              // mid-animation value and would reduce the section's opacity
              // in the artboard after Convert Design is clicked.
              const op = parseFloat(cs.opacity);
              if (!isNaN(op) && op <= 0.02) additions.push("opacity:1");
              // Restore visibility:hidden only when it isn't an intentional
              // inline style (e.g. a tooltip that should stay hidden).
              const vis = cs.visibility;
              const inlineVis = (orig.style && orig.style.visibility) || "";
              if (vis === "hidden" && !inlineVis) additions.push("visibility:visible");
              if (additions.length) {
                const existing = (clone.getAttribute("style") || "").replace(
                  /;+$/,
                  "",
                );
                clone.setAttribute(
                  "style",
                  (existing ? existing + ";" : "") + additions.join(";"),
                );
              }
            } catch (_) {}
          }
          return "<!DOCTYPE html>\n" + cloneDoc.documentElement.outerHTML;
        } catch (_) {
          // Fall back to the raw serialised snapshot.
        }
      }

      return "<!DOCTYPE html>\n" + rawSerialized;
    } catch {
      // Cross-origin iframes cannot be read; fallback to stored raw HTML.
      return null;
    }
  };

  const prepareCaptureForImport = async (importItem) => {
    if (!importItem?.rawHtml) return null;

    const prevAssetBlobs = state.assetBlobs;
    try {
      state.assetBlobs = importItem.assetBlobs || new Map();
      const liveSnapshotHtml =
        importItem.sourceKind === "url"
          ? getLivePreviewSnapshotHtml(importItem)
          : null;
      const sourceHtmlForCapture = liveSnapshotHtml || importItem.rawHtml;

      // Always preserve scripts so the capture popup (and preview) stays
      // interactive / dynamic.  AI-generated files rely on JS for tabs,
      // navigation, menus, etc.  The fast-path (prepareHtmlForCaptureFast)
      // already keeps scripts; this makes the DOM-path consistent.
      const preparedHtml = await prepareHtmlForCapture(
        sourceHtmlForCapture,
        false,
        importItem,
        { preserveScripts: true },
      );

      if (importItem.captureUrl) {
        URL.revokeObjectURL(importItem.captureUrl);
      }

      const _isLargeHtml = typeof preparedHtml === "string" && preparedHtml.length > MAX_SNAPSHOT_HTML_LENGTH;
      importItem.captureUrl = URL.createObjectURL(
        new Blob([preparedHtml], { type: "text/html" }),
      );
      // For large files drop the preparedHtml string from the item after the
      // blob is created — the blob URL is all that's needed for the popup.
      importItem.preparedHtml = _isLargeHtml ? "" : preparedHtml;
      importItem.isFrameReady = true;

      if (importItem.id === state.activeImportId) {
        state.preparedHtml = _isLargeHtml ? "" : preparedHtml;
        state.captureUrl = importItem.captureUrl;
        state.isFrameReady = true;
      }

      // For large imports return the captureUrl (blob URL) so the caller can
      // load the preview frame from the blob instead of the huge HTML string.
      return _isLargeHtml ? importItem.captureUrl : preparedHtml;
    } finally {
      state.assetBlobs = prevAssetBlobs;
    }
  };

  if (convertButton) {
    convertButton.addEventListener("click", async () => {
      syncStateFromActiveImport();

      const targetImports = getSelectedImportsForAction().filter(
        (item) => item?.rawHtml,
      );

      if (targetImports.length === 0) {
        updateStatus(
          state.imports.length > 0
            ? "Select an artboard before converting."
            : "Load an HTML file before converting.",
          "warning",
        );
        return;
      }

      // If already converted, re-generate blob to ensure latest width/options and then open
      if (state.isFrameReady && state.rawHtml) {
        try {
          updateStatus(
            targetImports.length > 1
              ? `Opening ${targetImports.length} capture tabs…`
              : "Updating capture data...",
          );

          const popupSlots = targetImports.map((item) =>
            openCapturePopup("about:blank", item),
          );

          for (let index = 0; index < targetImports.length; index += 1) {
            const item = targetImports[index];
            await prepareCaptureForImport(item);
            const popup = popupSlots[index];
            if (popup && !popup.closed) {
              popup.location.replace(buildCaptureHref(item.captureUrl, item));
            }
          }

          persistActiveImportState();

          const blockedCount = popupSlots.filter((popup) => !popup).length;
          if (blockedCount > 0) {
            updateStatus(
              "Popup blocked! Allow popups and try again.",
              "warning",
            );
          } else {
            updateStatus(
              targetImports.length > 1
                ? `${targetImports.length} capture tabs opened.`
                : "Capture window opened.",
              "success",
            );
          }
        } catch (e) {
          console.error(e);
          updateStatus("Failed to update capture data.", "warning");
        }
        return;
      }

      updateStatus("Converting design…");
      convertButton.disabled = true;
      copyButton.hidden = true;
      state.isFrameReady = false;

      try {
        const perImportStats = new Map();
        targetImports.forEach((item) => {
          const stats = analyzeHtml(item.rawHtml || "");
          perImportStats.set(item.id, stats);
          item.conversionStats = stats;
        });

        renderStats(
          Array.from(perImportStats.values()).reduce(
            (acc, stat) => {
              acc.frames += stat.frames;
              acc.text += stat.text;
              acc.image += stat.image;
              acc.container += stat.container;
              return acc;
            },
            { frames: 0, text: 0, image: 0, container: 0 },
          ),
        );

        const activeImport = getActiveImport();
        const shouldLoadPreparedIntoCanvas =
          activeImport?.sourceKind !== "url";
        let activePreparedHtml = null;
        for (const item of targetImports) {
          const prepared = await prepareCaptureForImport(item);
          if (activeImport && item.id === activeImport.id) {
            activePreparedHtml = prepared;
          }
        }

        if (!activePreparedHtml && activeImport?.rawHtml) {
          activePreparedHtml = await prepareCaptureForImport(activeImport);
        }

        // Show preview immediately for visual feedback. Every artboard is
        // already visible from the moment it's created (see
        // createCanvasPreviewElement), so this only needs to mark the
        // active one as selected — it must NOT touch every import's
        // visibility, since that previously force-revealed unrelated/stale
        // artboards the moment Convert Design was clicked.
        if (canvasPreview) {
          canvasPreview.classList.add("visible");
          canvasPreview.classList.add("selected");
        }
        applySelectionClasses();

        const activePreviewSource =
          activeImport?.sourceKind === "url"
            ? activeImport.captureUrl || activePreparedHtml
            : activePreparedHtml;

        if (activePreviewSource && shouldLoadPreparedIntoCanvas) {
          // For large files prepareCaptureForImport returns the blob URL (string
          // starting with "blob:") instead of the full HTML to avoid OOM on
          // the srcdoc attribute. URL imports also force blob-mode because
          // some browsers render complex srcdoc previews as blank after convert.
          await loadPreviewFrame(activePreviewSource);
        }
        if (shouldLoadPreparedIntoCanvas) {
          await waitForCaptureApi(
            getCaptureApiWaitTimeoutMs(activeImport || targetImports[0] || null),
          );
        }
        state.isFrameReady = true;
        persistActiveImportState();

        if (window.autoSaveFile) {
          const captureHtmlForSave =
            activeImport?.preparedHtml || activePreparedHtml || state.preparedHtml;
          window.autoSaveFile(
            "Capture.html",
            captureHtmlForSave,
            "File-convert",
          );
        }

        showToast(
          "Design Conversion ready",
          "Use modern UI use our theme",
          "success",
        );

        // Step 1 COMPLETE: Update UI for Step 2
        updateStatus(
          targetImports.length > 1
            ? `${targetImports.length} artboards converted. Ready to open Figma.`
            : "Design converted. Ready to open Figma.",
          "success",
        );
        convertButton.classList.add("ready");
        convertButton.querySelector("img").src = "assets/icon/icon-copy.svg";
        convertButton.querySelector("span").textContent = "Copy to figma";
        convertButton.disabled = false;
        syncConversionSummaryForSelection();
      } catch (error) {
        console.error(error);
        updateStatus(error.message || "Conversion failed.", "warning");
        convertButton.disabled = false;
      }
    });
  }

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      syncStateFromActiveImport();

      const targetImports = getSelectedImportsForAction().filter(
        (item) => item?.rawHtml,
      );

      if (targetImports.length === 0 || !state.isFrameReady) {
        updateStatus("Convert the design before copying.", "warning");
        return;
      }

      updateStatus(
        targetImports.length > 1
          ? `Opening ${targetImports.length} capture tabs…`
          : "Opening capture window…",
      );
      copyButton.disabled = true;

      try {
        const popupSlots = targetImports.map((item) =>
          openCapturePopup("about:blank", item),
        );

        for (let index = 0; index < targetImports.length; index += 1) {
          const item = targetImports[index];
          await prepareCaptureForImport(item);
          const popup = popupSlots[index];
          if (popup && !popup.closed) {
            popup.location.replace(buildCaptureHref(item.captureUrl, item));
          }
        }

        persistActiveImportState();

        const blockedCount = popupSlots.filter((popup) => !popup).length;
        if (blockedCount > 0) {
          throw new Error(
            "Popup was blocked. Allow popups for this page and try again.",
          );
        }

        updateStatus(
          targetImports.length > 1
            ? `${targetImports.length} capture tabs opened. Wait for success toast, then paste in Figma.`
            : "Capture window opened. Wait for the success toast there, then paste inside Figma.",
          "success",
        );
      } catch (error) {
        console.error(error);
        updateStatus(
          error.message || "Unable to open the capture window.",
          "warning",
        );
      } finally {
        copyButton.disabled = false;
      }
    });
  }

  window.loadAppFiles = handleFiles;
  window._getImportCount = () => state.imports.length;
  async function handleFiles(fileList, customFolderName = "") {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    let groupedEntries = [];

    if (customFolderName) {
      groupedEntries = [{ files, folderName: customFolderName }];
    } else if (
      files.some((f) => Boolean(f.webkitRelativePath || f.customPath))
    ) {
      const groups = new Map();
      files.forEach((file) => {
        const relPath = file.webkitRelativePath || file.customPath || file.name;
        const root = relPath.includes("/")
          ? relPath.split("/")[0]
          : "__single__";
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(file);
      });

      groupedEntries = Array.from(groups.entries()).map(
        ([root, groupFiles]) => ({
          files: groupFiles,
          folderName: root === "__single__" ? "" : root,
        }),
      );
    } else if (files.length > 1) {
      groupedEntries = files.map((file) => ({ files: [file], folderName: "" }));
    } else {
      groupedEntries = [{ files, folderName: "" }];
    }

    const availableSlots = state.maxImports - state.imports.length;
    if (groupedEntries.length > availableSlots) {
      showToast(
        "Limit reached",
        "You can only import up to 5 files or folders",
        "warning",
      );
      updateStatus("You can only import up to 5 files or folders", "warning");
      return;
    }

    const createdItems = [];
    for (const entry of groupedEntries) {
      const item = await createImportItemFromFiles(
        entry.files,
        entry.folderName || "",
      );
      if (item) {
        createdItems.push(item);
        if (window.autoSaveFile && item.file && !window._isRestoringFromFolder) {
          window.autoSaveFile(item.file.name, item.rawHtml, "File-convert");
        }
      }
    }

    if (createdItems.length === 0) {
      updateStatus("No HTML file found in selection.", "warning");
      showToast("Import failed", "No HTML file found in selection.", "warning");
      return;
    }

    await appendImportItems(createdItems);

    const summarySection = document.getElementById("summarySection");
    if (summarySection) summarySection.classList.remove("hidden");

    resetStats();
    updateStylesPanel();

    // Allow re-selecting the same file/folder again in subsequent imports.
    if (fileInput) fileInput.value = "";
    if (folderInput) folderInput.value = "";
  }

  // ── URL Convert (Fetch Site) ──────────────────────────────────────
  (function initUrlConvert() {
    const urlInput = document.getElementById("urlInput");
    const fetchSiteBtn = document.getElementById("fetchSiteBtn");
    if (!urlInput || !fetchSiteBtn) return;

    // Note: "htmlpreview.github.io" and "cors-anywhere.herokuapp.com" were
    // previously listed here but are not viable generic CORS proxies for
    // arbitrary sites: htmlpreview.github.io only proxies HTML files already
    // hosted on GitHub (raw.githubusercontent.com), not arbitrary URLs, so it
    // fails for every real-world fetch here; cors-anywhere.herokuapp.com's
    // public demo has required manually requesting temporary per-IP access
    // since 2021 and returns 403 for everyone else. Both silently burned a
    // full timeout on every single fetch attempt for no chance of success.
    const CORS_PROXIES = [
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
    ];
    // Use the shared Firebase service from Settings (same auth instance).
    function ensureFirebaseUrlBetaCreditServicePromise() {
      return getSettingsFirebaseUrlBetaService();
    }

    async function getRemainingUrlBetaCredits() {
      let isSignedIn = false;
      try {
        const service = await ensureFirebaseUrlBetaCreditServicePromise();
        if (!service?.enabled) return null;

        isSignedIn = Boolean(
          typeof service.ensureSignedIn === "function"
            ? await service.ensureSignedIn({ interactive: false })
            : false,
        );
        if (!isSignedIn) return null;

        try {
          const remaining = await service.getRemaining();
          if (Number.isFinite(remaining)) {
            return Math.max(0, remaining);
          }
        } catch (readErr) {
          console.warn("[URL Beta] getRemaining read failed:", readErr);
        }
        // Signed in but doc read failed or doc doesn't exist yet → full limit.
        return URL_BETA_DAILY_LIMIT;
      } catch (err) {
        console.warn("[URL Beta] getRemainingUrlBetaCredits error:", err);
        // If we confirmed sign-in, still enable the button.
        if (isSignedIn) return URL_BETA_DAILY_LIMIT;
        return null;
      }
    }

    async function ensureUrlBetaUserSignedIn() {
      let service = null;
      try {
        service = await ensureFirebaseUrlBetaCreditServicePromise();
        if (service?.enabled && typeof service.ensureSignedIn === "function") {
          const ok = Boolean(await service.ensureSignedIn({ interactive: true }));
          if (ok) return { ok: true, errorCode: "", errorMessage: "" };
          const authError =
            typeof service.getLastAuthError === "function"
              ? service.getLastAuthError()
              : null;
          return {
            ok: false,
            errorCode: String(authError?.code || "auth/unknown"),
            errorMessage: String(authError?.message || ""),
          };
        }
        return {
          ok: false,
          errorCode: "firebase-disabled",
          errorMessage: `Firebase URL Beta service is disabled (${String(service?.reason || "unknown")}).`,
        };
      } catch {
        if (service?.enabled) {
          return {
            ok: false,
            errorCode: "firebase-error",
            errorMessage: "Firebase sign-in failed.",
          };
        }
        return {
          ok: false,
          errorCode: "firebase-error",
          errorMessage: "Firebase sign-in failed.",
        };
      }
    }

    async function consumeUrlBetaCredit() {
      let service = null;
      try {
        service = await ensureFirebaseUrlBetaCreditServicePromise();
        if (service?.enabled) {
          const result = await service.consumeOne();
          if (!result?.allowed) {
            return {
              allowed: false,
              remaining: Number.isFinite(result?.remaining)
                ? Math.max(0, Number(result.remaining) || 0)
                : null,
              reason: result?.reason || "limit-reached",
            };
          }
          if (Number.isFinite(result?.remaining)) {
            return {
              allowed: true,
              remaining: Math.max(0, Number(result.remaining) || 0),
            };
          }
          const current = await getRemainingUrlBetaCredits();
          return { allowed: true, remaining: current };
        }
        return {
          allowed: false,
          remaining: null,
          reason: "firebase-disabled",
        };
      } catch {
        if (service?.enabled) {
          return {
            allowed: false,
            remaining: null,
            reason: "firebase-error",
          };
        }
        return {
          allowed: false,
          remaining: null,
          reason: "firebase-error",
        };
      }
    }

    function applyFetchSiteBtnState(remaining) {
      const labelEl = fetchSiteBtn.querySelector("span");
      const isLoading = fetchSiteBtn.classList.contains("is-loading");

      if (remaining === null) {
        fetchSiteBtn.title = "Please sign in to use this feature";
        if (!isLoading) {
          fetchSiteBtn.disabled = true;
        }
        if (labelEl && !isLoading) {
          labelEl.textContent = "Fetch Site";
        }
        return;
      }

      if (remaining <= 0) {
        fetchSiteBtn.title = `Daily limit reached (${URL_BETA_DAILY_LIMIT}/${URL_BETA_DAILY_LIMIT}). Try again tomorrow.`;
        if (!isLoading) {
          fetchSiteBtn.disabled = true;
        }
        if (labelEl && !isLoading) {
          labelEl.textContent = `Fetch Site (0 left)`;
        }
        return;
      }

      fetchSiteBtn.title = `URL Beta: ${remaining}/${URL_BETA_DAILY_LIMIT} left today`;
      if (!isLoading) {
        fetchSiteBtn.disabled = false;
      }
      if (labelEl && !isLoading) {
        labelEl.textContent = `Fetch Site (${remaining} left)`;
      }
    }

    async function updateUrlBetaCreditUi() {
      const remaining = await getRemainingUrlBetaCredits();
      applyFetchSiteBtnState(remaining);
    }

    function extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    }

    function parseSourceUrlParts(sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        return {
          baseHref: `${parsed.origin}${parsed.pathname}${parsed.search}`,
          hash: parsed.hash || "",
        };
      } catch {
        return {
          baseHref: sourceUrl,
          hash: "",
        };
      }
    }

    function normalizeFetchedHtml(rawHtml, sourceUrl) {
      if (!rawHtml) return rawHtml;

      const toAbsoluteUrl = (value, baseHref) => {
        const raw = String(value || "").trim();
        if (!raw) return raw;
        if (
          raw.startsWith("#") ||
          raw.startsWith("data:") ||
          raw.startsWith("blob:") ||
          raw.startsWith("javascript:") ||
          raw.startsWith("mailto:") ||
          raw.startsWith("tel:") ||
          raw.startsWith("about:")
        ) {
          return raw;
        }
        try {
          return new URL(raw, baseHref).href;
        } catch {
          return raw;
        }
      };

      const absolutizeCssUrls = (cssText, baseHref) =>
        String(cssText || "").replace(
          /url\((['"]?)([^'"\)]*)\1\)/g,
          (match, quote, innerUrl) => {
            const absolute = toAbsoluteUrl(innerUrl, baseHref);
            if (!absolute || absolute === innerUrl) return match;
            const q = quote || '"';
            return `url(${q}${absolute}${q})`;
          },
        );

      try {
        const { baseHref, hash } = parseSourceUrlParts(sourceUrl);
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, "text/html");

        if (!doc.head) {
          doc.documentElement.insertBefore(
            doc.createElement("head"),
            doc.body || null,
          );
        }

        const existingBase = doc.head.querySelector("base");
        if (!existingBase) {
          const baseEl = doc.createElement("base");
          baseEl.setAttribute("href", baseHref);
          doc.head.insertBefore(baseEl, doc.head.firstChild || null);
        } else if (!existingBase.getAttribute("href")) {
          existingBase.setAttribute("href", baseHref);
        }

        if (hash) {
          const hashBootstrapId = "c2d-hash-bootstrap";
          let hashBootstrap = doc.getElementById(hashBootstrapId);
          if (!hashBootstrap) {
            hashBootstrap = doc.createElement("script");
            hashBootstrap.id = hashBootstrapId;
            const safeHash = JSON.stringify(hash);
            hashBootstrap.textContent = `try { if (window.location.hash !== ${safeHash}) { window.location.hash = ${safeHash}; } } catch (_) {}`;
            doc.head.insertBefore(hashBootstrap, doc.head.firstChild || null);
          }
        }

        ["src", "href", "poster", "action"].forEach((attr) => {
          doc.querySelectorAll(`[${attr}]`).forEach((el) => {
            const value = el.getAttribute(attr);
            if (!value) return;
            const absolute = toAbsoluteUrl(value, baseHref);
            if (absolute && absolute !== value) el.setAttribute(attr, absolute);
          });
        });

        const absolutizeSrcset = (srcsetValue, base) => {
          return String(srcsetValue || "")
            .split(",")
            .map((candidate) => {
              const part = candidate.trim();
              if (!part) return part;
              const pieces = part.split(/\s+/);
              const absoluteUrl = toAbsoluteUrl(pieces[0], base);
              if (!absoluteUrl) return part;
              return [absoluteUrl, ...pieces.slice(1)].join(" ").trim();
            })
            .join(", ");
        };

        doc.querySelectorAll("[srcset]").forEach((el) => {
          const value = el.getAttribute("srcset");
          if (!value) return;
          const absoluteSrcset = absolutizeSrcset(value, baseHref);
          if (absoluteSrcset && absoluteSrcset !== value) {
            el.setAttribute("srcset", absoluteSrcset);
          }
        });

        doc.querySelectorAll("[style]").forEach((el) => {
          const styleValue = el.getAttribute("style");
          if (!styleValue) return;
          el.setAttribute("style", absolutizeCssUrls(styleValue, baseHref));
        });

        doc.querySelectorAll("style").forEach((styleTag) => {
          styleTag.textContent = absolutizeCssUrls(
            styleTag.textContent || "",
            baseHref,
          );
        });

        return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      } catch {
        return rawHtml;
      }
    }

    function buildStaticUrlPreviewHtml(rawHtml, sourceUrl) {
      if (!rawHtml) return rawHtml;
      try {
        const { baseHref } = parseSourceUrlParts(sourceUrl);
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, "text/html");

        if (!doc.head) {
          doc.documentElement.insertBefore(
            doc.createElement("head"),
            doc.body || null,
          );
        }

        const existingBase = doc.head.querySelector("base");
        if (!existingBase) {
          const baseEl = doc.createElement("base");
          baseEl.setAttribute("href", baseHref);
          doc.head.insertBefore(baseEl, doc.head.firstChild || null);
        } else if (!existingBase.getAttribute("href")) {
          existingBase.setAttribute("href", baseHref);
        }

        // Keep static visual structure for preview stability.
        doc.querySelectorAll("script").forEach((script) => script.remove());
        doc
          .querySelectorAll('meta[http-equiv="refresh"], meta[http-equiv="Refresh"]')
          .forEach((meta) => meta.remove());
        doc.querySelectorAll("img[loading]").forEach((img) => {
          img.setAttribute("loading", "eager");
        });

        return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      } catch {
        return rawHtml;
      }
    }

    function shouldUseDirectRoutePreview(rawHtml, sourceUrl) {
      const { hash } = parseSourceUrlParts(sourceUrl);
      if (!hash) return false;

      const body = String(rawHtml || "");
      if (!body) return false;

      const loginOrDemoSignals = [
        /AppsHome\.do\?LogoutFromSSO=true/i,
        /<title>\s*ADAudit\s*Plus\s*\|\s*Demo\s*<\/title>/i,
        /name=["']j_username["']/i,
        /name=["']j_password["']/i,
      ];

      return loginOrDemoSignals.some((pattern) => pattern.test(body));
    }

    function openLiveRoutePopup(sourceUrl) {
      const popupWidth = 1440;
      const popupHeight = 900;
      const screenLeft = Number.isFinite(window.screen?.availLeft)
        ? window.screen.availLeft
        : typeof window.screenX === "number"
          ? window.screenX
          : window.screenLeft || 0;
      const screenTop = Number.isFinite(window.screen?.availTop)
        ? window.screen.availTop
        : typeof window.screenY === "number"
          ? window.screenY
          : window.screenTop || 0;
      const availWidth = window.screen?.availWidth || window.innerWidth || popupWidth;
      const availHeight =
        window.screen?.availHeight || window.innerHeight || popupHeight;
      const left = Math.max(0, Math.round(screenLeft + (availWidth - popupWidth) / 2));
      const top = Math.max(0, Math.round(screenTop + (availHeight - popupHeight) / 2));

      return window.open(
        sourceUrl,
        "code2design_live_route_popup",
        `popup=yes,width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=yes,status=yes`,
      );
    }

    function applyReliableUrlPreview(frameEl, liveHtml, staticHtml) {
      if (!frameEl) return;

      const pickFallbackHtml = () => {
        const candidate = String(staticHtml || "");
        if (!candidate.trim()) return liveHtml || "";
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(candidate, "text/html");
          const body = doc.body;
          if (!body) return liveHtml || "";
          const textLength = (body.textContent || "").trim().length;
          const structuralNodes = body.querySelectorAll(
            "img, svg, canvas, video, picture, iframe, object, embed, section, main, article, div, header, footer, nav, aside",
          ).length;
          // If static snapshot is nearly empty (common for JS-rendered SPAs),
          // use live HTML instead of blank-looking fallback.
          if (textLength === 0 && structuralNodes < 2) {
            return liveHtml || "";
          }
          return candidate;
        } catch {
          return liveHtml || candidate || "";
        }
      };

      const fallbackHtml = pickFallbackHtml();

      let fallbackApplied = false;
      const applyFallback = () => {
        if (fallbackApplied) return;
        fallbackApplied = true;
        frameEl.srcdoc = fallbackHtml;
      };

      // Last-resort: if srcdoc preview is still blank after all retries,
      // try loading the real URL directly in the iframe so the browser can
      // render the site natively (works for sites without X-Frame-Options).
      let directUrlTriggered = false;
      const tryDirectUrl = (originalUrl) => {
        if (directUrlTriggered || !originalUrl) return;
        directUrlTriggered = true;
        try {
          frameEl.removeAttribute("srcdoc");
          frameEl.src = originalUrl;
        } catch (_) {}
      };

      const verifyLivePreview = (originalUrl) => {
        if (fallbackApplied && directUrlTriggered) return;
        try {
          const win = frameEl.contentWindow;
          const doc = frameEl.contentDocument || win?.document;

          if (!doc?.body) {
            if (!fallbackApplied) applyFallback();
            return;
          }

          if (doc.readyState === "loading") {
            return;
          }

          const textLength = (doc.body.innerText || "").trim().length;
          const visualNodes = doc.body.querySelectorAll(
            "img, svg, canvas, video, picture, iframe, object, embed, section, main, article, div, header, footer, nav, aside",
          ).length;

          // Only consider truly blank: no text AND fewer than 3 structural
          // nodes. This avoids false-positives on SPA shells that have
          // wrapper divs but haven't rendered their content yet.
          if (textLength === 0 && visualNodes < 3) {
            if (!fallbackApplied) {
              applyFallback();
            } else {
              // Fallback html was also blank — try direct URL as last resort.
              tryDirectUrl(originalUrl);
            }
          }
        } catch {
          // Cross-origin: try fallback then direct URL.
          if (!fallbackApplied) {
            applyFallback();
          } else {
            tryDirectUrl(originalUrl);
          }
        }
      };

      // Capture originalUrl from closure for direct-URL recovery.
      const sourceUrl = (() => {
        try { return new URL(frameEl.ownerDocument?.defaultView?.location?.href || "").href; } catch { return ""; }
      })();

      frameEl.onload = () => {
        window.setTimeout(() => verifyLivePreview(frameEl.__c2dSourceUrl || ""), 600);
        window.setTimeout(() => verifyLivePreview(frameEl.__c2dSourceUrl || ""), 1800);
      };

      frameEl.srcdoc = liveHtml || "";
      window.setTimeout(() => verifyLivePreview(frameEl.__c2dSourceUrl || ""), 2600);
    }

    async function fetchWithProxies(url, onProgress) {
      const SERVER_PROXY_TIMEOUT_MS = 25000;
      const DIRECT_FETCH_TIMEOUT_MS = 7000;
      // 10s per proxy (was 22s): with 4 proxies, a fully-down worst case now
      // fails in ~40s instead of ~88s, and the previous 6-proxy list (with
      // 2 broken entries) could take over 2 minutes before ever reporting
      // failure — which looked indistinguishable from "not loading" at all.
      const PROXY_TIMEOUT_MS = 10000;
      const failures = [];

      const isUsableHtmlPayload = (payload, contentType = "") => {
        const text = String(payload || "").trim();
        if (!text) return false;
        if (text.length > 512) return true;

        const lower = text.toLowerCase();
        const hasHtmlShape =
          lower.includes("<!doctype html") ||
          lower.includes("<html") ||
          lower.includes("<head") ||
          lower.includes("<body") ||
          lower.includes("<main") ||
          lower.includes("<div");

        if (!hasHtmlShape) return false;

        const type = String(contentType || "").toLowerCase();
        if (type.includes("text/html") || type.includes("application/xhtml+xml")) {
          return text.length >= 120 || hasHtmlShape;
        }

        return hasHtmlShape;
      };

      // Try our own server-side fetch endpoint first (Vercel serverless
      // function, see /api/fetch-site.js). It's same-origin from the
      // browser's perspective (no CORS involved at all) and doesn't depend
      // on any public proxy's uptime. On static/local hosting or a
      // deployment without this function, it 404s immediately and we fall
      // through to the direct-fetch/public-proxy chain below exactly as
      // before.
      try {
        if (typeof onProgress === "function") {
          onProgress({ phase: "proxy", index: 0, total: CORS_PROXIES.length });
        }
        const serverRes = await fetch(
          `/api/fetch-site?url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(SERVER_PROXY_TIMEOUT_MS) },
        );
        const serverType = serverRes.headers.get("content-type") || "";
        const serverText = await serverRes.text();
        if (isUsableHtmlPayload(serverText, serverType)) {
          if (typeof onProgress === "function") {
            onProgress({ phase: "downloaded" });
          }
          return serverText;
        }
        if (serverRes.status !== 404) {
          failures.push(`server proxy: HTTP ${serverRes.status}`);
        } else {
          failures.push("server proxy: empty/non-html response");
        }
        // A 404 means the function isn't deployed here — not worth
        // reporting as a failure, just fall through silently.
      } catch (serverError) {
        failures.push(`server proxy: ${serverError?.name === "TimeoutError" ? "timed out" : serverError?.message || "unavailable"}`);
      }

      // Next, try a direct, no-proxy fetch. Most sites don't send
      // Access-Control-Allow-Origin and this will reject almost immediately,
      // but some (permissive APIs, static hosts, GitHub Pages, etc.) do —
      // when it works it's faster and doesn't depend on any third-party
      // proxy's uptime at all, so it's worth the cheap attempt.
      try {
        if (typeof onProgress === "function") {
          onProgress({ phase: "proxy", index: 0, total: CORS_PROXIES.length });
        }
        const directRes = await fetch(url, {
          mode: "cors",
          signal: AbortSignal.timeout(DIRECT_FETCH_TIMEOUT_MS),
        });
        if (directRes.ok) {
          const directType = directRes.headers.get("content-type") || "";
          const directText = await directRes.text();
          if (isUsableHtmlPayload(directText, directType)) {
            if (typeof onProgress === "function") {
              onProgress({ phase: "downloaded" });
            }
            return directText;
          }
          failures.push("direct: empty/non-html response");
        } else {
          failures.push(`direct: HTTP ${directRes.status}`);
        }
      } catch (directError) {
        failures.push(`direct: ${directError?.name === "TimeoutError" ? "timed out" : directError?.message || "blocked (no CORS)"}`);
      }

      for (let index = 0; index < CORS_PROXIES.length; index += 1) {
        const proxy = CORS_PROXIES[index];
        if (typeof onProgress === "function") {
          onProgress({
            phase: "proxy",
            index: index + 1,
            total: CORS_PROXIES.length,
          });
        }
        try {
          const res = await fetch(proxy(url), {
            signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
          });
          if (res.ok) {
            const proxyType = res.headers.get("content-type") || "";
            const text = await res.text();
            // Skip proxy responses that are themselves error/blocked pages
            // (some proxies return 200 with an HTML error body).
            if (isUsableHtmlPayload(text, proxyType)) {
              if (typeof onProgress === "function") {
                onProgress({ phase: "downloaded" });
              }
              return text;
            }
            failures.push(`proxy ${index + 1}: empty/non-html response`);
          } else {
            failures.push(`proxy ${index + 1}: HTTP ${res.status}`);
          }
        } catch (proxyError) {
          failures.push(`proxy ${index + 1}: ${proxyError?.name === "TimeoutError" ? "timed out" : proxyError?.message || "network error"}`);
        }
      }
      const error = new Error(
        `All proxies failed to fetch this site (${failures.join("; ")}).`,
      );
      error.proxyFailures = failures;
      throw error;
    }

    async function handleFetchSite() {
      let url = (urlInput.value || "").trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;

      try {
        new URL(url);
      } catch {
        showToast("Invalid URL", "Please enter a valid URL.", "warning");
        return;
      }

      if (state.imports.length >= state.maxImports) {
        showToast(
          "Limit reached",
          "You can only import up to 5 files or folders",
          "warning",
        );
        return;
      }

      const signInResult = await ensureUrlBetaUserSignedIn();
      if (!signInResult?.ok) {
        await updateUrlBetaCreditUi();
        const errorCode = String(signInResult?.errorCode || "");
        let message =
          "Please sign in to use this feature.";

        if (errorCode === "auth/unauthorized-domain") {
          message =
            "Google sign-in blocked: this domain is not authorized in Firebase Auth. Add localhost and your deploy domain in Firebase Console > Authentication > Settings > Authorized domains.";
        } else if (errorCode === "auth/redirect-started") {
          message =
            "Redirect sign-in started. Complete Google sign-in in this tab and retry after returning.";
        } else if (
          errorCode === "auth/popup-blocked" ||
          errorCode === "auth/popup-closed-by-user" ||
          errorCode === "auth/cancelled-popup-request"
        ) {
          message =
            "Popup sign-in was blocked. Allow popups for this site and try again. Redirect sign-in may have started in this tab.";
        } else if (errorCode) {
          const authErrorMessage = String(signInResult?.errorMessage || "");
          message += ` (${errorCode}${authErrorMessage ? `: ${authErrorMessage}` : ""})`;
        }

        showToast(
          "Sign in required",
          message,
          "warning",
        );
        return;
      }

      let remainingBeforeFetch = await getRemainingUrlBetaCredits();

      if (remainingBeforeFetch <= 0) {
        await updateUrlBetaCreditUi();
        showToast(
          "Daily limit reached",
          `Daily limit reached (${URL_BETA_DAILY_LIMIT}/${URL_BETA_DAILY_LIMIT}). Try again tomorrow.`,
          "warning",
        );
        return;
      }

      fetchSiteBtn.disabled = true;
      fetchSiteBtn.classList.add("is-loading");
      const labelEl = fetchSiteBtn.querySelector("span");
      let progressValue = 3;
      let progressLabel = "Fetching";

      const renderButtonProgress = () => {
        if (!labelEl) return;
        const pct = Math.max(0, Math.min(99, Math.round(progressValue)));
        labelEl.textContent = `${progressLabel} ${pct}%`;
      };

      const setButtonProgress = (nextValue, nextLabel = progressLabel) => {
        progressValue = Math.max(progressValue, Number(nextValue) || 0);
        progressLabel = nextLabel || progressLabel;
        renderButtonProgress();
      };

      renderButtonProgress();
      const progressPulseTimer = window.setInterval(() => {
        if (progressValue < 92) {
          progressValue += 1;
          renderButtonProgress();
        }
      }, 240);

      try {
        const fetchedHtml = await fetchWithProxies(url, (progress) => {
          if (!progress) return;
          if (progress.phase === "proxy") {
            const total = Math.max(1, progress.total || 1);
            const index = Math.max(1, progress.index || 1);
            const pct = 8 + (index / total) * 48;
            setButtonProgress(pct, "Fetching");
            return;
          }
          if (progress.phase === "downloaded") {
            setButtonProgress(62, "Processing");
          }
        });
        if (!fetchedHtml || fetchedHtml.trim().length === 0) {
          showToast(
            "Fetch failed",
            "Received empty response from site.",
            "warning",
          );
          return;
        }

        setButtonProgress(72, "Processing");
        const html = normalizeFetchedHtml(fetchedHtml, url);
        setButtonProgress(82, "Rendering");
        const staticPreviewHtml = buildStaticUrlPreviewHtml(html, url);

        const domain = extractDomain(url);
        const sizeBytes = new Blob([html]).size;
        const fileName = domain.replace(/[^a-z0-9.-]/gi, "_") + ".html";
        const file = new File([html], fileName, { type: "text/html" });

        const previewEl = createCanvasPreviewElement();
        const frameEl = previewEl.querySelector("iframe");
        const directRoutePreview = shouldUseDirectRoutePreview(fetchedHtml, url);
        const initWidth =
          (viewportWidthInput && parseInt(viewportWidthInput.value, 10)) ||
          1440;
        const initHeight =
          (viewportHeightInput && parseInt(viewportHeightInput.value, 10)) ||
          900;
        previewEl.style.width = `${initWidth}px`;
        previewEl.style.height = `${initHeight}px`;
        if (frameEl) {
          frameEl.style.width = "100%";
          frameEl.style.height = "100%";
          frameEl.__c2dSourceUrl = url;
          if (directRoutePreview) {
            frameEl.removeAttribute("srcdoc");
            frameEl.src = url;
          } else {
            applyReliableUrlPreview(frameEl, html, staticPreviewHtml);
          }
        }

        const item = {
          id: state.nextImportId++,
          type: "file",
          sourceKind: "url",
          sourceUrl: url,
          displayName: domain,
          file,
          rawHtml: html,
          preparedHtml: "",
          isFrameReady: false,
          conversionStats: null,
          captureUrl: "",
          totalSize: sizeBytes,
          assetBlobs: new Map(),
          artboardX: 0,
          artboardY: 0,
          targetArtboardX: 0,
          targetArtboardY: 0,
          previewEl,
          frameEl,
        };

        item.previewEl.dataset.importId = String(item.id);
        if (canvasContainer) canvasContainer.appendChild(item.previewEl);

        setButtonProgress(90, "Rendering");
        await appendImportItems([item]);
        setButtonProgress(96, "Finishing");

        const creditConsumeResult = await consumeUrlBetaCredit();
        if (!creditConsumeResult.allowed) {
          await updateUrlBetaCreditUi();
          if (
            creditConsumeResult.reason === "auth-required" ||
            creditConsumeResult.reason === "firebase-error" ||
            creditConsumeResult.reason === "firebase-disabled"
          ) {
            const authCode = String(creditConsumeResult.authErrorCode || "");
            const authMessage = String(creditConsumeResult.authErrorMessage || "");
            let signInMessage =
              "Please sign in with Google to continue using URL Beta. If popup is blocked, allow popups.";
            if (authCode === "auth/unauthorized-domain") {
              signInMessage =
                "Google sign-in blocked: this domain is not authorized in Firebase Auth. Add localhost and your deploy domain in Firebase Console > Authentication > Settings > Authorized domains.";
            } else if (authCode) {
              signInMessage += ` (${authCode}${authMessage ? `: ${authMessage}` : ""})`;
            }
            showToast(
              "Sign in required",
              signInMessage,
              "warning",
            );
            return;
          }
          showToast(
            "Daily limit reached",
            `Daily limit reached (${URL_BETA_DAILY_LIMIT}/${URL_BETA_DAILY_LIMIT}). Try again tomorrow.`,
            "warning",
          );
          return;
        }
        const remainingAfterFetch = creditConsumeResult.remaining;
        // Use the exact value from the transaction — no stale cache read.
        if (Number.isFinite(remainingAfterFetch)) {
          applyFetchSiteBtnState(remainingAfterFetch);
        } else {
          await updateUrlBetaCreditUi();
        }

        if (window.autoSaveFile) {
          window.autoSaveFile(fileName, html, "URL-convert");
        }

        const summarySection = document.getElementById("summarySection");
        if (summarySection) summarySection.classList.remove("hidden");

        resetStats();
        updateStylesPanel();
        urlInput.value = "";

        showToast(
          "Site fetched",
          `${domain} imported successfully. ${remainingAfterFetch} left today.`,
          "success",
        );
        if (directRoutePreview) {
          const popup = openLiveRoutePopup(url);
          if (!popup) {
            showToast(
              "Popup blocked",
              "Allow popups to open the exact route in first-party mode.",
              "warning",
            );
          }
          showToast(
            "Route preview mode",
            "This site returned a logout/demo shell via proxy. Opening the exact route in a popup for first-party session access.",
            "warning",
          );
        }
        setButtonProgress(100, "Done");
      } catch (err) {
        console.error("[URL Beta] fetch failed:", err);
        const failures = Array.isArray(err?.proxyFailures) ? err.proxyFailures : [];
        const detail = failures.length ? ` (${failures.join("; ")})` : "";
        const hasPayloadTooLarge = failures.some((item) => /HTTP\s+413/i.test(String(item)));
        const isMostlyNetworkTimeout =
          failures.length > 0 &&
          failures.every((item) => /(timed out|Failed to fetch|network error|blocked)/i.test(String(item)));

        let failureMessage =
          "Could not fetch the site. It may block external access, or the proxy services this feature relies on may be temporarily unavailable.";

        if (hasPayloadTooLarge) {
          failureMessage =
            "Could not fetch this site through public proxies because the response is too large (HTTP 413 on at least one proxy). Try a lighter route (for example homepage instead of long query pages), or save the page as HTML and import with File Convert.";
        } else if (isMostlyNetworkTimeout) {
          failureMessage =
            "Could not fetch the site due to repeated network timeouts. The target may be slow or blocking automated fetch traffic. Try again once, or use File Convert for guaranteed import.";
        }

        showToast(
          "Fetch failed",
          `${failureMessage}${detail}`,
          "error",
        );
      } finally {
        window.clearInterval(progressPulseTimer);
        fetchSiteBtn.classList.remove("is-loading");
        await updateUrlBetaCreditUi();
      }
    }

    fetchSiteBtn.disabled = true;

    // Intercept clicks on disabled fetch button to show sign-in message.
    fetchSiteBtn.addEventListener("pointerdown", (e) => {
      if (fetchSiteBtn.disabled && !fetchSiteBtn.classList.contains("is-loading")) {
        const isSignedIn = settingsUrlBetaSignedIn;
        if (!isSignedIn) {
          showToast("Sign in required", "Please sign in to continue.", "warning");
        }
      }
    }, true);

    void updateUrlBetaCreditUi();
    window.addEventListener("url-beta-auth-changed", () => {
      // Small delay lets Firebase auth state fully propagate.
      setTimeout(() => { void updateUrlBetaCreditUi(); }, 300);
    });
    window.addEventListener("focus", () => {
      void updateUrlBetaCreditUi();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void updateUrlBetaCreditUi();
      }
    });

    fetchSiteBtn.addEventListener("click", handleFetchSite);
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleFetchSite();
      }
    });
  })();

  function analyzeHtml(html) {
    // For very large files skip DOMParser entirely — it would freeze / OOM the
    // main thread. Instead do a fast regex scan for approximate counts.
    if (typeof html === "string" && html.length > MAX_SNAPSHOT_HTML_LENGTH) {
      const containerCount = (html.match(/<(div|section|main|header|footer|nav|article|aside|ul|ol|li)[\s\/>]/gi) || []).length;
      const textCount     = (html.match(/<(p|h[1-6]|span|a|td|th|button|label)[\s\/>]/gi) || []).length;
      const imageCount    = (html.match(/<(img|svg|canvas|video|picture)[\s\/>]/gi) || []).length;
      return {
        frames:    Math.min(1 + containerCount, 9999),
        text:      Math.min(textCount, 9999),
        image:     Math.min(imageCount, 9999),
        container: Math.min(containerCount, 9999),
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body || doc.createElement("body");
    const elements = Array.from(body.querySelectorAll("*"));

    const counts = {
      frames: 1,
      text: 0,
      image: 0,
      container: 0,
    };

    for (const element of elements) {
      const tag = element.tagName.toLowerCase();
      const text = element.textContent ? element.textContent.trim() : "";

      if (["img", "svg", "picture", "canvas", "video"].includes(tag)) {
        counts.image += 1;
      }

      if (
        text &&
        !Array.from(element.children).some(
          (child) => child.textContent?.trim() === text,
        )
      ) {
        counts.text += 1;
      }

      if (
        [
          "div",
          "section",
          "main",
          "header",
          "footer",
          "nav",
          "article",
          "aside",
          "ul",
          "ol",
          "li",
        ].includes(tag)
      ) {
        counts.container += 1;
        counts.frames += 1;
      }
    }

    return counts;
  }

  // Fast path for very large HTML files: inject capture scripts via string
  // manipulation so that DOMParser + outerHTML never doubles memory usage.
  function prepareHtmlForCaptureFast(html, isExport, sourceImport) {
    const activeImport = getActiveImport();
    const activeDims = isExport && activeImport ? getArtboardDimensions(activeImport) : null;
    const widthVal = (activeDims && activeDims.width) ||
      (viewportWidthInput && parseInt(viewportWidthInput.value, 10)) || 1440;
    const heightVal = (activeDims && activeDims.height) ||
      (viewportHeightInput && parseInt(viewportHeightInput.value, 10)) || 900;
    const autoLayoutMode = state.smartAutoLayout ? "smart" : "off";

    // Use a split closing tag so the string itself never terminates
    // an outer <script> block in the hosting page.
    var SC = "<" + "/script>";

    var parts = [
      '<meta name="viewport" content="width=device-width, initial-scale=1">',

      // 1. Clipboard polyfill
      '<script>(function(){'
        + 'if(typeof window.ClipboardItem==="undefined"){'
        + 'window.ClipboardItem=class ClipboardItem{'
        + 'constructor(i){this.items=i;this.types=Object.keys(i);}'
        + 'getType(t){var v=this.items[t];return Promise.resolve(typeof v==="function"?v():v);}};}'
        + 'if(!navigator.clipboard)navigator.clipboard={};'
        + 'if(typeof navigator.clipboard.write!=="function"){'
        + 'navigator.clipboard.write=async function(items){'
        + 'var arr=Array.isArray(items)?items:[items];var m=new Map();'
        + 'for(var it of arr){var ts=it.types||Object.keys(it.items||{});'
        + 'for(var t of ts){var b=await it.getType(t);'
        + 'var txt=typeof b==="string"?b:await b.text();m.set(t,txt);}}'
        + 'var cb=function(e){for(var[t,v]of m.entries())e.clipboardData.setData(t,v);'
        + 'if(!m.has("text/plain"))e.clipboardData.setData("text/plain","Paste into Figma");'
        + 'e.preventDefault();};'
        + 'document.addEventListener("copy",cb,{once:true});'
        + 'if(!document.execCommand("copy")){document.removeEventListener("copy",cb);'
        + 'throw new Error("Clipboard write fallback failed");}};}'
        + '})()' + SC,

      // 2. Auto-layout config
      '<script>(function(){'
        + 'var m="' + autoLayoutMode + '";'
        + 'var c={version:2,autoLayout:m,autoLayoutEnabled:m!=="off",'
        + 'smartAutoLayout:m==="smart",'
        + 'rules:{preserveExisting:true,skipAbsolute:true,skipOverlapping:true,'
        + 'skipPixelPerfect:true,avoidNested:true,enhanceMissing:m==="smart"}};'
        + 'window.__FIGMA_CAPTURE_CONFIG=c;'
        + 'window.__FIGMA_CAPTURE_OPTIONS=Object.assign({},c);'
        + 'window.__FIGMA_CAPTURE_FEATURES=Object.assign({},'
        + 'window.__FIGMA_CAPTURE_FEATURES,{autoLayout:c.autoLayoutEnabled?m:"off"});'
        + '})()' + SC,

      // 3. Capture-mode script (sets dimensions from #figmacapture hash)
      '<script>(function(){'
        + 'var h=String(location.hash||"");'
        + 'if(!h.includes("figmacapture"))return;'
        + 'var p=new URLSearchParams(h.replace(/^#/,""));'
        + 'var hw=Number(p.get("figmawidth")),hh=Number(p.get("figmaheight"));'
        + 'var w=Number.isFinite(hw)&&hw>0?Math.round(hw):' + widthVal + ';'
        + 'var ht=Number.isFinite(hh)&&hh>0?Math.round(hh):' + heightVal + ';'
        + 'document.documentElement.setAttribute("data-figma-capture-mode","true");'
        + 'document.documentElement.style.setProperty("--figma-capture-width",w+"px");'
        + 'document.documentElement.style.setProperty("--figma-capture-height",ht+"px");'
        + 'document.documentElement.style.width=w+"px";'
        + 'document.documentElement.style.minWidth=w+"px";'
        + 'document.documentElement.style.maxWidth=w+"px";'
        + 'if(document.body){'
        + 'document.body.style.width=w+"px";'
        + 'document.body.style.minWidth=w+"px";'
        + 'document.body.style.maxWidth=w+"px";'
        + 'document.body.style.minHeight=ht+"px";'
        + 'document.body.style.margin="0";document.body.style.padding="0";}'
        + 'window.scrollTo(0,0);'
        + 'var vm=document.querySelector(\'meta[name="viewport"]\');'
        + 'if(vm)vm.setAttribute("content","width="+w+", height="+ht+", initial-scale=1");'
        + 'var f=function(){window.scrollTo(0,0);document.documentElement.scrollTop=0;'
        + 'if(document.body)document.body.scrollTop=0;};'
        + 'f();window.addEventListener("load",f,{once:true});'
        + '})()' + SC,

      // 4. Animation freeze style (only for artboard preview, not capture popup)
      '<style>'
        + 'html:not([data-figma-capture-mode="true"]) *,'
        + 'html:not([data-figma-capture-mode="true"]) *::before,'
        + 'html:not([data-figma-capture-mode="true"]) *::after{'
        + 'animation-duration:0.001ms!important;animation-delay:0s!important;'
        + 'animation-fill-mode:both!important;animation-iteration-count:1!important;'
        + 'transition-duration:0.001ms!important;transition-delay:0s!important;'
        + 'content-visibility:visible!important;scroll-behavior:auto!important;}'
        + '</style>',

      // 5. Figma capture script (the critical one)
      '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js">' + SC,
    ];

    var injectBlock = parts.join("\n");

    // Remove existing <base> tags to avoid cross-origin navigation issues.
    let result = html.replace(/<base\b[^>]*>/gi, "");

    // Inject before </head> (preferred), after <head>, before <body>, or at top.
    if (/<\/head\s*>/i.test(result)) {
      result = result.replace(/<\/head\s*>/i, injectBlock + "\n</head>");
    } else if (/<head\b[^>]*>/i.test(result)) {
      result = result.replace(/<head\b[^>]*>/i, (m) => m + "\n" + injectBlock);
    } else if (/<body\b[^>]*>/i.test(result)) {
      result = result.replace(/<body\b[^>]*>/i, (m) => "<head>\n" + injectBlock + "\n</head>\n" + m);
    } else {
      result = "<head>\n" + injectBlock + "\n</head>\n" + result;
    }

    return "<!DOCTYPE html>\n" + result;
  }

  async function prepareHtmlForCapture(
    html,
    isExport = false,
    sourceImport = null,
    options = {},
  ) {
    // For very large files use the fast string-injection path to avoid the
    // DOMParser + outerHTML sequence that would double memory and OOM the tab.
    if (typeof html === "string" && html.length > MAX_SNAPSHOT_HTML_LENGTH) {
      return prepareHtmlForCaptureFast(html, isExport, sourceImport);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const activeImport = getActiveImport();
    const activeDims =
      isExport && activeImport ? getArtboardDimensions(activeImport) : null;
    const widthVal =
      activeDims?.width ||
      (viewportWidthInput && parseInt(viewportWidthInput.value, 10)) ||
      1440;
    const heightVal =
      activeDims?.height ||
      (viewportHeightInput && parseInt(viewportHeightInput.value, 10)) ||
      900;

    // In-line styles for robust capturing (especially when using folder uploads)
    const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of linkTags) {
      const href = link.getAttribute("href");
      if (!href) continue;

      try {
        const cleanPath = href.replace(/^\.\//, "");
        const assetUrl = state.assetBlobs.get(cleanPath);
        if (assetUrl) {
          const response = await fetch(assetUrl);
          let cssText = await response.text();

          // Helper function for recursive URL resolving in CSS
          const resolveCssUrls = (css, baseUrl) => {
            return css.replace(/url\(['"]?([^'")]*)['"]?\)/g, (match, url) => {
              if (
                url.startsWith("http") ||
                url.startsWith("data:") ||
                url.startsWith("blob:")
              )
                return match;

              // Resolve relative path based on CSS file location
              const cssDir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
              let resolvedPath = cssDir + url;

              // Clean up paths like folder/css/../assets/img.png
              const pathParts = resolvedPath.split("/");
              const stack = [];
              for (const part of pathParts) {
                if (part === "..") stack.pop();
                else if (part !== "." && part !== "") stack.push(part);
              }
              const finalPath = stack.join("/");

              if (state.assetBlobs.has(finalPath)) {
                return `url("${state.assetBlobs.get(finalPath)}")`;
              }
              return match;
            });
          };

          cssText = resolveCssUrls(cssText, cleanPath);

          const style = doc.createElement("style");
          style.textContent = cssText;
          link.parentNode.replaceChild(style, link);
        }
      } catch (e) {
        console.warn("Failed to inline CSS:", href, e);
      }
    }

    // Rewrite other relative URLs (images, scripts etc) to Blob URLs
    const rewriteAttribute = (selector, attr) => {
      doc.querySelectorAll(selector).forEach((el) => {
        const originalVal = el.getAttribute(attr);
        if (
          originalVal &&
          !originalVal.startsWith("http") &&
          !originalVal.startsWith("data:") &&
          !originalVal.startsWith("blob:")
        ) {
          // Normalize path (remove leading ./ if present)
          const cleanPath = originalVal.replace(/^\.\//, "");
          if (state.assetBlobs.has(cleanPath)) {
            el.setAttribute(attr, state.assetBlobs.get(cleanPath));
          }
        }
      });
    };

    rewriteAttribute("img", "src");
    rewriteAttribute("script", "src");
    rewriteAttribute("video", "src");
    rewriteAttribute("source", "src");

    // Improve visual fidelity by making sure lazy assets load in preview/capture.
    doc.querySelectorAll("img[loading]").forEach((img) => {
      img.setAttribute("loading", "eager");
    });

    const shouldPreserveScripts = options?.preserveScripts === true;
    if (!shouldPreserveScripts) {
      doc.querySelectorAll("script").forEach((script) => {
        // Keep our blob-rewritten scripts but remove others
        if (!script.src.startsWith("blob:")) {
          script.remove();
        }
      });
    }
    doc.querySelectorAll("base").forEach((base) => base.remove());

    if (!doc.head) {
      doc.documentElement.insertBefore(
        doc.createElement("head"),
        doc.body || null,
      );
    }

    const meta =
      doc.head.querySelector('meta[name="viewport"]') ||
      doc.createElement("meta");
    meta.name = "viewport";
    if (isExport) {
      meta.content = `width=${widthVal}, height=${heightVal}, initial-scale=1`;
    } else {
      meta.content = "width=device-width, initial-scale=1";
    }
    if (!meta.parentNode) doc.head.appendChild(meta);

    const clipboardPolyfill = doc.createElement("script");
    clipboardPolyfill.textContent = `
        (function() {
          if (typeof window.ClipboardItem === "undefined") {
            window.ClipboardItem = class ClipboardItem {
              constructor(items) {
                this.items = items;
                this.types = Object.keys(items);
              }

              getType(type) {
                const value = this.items[type];
                return Promise.resolve(typeof value === "function" ? value() : value);
              }
            };
          }

          if (!navigator.clipboard) {
            navigator.clipboard = {};
          }

          if (typeof navigator.clipboard.write !== "function") {
            navigator.clipboard.write = async function(items) {
                const clipboardItems = Array.isArray(items) ? items : [items];
                const payload = new Map();

                for (const item of clipboardItems) {
                    const types = item.types || Object.keys(item.items || {});
                    for (const type of types) {
                        const blob = await item.getType(type);
                        const text = typeof blob === "string" ? blob : await blob.text();
                        payload.set(type, text);
                    }
                }

                const onCopy = (event) => {
                    for (const [type, value] of payload.entries()) {
                        event.clipboardData.setData(type, value);
                    }
                    if (!payload.has("text/plain")) {
                        event.clipboardData.setData("text/plain", "Paste into Figma");
                    }
                    event.preventDefault();
                };

                document.addEventListener("copy", onCopy, { once: true });
                const copied = document.execCommand("copy");
                if (!copied) {
                    document.removeEventListener("copy", onCopy);
                    throw new Error("Clipboard write fallback failed");
                }
            };
          }
        })();
      `;
    doc.head.appendChild(clipboardPolyfill);

    // Expose capture configuration for smart auto layout behavior
    const configScript = doc.createElement("script");
    configScript.textContent = `
                (function(){
                    const autoLayoutMode = ${state.smartAutoLayout ? '"smart"' : '"off"'};
                    const config = {
                        version: 2,
                        autoLayout: autoLayoutMode,
                        autoLayoutEnabled: autoLayoutMode !== "off",
                        smartAutoLayout: autoLayoutMode === "smart",
                        rules: {
                            preserveExisting: true,
                            skipAbsolute: true,
                            skipOverlapping: true,
                            skipPixelPerfect: true,
                            avoidNested: true,
                            enhanceMissing: autoLayoutMode === "smart"
                        }
                    };
                    window.__FIGMA_CAPTURE_CONFIG = config;
                    window.__FIGMA_CAPTURE_OPTIONS = Object.assign({}, config);
                    window.__FIGMA_CAPTURE_FEATURES = Object.assign({}, window.__FIGMA_CAPTURE_FEATURES, {
                        autoLayout: config.autoLayoutEnabled ? config.autoLayout : "off"
                    });
                })();
            `;
    doc.head.appendChild(configScript);

    // Lightweight guard to annotate nodes for the capture script
    const guardScript = doc.createElement("script");
    guardScript.textContent = `
                (function() {
                    const cfg = window.__FIGMA_CAPTURE_CONFIG || {};
                    if (cfg.autoLayout === "off") return;

                    const shouldSkip = (el, cs) => {
                        if (!cs) return false;
                        if (el.hasAttribute('data-figma-skip-autolayout')) return true;
                        const pos = cs.position;
                        return pos === 'absolute' || pos === 'fixed';
                    };

                    const hasOverlap = (el) => {
                        const kids = Array.from(el.children || []);
                        if (kids.length === 0 || kids.length > 30) return false;
                        const rects = kids.map(c => c.getBoundingClientRect());
                        for (let i = 0; i < rects.length; i++) {
                            for (let j = i + 1; j < rects.length; j++) {
                                const a = rects[i], b = rects[j];
                                const overlap = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
                                if (overlap) return true;
                            }
                        }
                        return false;
                    };

                    const mark = (el, value, meta = {}) => {
                        el.dataset.figmaAutolayout = value;
                        el.setAttribute('data-figma-auto-layout', value);
                        if (meta.direction) {
                            el.setAttribute('data-figma-auto-layout-direction', meta.direction);
                        }
                        if (typeof meta.gap === 'number') {
                            el.setAttribute('data-figma-auto-layout-gap', String(meta.gap));
                        }
                    };

                    const getDirection = (cs) => {
                        const flexDir = (cs.flexDirection || '').toLowerCase();
                        if (flexDir.includes('row')) return 'horizontal';
                        if (flexDir.includes('column')) return 'vertical';
                        const textAlign = (cs.textAlign || '').toLowerCase();
                        if (textAlign === 'left' || textAlign === 'right') return 'vertical';
                        return 'vertical';
                    };

                    const getGap = (cs) => {
                        const gapVal = parseFloat(cs.rowGap || cs.columnGap || cs.gap || '0');
                        if (Number.isFinite(gapVal)) return gapVal;
                        return 0;
                    };

                    requestAnimationFrame(() => {
                        document.querySelectorAll('body *').forEach(el => {
                            const cs = getComputedStyle(el);
                            if (shouldSkip(el, cs)) { mark(el, 'skip'); return; }

                            const display = cs.display || '';
                            const isFlex = display.includes('flex');
                            const isGrid = display.includes('grid');

                            // Preserve existing auto layout structures
                            if (isFlex || isGrid || el.hasAttribute('data-figma-preserve-autolayout')) {
                                mark(el, 'preserve', {
                                    direction: getDirection(cs),
                                    gap: getGap(cs)
                                });
                                return;
                            }

                            // Only enhance missing structure when allowed
                            if (!cfg.rules || cfg.rules.enhanceMissing !== true) return;

                            if (display === 'block' || display === 'inline-block') {
                                if (!hasOverlap(el)) {
                                    mark(el, 'candidate', {
                                        direction: getDirection(cs),
                                        gap: getGap(cs)
                                    });
                                } else {
                                    mark(el, 'skip');
                                }
                            }
                        });
                    });
                })();
            `;
    doc.head.appendChild(guardScript);

    const helperStyle = doc.createElement("style");
    if (isExport) {
      helperStyle.textContent = `
            html, body {
              width: ${widthVal}px !important;
                            min-width: ${widthVal}px !important;
                            max-width: ${widthVal}px !important;
              min-height: ${heightVal}px !important;
                            margin: 0 !important;
              overflow-x: hidden !important;
                            overflow-y: visible !important;
              background-color: transparent !important;
            }
          `;
    } else {
      helperStyle.textContent = `
            html, body {
              width: 100% !important;
              min-height: 100% !important;
              margin: 0 !important;
              overflow-x: auto !important;
              background-color: transparent !important;
            }

                        /* Animation / transition freeze — only applied to the
                           artboard preview (no #figmacapture hash).  The
                           capture-mode script removes this block so the Figma
                           capture popup stays interactive / dynamic until the
                           actual capture moment. */
                        html:not([data-figma-capture-mode="true"]) *,
                        html:not([data-figma-capture-mode="true"]) *::before,
                        html:not([data-figma-capture-mode="true"]) *::after {
                            animation-duration: 0.001ms !important;
                            animation-delay: 0s !important;
                            animation-fill-mode: both !important;
                            animation-iteration-count: 1 !important;
                            transition-duration: 0.001ms !important;
                            transition-delay: 0s !important;
                            scroll-behavior: auto !important;
                            content-visibility: visible !important;
                        }

                        html[data-figma-capture-mode="true"],
                        html[data-figma-capture-mode="true"] body {
                            width: var(--figma-capture-width, ${widthVal}px) !important;
                            min-width: var(--figma-capture-width, ${widthVal}px) !important;
                            max-width: var(--figma-capture-width, ${widthVal}px) !important;
                            min-height: var(--figma-capture-height, ${heightVal}px) !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow-x: hidden !important;
                            overflow-y: visible !important;
                        }
          `;
    }
    doc.head.appendChild(helperStyle);

    const captureModeScript = doc.createElement("script");
    captureModeScript.textContent = `
                (function () {
                    const hash = String(location.hash || "");
                    if (!hash.includes("figmacapture")) return;

                    const params = new URLSearchParams(hash.replace(/^#/, ""));
                    const hashWidth = Number(params.get("figmawidth"));
                    const hashHeight = Number(params.get("figmaheight"));
                    const width = Number.isFinite(hashWidth) && hashWidth > 0 ? Math.round(hashWidth) : ${widthVal};
                    const height = Number.isFinite(hashHeight) && hashHeight > 0 ? Math.round(hashHeight) : ${heightVal};

                    document.documentElement.setAttribute("data-figma-capture-mode", "true");
                    document.documentElement.style.setProperty("--figma-capture-width", width + "px");
                    document.documentElement.style.setProperty("--figma-capture-height", height + "px");

                    document.documentElement.style.width = width + "px";
                    document.documentElement.style.minWidth = width + "px";
                    document.documentElement.style.maxWidth = width + "px";

                    if (document.body) {
                        document.body.style.width = width + "px";
                        document.body.style.minWidth = width + "px";
                        document.body.style.maxWidth = width + "px";
                        document.body.style.minHeight = height + "px";
                        document.body.style.margin = "0";
                        document.body.style.padding = "0";
                    }

                    window.scrollTo(0, 0);

                    const viewportMeta = document.querySelector('meta[name="viewport"]');
                    if (viewportMeta) {
                        viewportMeta.setAttribute("content", "width=" + width + ", height=" + height + ", initial-scale=1");
                    }

                    const forceTopLeft = () => {
                        window.scrollTo(0, 0);
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    };

                    forceTopLeft();
                    window.addEventListener("load", forceTopLeft, { once: true });
                })();
            `;
    doc.head.appendChild(captureModeScript);

    // Visibility normalization: runs before Figma capture.js to ensure every
    // visible element is actually renderable — fixes missing elements in both
    // the Figma Capture tab and the final Figma paste.
    // Only runs in the artboard preview (no #figmacapture); in the capture popup
    // the user interacts with the page so we must not force-show hidden elements.
    const visibilityNormScript = doc.createElement("script");
    visibilityNormScript.textContent = `
        (function () {
            // In the capture popup the user browses the page interactively —
            // skip visibility normalization so toggle states are preserved.
            var hash = String(location.hash || "");
            if (hash.indexOf("figmacapture") !== -1) return;

            var runNormalize = function () {
                try {
                    var all = document.querySelectorAll('*');
                    for (var i = 0; i < all.length; i++) {
                        var el = all[i];
                        try {
                            var cs = window.getComputedStyle(el);
                            if (!cs || cs.display === 'none') continue;

                            // 1. Force content-visibility:visible so Chrome doesn't
                            //    skip rendering off-screen sections.
                            var cv = cs.contentVisibility;
                            if (cv && cv !== 'visible') {
                                el.style.setProperty('content-visibility', 'visible', 'important');
                            }

                            // 2. Restore elements frozen at opacity:0 by a cancelled
                            //    animation (animation-fill-mode:both now completes them,
                            //    but this is a safety net for edge cases).
                            var op = parseFloat(cs.opacity);
                            if (!isNaN(op) && op < 0.02) {
                                var inlineOp = el.style.opacity;
                                if (!inlineOp || inlineOp === '') {
                                    el.style.setProperty('opacity', '1', 'important');
                                }
                            }

                            // 3. Force visibility:visible for elements hidden only
                            //    by an animation side-effect (not by an explicit rule).
                            if (cs.visibility === 'hidden') {
                                var inlineVis = el.style.visibility;
                                if (!inlineVis || inlineVis === '') {
                                    el.style.setProperty('visibility', 'visible', 'important');
                                }
                            }

                            // 4. Eagerly load lazy images and common lazy-load patterns.
                            if (el.tagName === 'IMG') {
                                if (el.loading === 'lazy') el.loading = 'eager';
                                if (!el.src && el.dataset.src)  el.src = el.dataset.src;
                                if (!el.src && el.dataset.lazySrc) el.src = el.dataset.lazySrc;
                                if (!el.src && el.dataset.originalSrc) el.src = el.dataset.originalSrc;
                            }

                            // 5. Restore data-bg lazy background images.
                            var bgSrc = el.dataset.bg || el.dataset.bgSrc || el.dataset.backgroundImage;
                            if (bgSrc && (!cs.backgroundImage || cs.backgroundImage === 'none')) {
                                el.style.backgroundImage = 'url(' + bgSrc + ')';
                            }
                        } catch (_) {}
                    }
                } catch (_) {}
            };

            // Run immediately (before first paint in capture popup).
            runNormalize();

            // Run again after all resources have loaded.
            if (document.readyState !== 'complete') {
                window.addEventListener('load', function () {
                    runNormalize();
                    setTimeout(runNormalize, 300);
                    setTimeout(runNormalize, 800);
                }, { once: true });
            } else {
                setTimeout(runNormalize, 300);
                setTimeout(runNormalize, 800);
            }
        })();
    `;
    doc.head.appendChild(visibilityNormScript);

    const captureScript = doc.createElement("script");
    captureScript.src = "https://mcp.figma.com/mcp/html-to-design/capture.js";
    doc.head.appendChild(captureScript);

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function loadPreviewFrame(srcdoc) {
    return new Promise((resolve, reject) => {
      // Large-file fast path: prepareCaptureForImport returns a blob: URL
      // instead of the HTML string. Also guard against huge HTML strings
      // being set as the srcdoc DOM attribute (which would OOM the tab).
      const _isBlobUrl = typeof srcdoc === "string" && srcdoc.startsWith("blob:");
      const _isLargeSrcdoc = !_isBlobUrl && typeof srcdoc === "string" && srcdoc.length > MAX_SNAPSHOT_HTML_LENGTH;
      const _frameTimeout = (_isBlobUrl || _isLargeSrcdoc) ? 90000 : 15000;

      const timer = window.setTimeout(
        () => reject(new Error("Preview frame took too long to load.")),
        _frameTimeout,
      );

      previewFrame.onload = () => {
        window.clearTimeout(timer);

        try {
          const frameWindow = previewFrame.contentWindow;
          if (frameWindow && !frameWindow.__code2designSaveShortcutBound) {
            frameWindow.addEventListener("keydown", (event) => {
              if (isCommandPaletteShortcutEvent(event)) {
                event.preventDefault();
                if (isCommandPaletteOpen()) {
                  closeCommandPalette();
                } else {
                  openCommandPalette("");
                }
                return;
              }

              const frameIsSaveKey =
                event.code === "KeyS" ||
                (typeof event.key === "string" &&
                  event.key.toLowerCase() === "s");
              if (
                (event.metaKey || event.ctrlKey) &&
                !event.shiftKey &&
                !event.altKey &&
                frameIsSaveKey &&
                !event.repeat
              ) {
                event.preventDefault();
                saveWorkspaceNowWithFeedback();
              }
            });
            frameWindow.__code2designSaveShortcutBound = true;
          }
        } catch (shortcutBindError) {
          console.warn(
            "Failed to bind iframe save shortcut:",
            shortcutBindError,
          );
        }

        try {
          // Keep existing artboard size as-is on convert.
          const activeItem = getActiveImport();
          const current = activeItem
            ? getArtboardDimensions(activeItem)
            : {
                width:
                  (viewportWidthInput &&
                    parseInt(viewportWidthInput.value, 10)) ||
                  1440,
                height:
                  (viewportHeightInput &&
                    parseInt(viewportHeightInput.value, 10)) ||
                  900,
              };

          const newWidth = Math.max(0, Math.round(current.width || 0));
          const finalHeight = Math.max(0, Math.round(current.height || 0));

          previewFrame.style.width = "100%";
          previewFrame.style.height = "100%";
          if (viewportWidthInput) viewportWidthInput.value = String(newWidth);
          if (viewportHeightInput) viewportHeightInput.value = finalHeight;

          // Sync overall Artboard Container
          if (canvasPreview) {
            canvasPreview.style.width = newWidth + "px";
            canvasPreview.style.height = finalHeight + "px";
          }

          // Update the dimension label ("1440 x 900 Hug")
          if (dimensionLabel) {
            dimensionLabel.textContent = `${newWidth} × ${finalHeight} Hug`;
          }
        } catch (e) {
          console.warn(
            "Could not auto-resize iframe due to cross-origin restrictions, using fallback.",
            e,
          );
          previewFrame.style.height = "100%";
        }

        resolve();
      };

      if (_isBlobUrl) {
        // Already a blob URL — set src directly, no new blob needed.
        previewFrame.removeAttribute("srcdoc");
        previewFrame.src = srcdoc;
      } else if (_isLargeSrcdoc) {
        // Convert the large HTML string to a blob URL to avoid storing it in
        // the srcdoc attribute (which keeps the string pinned in the DOM).
        const _blob = new Blob([srcdoc], { type: "text/html" });
        const _blobUrl = URL.createObjectURL(_blob);
        if (previewFrame._capturePreviewBlobUrl) {
          URL.revokeObjectURL(previewFrame._capturePreviewBlobUrl);
        }
        previewFrame._capturePreviewBlobUrl = _blobUrl;
        previewFrame.removeAttribute("srcdoc");
        previewFrame.src = _blobUrl;
      } else {
        previewFrame.srcdoc = srcdoc;
      }
    });
  }

  async function waitForCaptureApi(timeoutMs = 15000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const frameWindow = previewFrame.contentWindow;
      if (frameWindow?.figma?.captureForDesign) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(
      "Figma capture script did not load. Try serving this page over localhost if the browser blocks remote clipboard features.",
    );
  }

  const statsAnimationState = {
    version: 0,
    rafByKey: new Map(),
  };

  function stopStatsAnimations() {
    statsAnimationState.rafByKey.forEach((rafId) => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    });
    statsAnimationState.rafByKey.clear();
  }

  function animateValue(key, obj, start, end, duration, version) {
    if (!obj) return;
    if (start === end) {
      obj.textContent = String(end);
      return;
    }
    let startTimestamp = null;
    const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);

    const step = (timestamp) => {
      if (version !== statsAnimationState.version) return;
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = easeOutQuart(progress);

      obj.textContent = String(
        Math.round(easedProgress * (end - start) + start),
      );
      if (progress < 1) {
        const rafId = window.requestAnimationFrame(step);
        statsAnimationState.rafByKey.set(key, rafId);
      } else {
        obj.textContent = String(end);
        statsAnimationState.rafByKey.delete(key);
      }
    };
    const rafId = window.requestAnimationFrame(step);
    statsAnimationState.rafByKey.set(key, rafId);
  }

  function renderStats({ frames, text, image, container }, options = {}) {
    const { animate = true } = options;
    stopStatsAnimations();
    statsAnimationState.version += 1;
    const version = statsAnimationState.version;

    if (!animate) {
      if (counters.frames) counters.frames.textContent = String(frames || 0);
      if (counters.text) counters.text.textContent = String(text || 0);
      if (counters.image) counters.image.textContent = String(image || 0);
      if (counters.container)
        counters.container.textContent = String(container || 0);
      return;
    }

    const readCurrentValue = (el) => {
      if (!el) return 0;
      const parsed = Number.parseInt(el.textContent || "0", 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const frameStart = readCurrentValue(counters.frames);
    const textStart = readCurrentValue(counters.text);
    const imageStart = readCurrentValue(counters.image);
    const containerStart = readCurrentValue(counters.container);

    const getDuration = (start, end) => {
      const delta = Math.abs((Number(end) || 0) - (Number(start) || 0));
      return Math.max(180, Math.min(420, 180 + delta));
    };

    animateValue(
      "frames",
      counters.frames,
      frameStart,
      frames,
      getDuration(frameStart, frames),
      version,
    );
    animateValue(
      "text",
      counters.text,
      textStart,
      text,
      getDuration(textStart, text),
      version,
    );
    animateValue(
      "image",
      counters.image,
      imageStart,
      image,
      getDuration(imageStart, image),
      version,
    );
    animateValue(
      "container",
      counters.container,
      containerStart,
      container,
      getDuration(containerStart, container),
      version,
    );
  }

  function resetStats() {
    stopStatsAnimations();
    statsAnimationState.version += 1;
    if (counters.frames) counters.frames.textContent = "0";
    if (counters.text) counters.text.textContent = "0";
    if (counters.image) counters.image.textContent = "0";
    if (counters.container) counters.container.textContent = "0";
  }

  function updateStatus(message, tone = "") {
    if (!statusEl) return;
    if (HIDE_STATUS_TEXT) {
      statusEl.textContent = "";
      statusEl.dataset.tone = tone;
      return;
    }
    statusEl.textContent = message;
    if (tone === "warning") {
      statusEl.className = "status-amber";
    } else if (tone === "success") {
      statusEl.className = "status-emerald";
    } else {
      statusEl.className = "status-slate";
    }
    statusEl.dataset.tone = tone;
  }

  /* ─── Palette History (saved colour palettes) ─── */
  const PALETTE_COLLECTION_KEY = "motvin.palette-collection.v1";
  const PALETTE_DELETED_KEY = "motvin.palette-deleted.v1";
  const PALETTE_STATE_KEY = "motvin.styles.palette-state.v1";
  const PALETTE_EDITING_ID_KEY = "motvin.palette.editing-id.v1";
  const PALETTE_MAX_SAVED = 50;
  const historyShared = window.__motvinHistoryShared || {};

  function clampPaletteValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wrapPaletteHue(value) {
    return ((value % 360) + 360) % 360;
  }

  function paletteChannelToHex(value) {
    return clampPaletteValue(Math.round(value * 255), 0, 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  }

  function hslToPaletteHex(hue, saturation, lightness) {
    const normalizedHue = wrapPaletteHue(hue) / 360;
    const normalizedSaturation = clampPaletteValue(saturation, 0, 100) / 100;
    const normalizedLightness = clampPaletteValue(lightness, 0, 100) / 100;

    if (normalizedSaturation === 0) {
      const channel = paletteChannelToHex(normalizedLightness);
      return `${channel}${channel}${channel}`;
    }

    function hueToRgb(p, q, t) {
      let normalizedT = t;
      if (normalizedT < 0) normalizedT += 1;
      if (normalizedT > 1) normalizedT -= 1;
      if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT;
      if (normalizedT < 1 / 2) return q;
      if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6;
      return p;
    }

    const q = normalizedLightness < 0.5
      ? normalizedLightness * (1 + normalizedSaturation)
      : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
    const p = 2 * normalizedLightness - q;

    return `${paletteChannelToHex(hueToRgb(p, q, normalizedHue + 1 / 3))}${paletteChannelToHex(hueToRgb(p, q, normalizedHue))}${paletteChannelToHex(hueToRgb(p, q, normalizedHue - 1 / 3))}`;
  }

  function buildFreshPaletteParam() {
    const anchorHue = Math.floor(Math.random() * 360);
    const offsets = [-34, -12, 0, 24, 52];
    const saturations = [82, 74, 66, 58, 50];
    const lightnesses = [36, 46, 56, 66, 76];

    return offsets
      .map((offset, index) => {
        const hue = wrapPaletteHue(anchorHue + offset + Math.floor(Math.random() * 11) - 5);
        const saturation = clampPaletteValue(saturations[index] + Math.floor(Math.random() * 9) - 4, 18, 92);
        const lightness = clampPaletteValue(lightnesses[index] + Math.floor(Math.random() * 9) - 4, 18, 84);
        return hslToPaletteHex(hue, saturation, lightness);
      })
      .join(",");
  }

  function getCreatePaletteHref() {
    const url = new URL("./styles.html", window.location.href);
    url.searchParams.set("palette", buildFreshPaletteParam());
    return `${url.pathname}${url.search}`;
  }

  function prepareEditorPageSwitch(targetHref) {
    const normalizedTarget = String(targetHref || "").trim();
    if (!normalizedTarget) return normalizedTarget;

    let targetFileName = "";
    try {
      targetFileName = new URL(normalizedTarget, window.location.href)
        .pathname
        .split("/")
        .pop()
        .toLowerCase();
    } catch {
      targetFileName = normalizedTarget.split("?")[0].split("/").pop().toLowerCase();
    }

    if (
      document.body.classList.contains("ui-mode-floating") &&
      (targetFileName === "styles.html" || targetFileName === "typeface.html")
    ) {
      try { sessionStorage.setItem(AUTO_SWITCH_STANDARD_KEY, targetFileName); } catch { /* no-op */ }
    }

    return normalizedTarget;
  }

  function loadPaletteCollection() {
    if (!settingsUrlBetaSignedIn) return [];
    try {
      return JSON.parse(localStorage.getItem(PALETTE_COLLECTION_KEY)) || [];
    } catch { return []; }
  }
  function savePaletteCollection(col) {
    if (!settingsUrlBetaSignedIn) { showSignInRequiredToast("save palettes"); return; }
    const nextEntries = Array.isArray(col) ? col.slice(0, PALETTE_MAX_SAVED) : [];
    saveCollectionToCloud("palettes", nextEntries);
  }
  function loadDeletedPalettes() {
    if (!settingsUrlBetaSignedIn) return [];
    try {
      return JSON.parse(localStorage.getItem(PALETTE_DELETED_KEY)) || [];
    } catch { return []; }
  }
  function saveDeletedPalettes(col) {
    if (!settingsUrlBetaSignedIn) return;
    const nextEntries = Array.isArray(col) ? col.slice(0, ARCHIVED_HISTORY_LIMIT) : [];
    saveCollectionToCloud("deletedPalettes", nextEntries);
  }
  function loadTypefaceCollection() {
    if (!settingsUrlBetaSignedIn) return [];
    try {
      return JSON.parse(localStorage.getItem(TYPEFACE_COLLECTION_KEY)) || [];
    } catch { return []; }
  }
  function saveTypefaceCollection(col) {
    if (!settingsUrlBetaSignedIn) { showSignInRequiredToast("save typefaces"); return; }
    const nextEntries = Array.isArray(col) ? col.slice(0, PALETTE_MAX_SAVED) : [];
    saveCollectionToCloud("typefaces", nextEntries);
  }
  function loadDeletedTypefaces() {
    if (!settingsUrlBetaSignedIn) return [];
    try {
      return JSON.parse(localStorage.getItem(TYPEFACE_DELETED_KEY)) || [];
    } catch { return []; }
  }
  function saveDeletedTypefaces(col) {
    if (!settingsUrlBetaSignedIn) return;
    const nextEntries = Array.isArray(col) ? col.slice(0, ARCHIVED_HISTORY_LIMIT) : [];
    saveCollectionToCloud("deletedTypefaces", nextEntries);
  }

  function canAddSavedHistoryEntry(collection) {
    if (typeof historyShared.canAddSavedHistoryEntry === "function") {
      return historyShared.canAddSavedHistoryEntry(collection);
    }
    return Array.isArray(collection) && collection.length < SAVED_HISTORY_LIMIT;
  }

  function getHistoryLimitMessage(section) {
    if (typeof historyShared.getHistoryLimitMessage === "function") {
      return historyShared.getHistoryLimitMessage(section);
    }
    return section === "typeface" ? "Typeface reached Limits." : "Colour Palettes reached Limits.";
  }

  function showHistoryLimitToast(section) {
    const sharedToast = typeof historyShared.getHistoryLimitToast === "function"
      ? historyShared.getHistoryLimitToast(section)
      : null;
    const title = sharedToast?.title || "Limit reached";
    const message = sharedToast?.message || getHistoryLimitMessage(section);
    const tone = sharedToast?.tone || "warning";
    return typeof showToast === "function" ? showToast(title, message, tone) : false;
  }

  function buildUniqueDuplicateHistoryName(collection, currentName, fallbackName = "Untitled") {
    if (typeof historyShared.buildUniqueDuplicateName === "function") {
      return historyShared.buildUniqueDuplicateName(collection, currentName, fallbackName);
    }
    const sourceName = String(currentName || "").trim() || fallbackName;
    const normalizedNames = new Set(
      (Array.isArray(collection) ? collection : [])
        .map((entry) => String(entry?.name || "").trim().toLowerCase())
        .filter(Boolean),
    );

    const baseName = sourceName.replace(/\s+copy(?:\s+\d+)?$/i, "").trim() || fallbackName;
    const firstCandidate = `${baseName} copy`;
    if (!normalizedNames.has(firstCandidate.toLowerCase())) {
      return firstCandidate;
    }

    let copyIndex = 2;
    while (normalizedNames.has(`${baseName} copy ${copyIndex}`.toLowerCase())) {
      copyIndex += 1;
    }
    return `${baseName} copy ${copyIndex}`;
  }

  function timeAgo(ts) {
    if (typeof historyShared.timeAgo === "function") {
      return historyShared.timeAgo(ts);
    }
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return "Just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function paletteName(swatches) {
    if (typeof historyShared.paletteName === "function") {
      return historyShared.paletteName(swatches);
    }
    if (!swatches || !swatches.length) return "Untitled Palette";
    const names = swatches.slice(0, 3).map(s => s.name || "#" + s.hex);
    return names.join(", ");
  }

  function palettePreviewStripes(swatches) {
    if (typeof historyShared.palettePreviewStripes === "function") {
      return historyShared.palettePreviewStripes(swatches);
    }
    const palette = Array.isArray(swatches) ? swatches.filter(Boolean) : [];
    const visibleSwatches = palette.slice(0, 5);
    if (!visibleSwatches.length) {
      return '<span class="history-card-item-swatch" style="background:#e5e7eb"></span>';
    }
    return visibleSwatches
      .map((swatch) => `<span class="history-card-item-swatch" style="background:#${String(swatch?.hex || "e5e7eb").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6) || "e5e7eb"}"></span>`)
      .join("");
  }

  function renderSignInEmptyState(section) {
    const icon = section === "typeface"
      ? `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.6667 8H22.6667" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.6667 8V24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.3333 24H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
      : `<svg viewBox="0 0 28.8 28.8057" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.9 14.4C27.9 6.94415 21.8558 0.9 14.4 0.9C6.94415 0.9 0.9 6.94415 0.9 14.4C0.9 21.8558 6.94415 27.9 14.4 27.9C15.5363 27.9 17.1 28.057 17.1 26.55C17.1 25.7279 16.6723 25.0936 16.2476 24.4634C15.6261 23.5415 15.0106 22.6287 15.75 21.15C16.65 19.35 18.15 19.35 20.45 19.35C21.6001 19.35 22.9501 19.35 24.525 19.125C27.3614 18.7199 27.9 16.9763 27.9 14.4Z" stroke="currentColor" stroke-width="1.8"/><path d="M11.025 11.7C12.1434 11.7 13.05 10.7934 13.05 9.675C13.05 8.55662 12.1434 7.65 11.025 7.65C9.90662 7.65 9 8.55662 9 9.675C9 10.7934 9.90662 11.7 11.025 11.7Z" stroke="currentColor" stroke-width="1.8"/><path d="M20.475 13.05C21.5934 13.05 22.5 12.1434 22.5 11.025C22.5 9.90662 21.5934 9 20.475 9C19.3566 9 18.45 9.90662 18.45 11.025C18.45 12.1434 19.3566 13.05 20.475 13.05Z" stroke="currentColor" stroke-width="1.8"/></svg>`;
    return `
      <div class="history-card-empty-state" aria-live="polite">
        <div class="history-card-empty-icon" aria-hidden="true">${icon}</div>
        <p class="history-card-empty-copy">Sign in to save<br>Sync your ${section === "typeface" ? "typeface presets" : "colour palettes"} with Google.</p>
      </div>
    `;
  }

  function renderPaletteEmptyState(isDeleted) {
    if (!settingsUrlBetaSignedIn) return renderSignInEmptyState("palette");
    const emptyTitle = isDeleted ? "No deleted palettes yet." : "No saved palettes yet.";
    const emptySubtitle = isDeleted ? "Archived palettes will appear here" : "Click + to create a new palette";
    return `
      <div class="history-card-empty-state" aria-live="polite">
        <div class="history-card-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 28.8 28.8057" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M27.9 14.4C27.9 6.94415 21.8558 0.9 14.4 0.9C6.94415 0.9 0.9 6.94415 0.9 14.4C0.9 21.8558 6.94415 27.9 14.4 27.9C15.5363 27.9 17.1 28.057 17.1 26.55C17.1 25.7279 16.6723 25.0936 16.2476 24.4634C15.6261 23.5415 15.0106 22.6287 15.75 21.15C16.65 19.35 18.15 19.35 20.45 19.35C21.6001 19.35 22.9501 19.35 24.525 19.125C27.3614 18.7199 27.9 16.9763 27.9 14.4Z" stroke="currentColor" stroke-width="1.8"/>
            <path d="M11.025 11.7C12.1434 11.7 13.05 10.7934 13.05 9.675C13.05 8.55662 12.1434 7.65 11.025 7.65C9.90662 7.65 9 8.55662 9 9.675C9 10.7934 9.90662 11.7 11.025 11.7Z" stroke="currentColor" stroke-width="1.8"/>
            <path d="M20.475 13.05C21.5934 13.05 22.5 12.1434 22.5 11.025C22.5 9.90662 21.5934 9 20.475 9C19.3566 9 18.45 9.90662 18.45 11.025C18.45 12.1434 19.3566 13.05 20.475 13.05Z" stroke="currentColor" stroke-width="1.8"/>
          </svg>
        </div>
        <p class="history-card-empty-copy">${emptyTitle}<br>${emptySubtitle}</p>
      </div>
    `;
  }

  function renderTypefaceEmptyState(isDeleted) {
    if (!settingsUrlBetaSignedIn) return renderSignInEmptyState("typeface");
    const emptyTitle = isDeleted ? "No deleted typeface presets yet." : "No saved typeface presets yet.";
    const emptySubtitle = isDeleted ? "Archived typeface presets will appear here" : "Click + to save a typeface preset";
    return `
      <div class="history-card-empty-state" aria-live="polite">
        <div class="history-card-empty-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.6667 8H22.6667" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.6667 8V24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M13.3333 24H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="history-card-empty-copy">${emptyTitle}<br>${emptySubtitle}</p>
      </div>
    `;
  }

  function renderPaletteList(listEl, items, isDeleted) {
    if (!listEl) return;
    if (!items.length) {
      listEl.classList.add("is-empty");
      listEl.innerHTML = renderPaletteEmptyState(isDeleted);
      return;
    }
    listEl.classList.remove("is-empty");
    listEl.innerHTML = items.map((p, i) => `
      <div class="history-card-item palette-history-item${isDeleted ? " history-card-item-muted" : ""}" role="listitem" tabindex="0" aria-label="${isDeleted ? "Archived" : "Open"} ${p.name || paletteName(p.swatches)} palette" data-history-idx="${i}" data-history-id="${String(p.id ?? "")}" data-history-mode="${isDeleted ? "deleted" : "history"}" data-history-section="palette">
        <div class="history-card-item-surface">
          <div class="history-card-item-icon palette-history-item-icon">
            ${palettePreviewStripes(p.swatches)}
          </div>
          <div class="history-card-item-copy">
            <p class="history-card-item-title">${p.name || paletteName(p.swatches)}</p>
            <p class="history-card-item-meta">Saved ${timeAgo(p.updatedAt || p.savedAt)}</p>
          </div>
          <div class="history-card-item-menu-wrap">
            <button class="history-card-item-menu-trigger" type="button" aria-label="More actions" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderTypefaceList(listEl, items, isDeleted) {
    if (!listEl) return;
    if (!items.length) {
      listEl.classList.add("is-empty");
      listEl.innerHTML = renderTypefaceEmptyState(isDeleted);
      return;
    }
    listEl.classList.remove("is-empty");
    listEl.innerHTML = items.map((entry, i) => {
      const title = String(entry?.name || "Untitled Typeface");
      return `
        <div class="history-card-item typeface-history-item${isDeleted ? " history-card-item-muted" : ""}" role="listitem" tabindex="0" aria-label="${isDeleted ? "Archived" : "Open"} ${title} typeface preset" data-history-idx="${i}" data-history-id="${String(entry?.id ?? entry?.savedAt ?? i)}" data-history-ts="${Number(entry?.updatedAt || entry?.savedAt) || ""}" data-history-mode="${isDeleted ? "deleted" : "history"}" data-history-section="typeface">
          <div class="history-card-item-surface">
            <div class="history-card-item-icon typeface-history-item-icon">
              <span class="typeface-history-item-monogram">Aa</span>
            </div>
            <div class="history-card-item-copy">
              <p class="history-card-item-title">${title}</p>
              <p class="history-card-item-meta">Saved ${timeAgo(entry?.updatedAt || entry?.savedAt || Date.now())}</p>
            </div>
            <div class="history-card-item-menu-wrap">
              <button class="history-card-item-menu-trigger" type="button" aria-label="More actions" aria-expanded="false">
                <span></span><span></span><span></span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function archivePaletteHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const col = loadPaletteCollection();
    const entry = col.splice(idx, 1)[0];
    if (!entry) return false;
    savePaletteCollection(col);
    const deleted = loadDeletedPalettes();
    deleted.unshift(entry);
    saveDeletedPalettes(deleted);
    refreshHistoryCard();
    return true;
  }

  function deletePaletteHistoryEntry(idx) {
    return archivePaletteHistoryEntry(idx);
  }

  function permanentlyDeletePaletteHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const col = loadPaletteCollection();
    const entry = col[idx];
    if (!entry) return false;
    col.splice(idx, 1);
    savePaletteCollection(col);
    refreshHistoryCard();
    return true;
  }

  function restoreDeletedPaletteHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const deleted = loadDeletedPalettes();
    const entry = deleted.splice(idx, 1)[0];
    if (!entry) return false;
    const col = loadPaletteCollection();
    if (!canAddSavedHistoryEntry(col)) {
      showHistoryLimitToast("palette");
      return false;
    }
    saveDeletedPalettes(deleted);
    col.unshift(entry);
    savePaletteCollection(col);
    refreshHistoryCard();
    return true;
  }

  function permanentlyDeleteDeletedPaletteEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const deleted = loadDeletedPalettes();
    const entry = deleted[idx];
    if (!entry) return false;
    deleted.splice(idx, 1);
    saveDeletedPalettes(deleted);
    refreshHistoryCard();
    return true;
  }

  function renamePaletteHistoryEntry(idx, nextName) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const trimmed = String(nextName || "").trim();
    if (!trimmed) return false;
    const col = loadPaletteCollection();
    const entry = col[idx];
    if (!entry) return false;
    entry.name = trimmed;
    entry.updatedAt = Date.now();
    savePaletteCollection(col);
    refreshHistoryCard();
    return true;
  }

  function archiveTypefaceHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const col = loadTypefaceCollection();
    const entry = col.splice(idx, 1)[0];
    if (!entry) return false;
    saveTypefaceCollection(col);
    const deleted = loadDeletedTypefaces();
    deleted.unshift(entry);
    saveDeletedTypefaces(deleted);
    refreshHistoryCard();
    return true;
  }

  function permanentlyDeleteTypefaceHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const col = loadTypefaceCollection();
    const entry = col[idx];
    if (!entry) return false;
    col.splice(idx, 1);
    saveTypefaceCollection(col);
    refreshHistoryCard();
    return true;
  }

  function restoreDeletedTypefaceHistoryEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const deleted = loadDeletedTypefaces();
    const entry = deleted.splice(idx, 1)[0];
    if (!entry) return false;
    const col = loadTypefaceCollection();
    if (!canAddSavedHistoryEntry(col)) {
      showHistoryLimitToast("typeface");
      return false;
    }
    saveDeletedTypefaces(deleted);
    col.unshift(entry);
    saveTypefaceCollection(col);
    refreshHistoryCard();
    return true;
  }

  function permanentlyDeleteDeletedTypefaceEntry(idx) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const deleted = loadDeletedTypefaces();
    const entry = deleted[idx];
    if (!entry) return false;
    deleted.splice(idx, 1);
    saveDeletedTypefaces(deleted);
    refreshHistoryCard();
    return true;
  }

  function renameTypefaceHistoryEntry(idx, nextName) {
    if (!Number.isInteger(idx) || idx < 0) return false;
    const trimmed = String(nextName || "").trim();
    if (!trimmed) return false;
    const col = loadTypefaceCollection();
    const entry = col[idx];
    if (!entry) return false;
    entry.name = trimmed;
    entry.updatedAt = Date.now();
    saveTypefaceCollection(col);
    refreshHistoryCard();
    return true;
  }

  let activeHistoryRenameRestoreFocusEl = null;
  let activeHistoryRenamePaletteIdx = null;
  let activeHistoryRenameSection = "palette";

  const historyRenameDialog = document.createElement("div");
  historyRenameDialog.className = "styles-toolbar-preview-popover styles-toolbar-save-popover history-rename-dialog";
  historyRenameDialog.setAttribute("aria-hidden", "true");
  historyRenameDialog.setAttribute("role", "dialog");
  historyRenameDialog.setAttribute("aria-modal", "true");
  historyRenameDialog.innerHTML = `
    <div class="styles-toolbar-preview-card styles-toolbar-save-card">
      <div class="styles-toolbar-preview-header styles-toolbar-save-header">
        <div class="styles-toolbar-preview-title styles-toolbar-save-title">Rename Palette</div>
        <button class="styles-toolbar-preview-close styles-toolbar-save-close" type="button" aria-label="Close rename palette dialog">
          <span class="styles-toolbar-preview-close-icon" aria-hidden="true"></span>
        </button>
      </div>
      <div class="styles-toolbar-save-body">
        <p class="styles-toolbar-save-description">Update the palette name shown in Colour Palettes on the Project page.</p>
        <label class="styles-toolbar-save-field">
          <span class="styles-toolbar-save-label">Palette name</span>
          <input class="styles-toolbar-save-input" type="text" maxlength="60" placeholder="Enter palette name" />
        </label>
        <div class="styles-toolbar-save-actions">
          <button class="styles-toolbar-save-action styles-toolbar-save-action-secondary" type="button" data-history-rename-action="cancel">Cancel</button>
          <button class="styles-toolbar-save-action styles-toolbar-save-action-primary" type="button" data-history-rename-action="save">Rename palette</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(historyRenameDialog);

  const historyRenameDialogInput = historyRenameDialog.querySelector(".styles-toolbar-save-input");
  const historyRenameDialogCloseButton = historyRenameDialog.querySelector(".styles-toolbar-save-close");
  const historyRenameDialogCancelButton = historyRenameDialog.querySelector('[data-history-rename-action="cancel"]');
  const historyRenameDialogSaveButton = historyRenameDialog.querySelector('[data-history-rename-action="save"]');
  const historyRenameDialogTitle = historyRenameDialog.querySelector(".styles-toolbar-save-title");
  const historyRenameDialogDescription = historyRenameDialog.querySelector(".styles-toolbar-save-description");
  const historyRenameDialogLabel = historyRenameDialog.querySelector(".styles-toolbar-save-label");

  function applyHistoryRenameDialogCopy(section) {
    const isTypeface = section === "typeface";
    if (historyRenameDialogTitle) {
      historyRenameDialogTitle.textContent = isTypeface ? "Rename Typeface" : "Rename Palette";
    }
    if (historyRenameDialogDescription) {
      historyRenameDialogDescription.textContent = isTypeface
        ? "Update the typeface preset name shown in the Project sidebar."
        : "Update the palette name shown in Colour Palettes on the Project page.";
    }
    if (historyRenameDialogLabel) {
      historyRenameDialogLabel.textContent = isTypeface ? "Typeface name" : "Palette name";
    }
    if (historyRenameDialogInput) {
      historyRenameDialogInput.placeholder = isTypeface ? "Enter typeface name" : "Enter palette name";
    }
    if (historyRenameDialogSaveButton) {
      historyRenameDialogSaveButton.textContent = isTypeface ? "Rename typeface" : "Rename palette";
    }
  }

  function closeHistoryRenameDialog({ restoreFocus = false } = {}) {
    if (historyRenameDialog.contains(document.activeElement) && document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    historyRenameDialog.classList.remove("is-open");
    historyRenameDialog.setAttribute("aria-hidden", "true");
    activeHistoryRenamePaletteIdx = null;
    activeHistoryRenameSection = "palette";
    if (historyRenameDialogInput) historyRenameDialogInput.value = "";

    if (restoreFocus && activeHistoryRenameRestoreFocusEl && typeof activeHistoryRenameRestoreFocusEl.focus === "function") {
      activeHistoryRenameRestoreFocusEl.focus({ preventScroll: true });
    }

    activeHistoryRenameRestoreFocusEl = null;
  }

  function submitHistoryRenameDialog() {
    if (!Number.isInteger(activeHistoryRenamePaletteIdx) || !historyRenameDialogInput) return false;
    const nextName = historyRenameDialogInput.value.trim();
    if (!nextName) {
      historyRenameDialogInput.focus();
      return false;
    }
    const didRename = activeHistoryRenameSection === "typeface"
      ? renameTypefaceHistoryEntry(activeHistoryRenamePaletteIdx, nextName)
      : renamePaletteHistoryEntry(activeHistoryRenamePaletteIdx, nextName);
    if (didRename) {
      closeHistoryRenameDialog();
    }
    return didRename;
  }

  function openHistoryRenameDialog(idx, currentName, restoreFocusEl = null, section = "palette") {
    if (!Number.isInteger(idx) || idx < 0 || !historyRenameDialogInput) return;
    activeHistoryRenamePaletteIdx = idx;
    activeHistoryRenameSection = section === "typeface" ? "typeface" : "palette";
    activeHistoryRenameRestoreFocusEl = restoreFocusEl;
    applyHistoryRenameDialogCopy(activeHistoryRenameSection);
    historyRenameDialogInput.value = currentName || "";
    historyRenameDialog.classList.add("is-open");
    historyRenameDialog.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      historyRenameDialogInput.focus({ preventScroll: true });
      historyRenameDialogInput.select();
    });
  }

  if (historyRenameDialogCloseButton) {
    historyRenameDialogCloseButton.addEventListener("click", () => {
      closeHistoryRenameDialog({ restoreFocus: true });
    });
  }

  if (historyRenameDialogCancelButton) {
    historyRenameDialogCancelButton.addEventListener("click", () => {
      closeHistoryRenameDialog({ restoreFocus: true });
    });
  }

  if (historyRenameDialogSaveButton) {
    historyRenameDialogSaveButton.addEventListener("click", () => {
      submitHistoryRenameDialog();
    });
  }

  historyRenameDialog.addEventListener("click", (event) => {
    if (event.target === historyRenameDialog) {
      closeHistoryRenameDialog({ restoreFocus: true });
    }
  });

  if (historyRenameDialogInput) {
    historyRenameDialogInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitHistoryRenameDialog();
      }
    });
  }

  applyHistoryRenameDialogCopy("palette");

  let historyActiveTab = "history"; // "history" | "deleted"
  let historyCurrentSection = "palette"; // "palette" | "typeface"

  function getHistorySectionLabel(section) {
    if (typeof historyShared.getHistorySectionLabel === "function") {
      return historyShared.getHistorySectionLabel(section);
    }
    return section === "typeface" ? "Typeface" : "Colour Palettes";
  }

  function renderHistoryList(listEl, section = historyCurrentSection, tab = historyActiveTab) {
    if (!listEl) return;
    const isDeleted = tab === "deleted";
    if (section === "typeface") {
      const items = isDeleted ? loadDeletedTypefaces() : loadTypefaceCollection();
      renderTypefaceList(listEl, items, isDeleted);
      return;
    }
    const items = isDeleted ? loadDeletedPalettes() : loadPaletteCollection();
    renderPaletteList(listEl, items, isDeleted);
  }

  function syncHistorySectionUi() {
    const isTypeface = historyCurrentSection === "typeface";
    const historyCardBody = document.querySelector(".history-card-body");
    const historyCardList = document.getElementById("historyCardList");

    historyHeaderMenuItems.forEach((menuItem) => {
      menuItem.classList.toggle("is-active", menuItem.dataset.historyDestination === historyCurrentSection);
    });

    if (historyCardBody) {
      historyCardBody.dataset.historySection = historyCurrentSection;
      historyCardBody.classList.toggle("history-card-body--palette", !isTypeface);
      historyCardBody.classList.toggle("history-card-body--typeface", isTypeface);
    }

    const labelText = historyHeaderLabelBtn ? historyHeaderLabelBtn.querySelector("span") : null;
    if (labelText) {
      labelText.textContent = getHistorySectionLabel(historyCurrentSection);
    }

    if (historyHeaderLabelBtn) {
      historyHeaderLabelBtn.dataset.historySection = historyCurrentSection;
      historyHeaderLabelBtn.classList.toggle("history-card-header-label--palette", !isTypeface);
      historyHeaderLabelBtn.classList.toggle("history-card-header-label--typeface", isTypeface);
    }

    if (addBtn) {
      const addLabel = isTypeface ? "Create new typeface preset" : "Create new palette";
      addBtn.setAttribute("aria-label", addLabel);
      addBtn.setAttribute("data-tooltip", addLabel);
      addBtn.dataset.historySection = historyCurrentSection;
      addBtn.classList.toggle("history-card-add-btn--palette", !isTypeface);
      addBtn.classList.toggle("history-card-add-btn--typeface", isTypeface);
    }

    if (historyExpandBtn) {
      const expandLabel = isTypeface ? "Expand typeface presets" : "Expand colour palettes";
      historyExpandBtn.setAttribute("aria-label", expandLabel);
      historyExpandBtn.dataset.historySection = historyCurrentSection;
      historyExpandBtn.classList.toggle("history-card-expand-btn--palette", !isTypeface);
      historyExpandBtn.classList.toggle("history-card-expand-btn--typeface", isTypeface);
    }

    if (historyCardList) {
      historyCardList.dataset.historySection = historyCurrentSection;
      historyCardList.classList.toggle("history-card-list--palette", !isTypeface);
      historyCardList.classList.toggle("history-card-list--typeface", isTypeface);
    }
  }

  function refreshHistoryCard() {
    const listEl = document.getElementById("historyCardList");
    if (listEl) {
      renderHistoryList(listEl, historyCurrentSection, historyActiveTab);
    }
    /* Keep popup in sync if it's open */
    const _popup = document.getElementById("historyPopup");
    if (_popup && !_popup.classList.contains("hidden") && window.__motvinCode2DesignHistoryPopup && typeof window.__motvinCode2DesignHistoryPopup.render === "function") {
      window.__motvinCode2DesignHistoryPopup.render();
    }
  }

  function closeHistoryItemMenus(exceptItem = null) {
    document.querySelectorAll(".history-card-item[data-menu-open='true']").forEach((item) => {
      if (exceptItem && item === exceptItem) return;
      item.dataset.menuOpen = "false";
      const trigger = item.querySelector(".history-card-item-menu-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
    historyItemFloatingMenu.classList.add("hidden");
    historyItemFloatingMenu.dataset.historyIdx = "";
    historyItemFloatingMenu.dataset.historyMode = "";
    historyItemFloatingMenu.dataset.section = "";
  }

  function setHistoryItemFloatingMenuMode(mode) {
    historyItemFloatingMenu.dataset.historyMode = mode || "";
    historyItemFloatingMenu.innerHTML = mode === "deleted"
      ? `
        <button class="history-card-item-menu-item" type="button" role="menuitem" data-history-action="restore">Restore</button>
        <button class="history-card-item-menu-item is-danger" type="button" role="menuitem" data-history-action="delete-permanently">Permanent Delete</button>
      `
      : `
        <button class="history-card-item-menu-item" type="button" role="menuitem" data-history-action="rename">Rename</button>
        <button class="history-card-item-menu-item" type="button" role="menuitem" data-history-action="duplicate">Duplicate</button>
        <button class="history-card-item-menu-item" type="button" role="menuitem" data-history-action="archive">Archive</button>
      `;
  }

  const historyItemFloatingMenu = document.createElement("div");
  historyItemFloatingMenu.className = "history-card-floating-menu hidden";
  setHistoryItemFloatingMenuMode("history");
  document.body.appendChild(historyItemFloatingMenu);

  function positionHistoryItemMenu(trigger, menu) {
    if (!trigger || !menu) return;
    const gap = 6;
    const viewportPad = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let left = triggerRect.right - menuRect.width;
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - menuRect.width - viewportPad));

    let top = triggerRect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - viewportPad) {
      top = triggerRect.top - menuRect.height - gap;
    }
    top = Math.max(viewportPad, top);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  /* Tab switching */
  document.querySelectorAll(".history-card-tab").forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".history-card-tab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      historyActiveTab = idx === 0 ? "history" : "deleted";
      refreshHistoryCard();
    });
  });

  /* Add button — open Styles with a fresh palette */
  const addBtn = document.querySelector(".history-card-add-btn");
  const historyHeaderLabelBtn = document.querySelector(".history-card-header-label");
  const historyHeaderMenu = document.getElementById("historyCardHeaderMenu");
  const historyHeaderMenuItems = historyHeaderMenu
    ? Array.from(historyHeaderMenu.querySelectorAll(".history-card-header-menu-item"))
    : [];

  const setHistoryHeaderMenuOpen = (nextOpen) => {
    if (!historyHeaderLabelBtn || !historyHeaderMenu) return;
    historyHeaderLabelBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    historyHeaderMenu.classList.toggle("hidden", !nextOpen);
  };

  if (historyHeaderLabelBtn && historyHeaderMenu) {
    historyHeaderLabelBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = historyHeaderMenu.classList.contains("hidden");
      setHistoryHeaderMenuOpen(nextOpen);
    });

    historyHeaderMenuItems.forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const destination = item.dataset.historyDestination;
        setHistoryHeaderMenuOpen(false);
        historyCurrentSection = destination === "typeface" ? "typeface" : "palette";
        syncHistorySectionUi();
        refreshHistoryCard();
      });
    });

    document.addEventListener("click", (event) => {
      if (!historyHeaderMenu.classList.contains("hidden") && !historyHeaderMenu.contains(event.target) && !historyHeaderLabelBtn.contains(event.target)) {
        setHistoryHeaderMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !historyHeaderMenu.classList.contains("hidden")) {
        setHistoryHeaderMenuOpen(false);
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (!settingsUrlBetaSignedIn) {
        showSignInRequiredToast(historyCurrentSection === "typeface" ? "save typefaces" : "save palettes");
        return;
      }
      if (historyCurrentSection === "typeface") {
        if (!canAddSavedHistoryEntry(loadTypefaceCollection())) {
          showHistoryLimitToast("typeface");
          return;
        }
        try {
          sessionStorage.removeItem(TYPEFACE_PENDING_SNAPSHOT_KEY);
          sessionStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
          sessionStorage.setItem(TYPEFACE_FORCE_NEW_KEY, "1");
        } catch {
          try {
            localStorage.removeItem(TYPEFACE_PENDING_SNAPSHOT_KEY);
            localStorage.removeItem(TYPEFACE_EDITING_ID_KEY);
            localStorage.setItem(TYPEFACE_FORCE_NEW_KEY, "1");
          } catch {}
        }
        navigateWithPageSwitch(prepareEditorPageSwitch("typeface.html"));
        return;
      }
      if (!canAddSavedHistoryEntry(loadPaletteCollection())) {
        showHistoryLimitToast("palette");
        return;
      }
      try { localStorage.removeItem(PALETTE_EDITING_ID_KEY); } catch {}
      navigateWithPageSwitch(prepareEditorPageSwitch(getCreatePaletteHref()));
    });
  }

  /* ── History Expand Popup ── */
  const historyExpandBtn = document.querySelector(".history-card-expand-btn");
  const historyPopup = document.getElementById("historyPopup");
  let historyPopupController = null;

  function syncSidebarHistoryTabs(activeMode = historyActiveTab) {
    document.querySelectorAll(".history-card-tab").forEach((tab, idx) => {
      const isActive = (activeMode === "history" ? 0 : 1) === idx;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function loadHistoryPopupEntries(section, mode) {
    if (section === "typeface") {
      return mode === "deleted" ? loadDeletedTypefaces() : loadTypefaceCollection();
    }
    return mode === "deleted" ? loadDeletedPalettes() : loadPaletteCollection();
  }

  function saveHistoryPopupEntries(section, mode, entries) {
    if (section === "typeface") {
      if (mode === "deleted") saveDeletedTypefaces(entries);
      else saveTypefaceCollection(entries);
      return;
    }
    if (mode === "deleted") saveDeletedPalettes(entries);
    else savePaletteCollection(entries);
  }

  function openHistoryPopupForSection(section = "palette") {
    historyCurrentSection = section === "typeface" ? "typeface" : "palette";
    historyActiveTab = "history";
    syncHistorySectionUi();
    syncSidebarHistoryTabs(historyActiveTab);
    openHistoryPopup();
  }

  function openHistoryPopup() {
    if (historyPopupController) historyPopupController.open(historyCurrentSection);
  }

  function closeHistoryPopup() {
    if (historyPopupController) historyPopupController.close();
  }

  if (historyPopup && typeof window.__motvinCreateHistoryPopupController === "function") {
    historyPopupController = window.__motvinCreateHistoryPopupController({
      defaultSection: historyCurrentSection,
      getCurrentSection: () => historyCurrentSection,
      getCurrentMode: () => historyActiveTab,
      loadEntries: loadHistoryPopupEntries,
      saveEntries: saveHistoryPopupEntries,
      notify: typeof showToast === "function" ? showToast : undefined,
      onSectionChange: (section) => {
        historyCurrentSection = section === "typeface" ? "typeface" : "palette";
        syncHistorySectionUi();
        refreshHistoryCard();
      },
      onModeChange: (mode) => {
        historyActiveTab = mode === "deleted" ? "deleted" : "history";
        syncSidebarHistoryTabs(historyActiveTab);
        refreshHistoryCard();
      },
      openEntry: ({ index, section, mode, close }) => {
        if (mode === "deleted") return false;
        if (section === "typeface") {
          const collection = loadTypefaceCollection();
          const entry = collection[index];
          if (!entry?.snapshot) return false;
          try {
            sessionStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot));
          } catch {
            try { localStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot)); } catch {}
          }
          try {
            sessionStorage.removeItem(TYPEFACE_FORCE_NEW_KEY);
          } catch {
            try { localStorage.removeItem(TYPEFACE_FORCE_NEW_KEY); } catch {}
          }
          try {
            sessionStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || ""));
          } catch {
            try { localStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch {}
          }
          close();
          navigateWithPageSwitch(prepareEditorPageSwitch("typeface.html"));
          return true;
        }

        const collection = loadPaletteCollection();
        const entry = collection[index];
        if (!entry) return false;
        try { localStorage.setItem(PALETTE_STATE_KEY, JSON.stringify(entry.swatches || entry.state || [])); } catch {}
        try { localStorage.setItem(PALETTE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch {}
        close();
        navigateWithPageSwitch(prepareEditorPageSwitch("styles.html"));
        return true;
      },
    });
    window.__motvinCode2DesignHistoryPopup = historyPopupController;
  }

  if (historyExpandBtn) {
    historyExpandBtn.addEventListener("click", () => openHistoryPopup());
  }
  window.__motvinOpenHistoryPopup = openHistoryPopupForSection;
  window.__motvinGetFirebaseService = getSettingsFirebaseUrlBetaService;
  document.addEventListener("click", (event) => {
    const historyToolbarTrigger = event.target.closest("[data-history-popup-trigger]");
    if (!historyToolbarTrigger) return;
    event.preventDefault();
    openHistoryPopupForSection(historyToolbarTrigger.dataset.historyPopupTrigger);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && historyRenameDialog.classList.contains("is-open")) {
      closeHistoryRenameDialog({ restoreFocus: true });
      return;
    }
    if (e.key === "Escape" && historyPopup && !historyPopup.classList.contains("hidden")) {
      closeHistoryPopup();
    }
  });

  /* Click a saved palette → load it into Styles tab */
  document.addEventListener("click", (e) => {
    if (e.target.closest("#historyPopup")) {
      return;
    }
    const menuAction = e.target.closest(".history-card-item-menu-item");
    if (menuAction && historyItemFloatingMenu.contains(menuAction)) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(historyItemFloatingMenu.dataset.historyIdx || "", 10);
      if (isNaN(idx)) return;
      const action = menuAction.dataset.historyAction;
      const mode = historyItemFloatingMenu.dataset.historyMode || "history";
      const section = historyItemFloatingMenu.dataset.section === "typeface" ? "typeface" : "palette";
      const restoreFocusEl = document.querySelector(`.history-card-item[data-history-mode='${mode}'][data-history-idx='${idx}'] .history-card-item-menu-trigger`);
      closeHistoryItemMenus();
      if (action === "rename") {
        const title = section === "typeface"
          ? loadTypefaceCollection()[idx]?.name || ""
          : loadPaletteCollection()[idx]?.name || "";
        openHistoryRenameDialog(idx, title, restoreFocusEl || document.activeElement, section);
        return;
      }
      if (action === "archive") {
        if (section === "typeface") {
          archiveTypefaceHistoryEntry(idx);
        } else {
          archivePaletteHistoryEntry(idx);
        }
        return;
      }
      if (action === "duplicate") {
        if (section === "typeface") {
          const col = loadTypefaceCollection();
          const entry = col[idx];
          if (entry) {
            if (!canAddSavedHistoryEntry(col)) {
              showHistoryLimitToast("typeface");
              return;
            }
            const clone = JSON.parse(JSON.stringify(entry));
            clone.name = buildUniqueDuplicateHistoryName(col, clone.name, "Untitled Typeface");
            clone.savedAt = Date.now();
            col.splice(idx + 1, 0, clone);
            saveTypefaceCollection(col);
            refreshHistoryCard();
          }
        } else {
          const col = loadPaletteCollection();
          const entry = col[idx];
          if (entry) {
            if (!canAddSavedHistoryEntry(col)) {
              showHistoryLimitToast("palette");
              return;
            }
            const clone = JSON.parse(JSON.stringify(entry));
            clone.name = buildUniqueDuplicateHistoryName(col, clone.name, "Untitled Palette");
            clone.savedAt = Date.now();
            col.splice(idx + 1, 0, clone);
            savePaletteCollection(col);
            refreshHistoryCard();
          }
        }
        return;
      }
      if (action === "restore") {
        if (section === "typeface") {
          restoreDeletedTypefaceHistoryEntry(idx);
        } else {
          restoreDeletedPaletteHistoryEntry(idx);
        }
        return;
      }
      if (action === "delete-permanently") {
        if (section === "typeface") {
          permanentlyDeleteDeletedTypefaceEntry(idx);
        } else {
          permanentlyDeleteDeletedPaletteEntry(idx);
        }
        return;
      }
      return;
    }

    const menuTrigger = e.target.closest(".history-card-item-menu-trigger");
    if (menuTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const item = menuTrigger.closest(".history-card-item");
      if (!item) return;
      const isOpen = item.dataset.menuOpen === "true";
      const nextMode = String(item.dataset.historyMode || "history");
      closeHistoryItemMenus(item);
      item.dataset.menuOpen = isOpen ? "false" : "true";
      menuTrigger.setAttribute("aria-expanded", isOpen ? "false" : "true");
      if (!isOpen) setHistoryItemFloatingMenuMode(nextMode);
      historyItemFloatingMenu.classList.toggle("hidden", isOpen);
      historyItemFloatingMenu.dataset.historyIdx = isOpen ? "" : String(item.dataset.historyIdx || "");
      historyItemFloatingMenu.dataset.historyMode = isOpen ? "" : nextMode;
      historyItemFloatingMenu.dataset.section = isOpen ? "" : historyCurrentSection;
      if (!isOpen) positionHistoryItemMenu(menuTrigger, historyItemFloatingMenu);
      return;
    }

    const item = e.target.closest(".history-card-item");
    if (!item) {
      closeHistoryItemMenus();
      return;
    }
    if (e.target.closest(".history-card-item-menu-wrap")) return;
    const mode = item.dataset.historyMode;
    const idx = parseInt(item.dataset.historyIdx, 10);
    if (isNaN(idx)) return;

    if (mode === "history") {
      const isPopupItem = Boolean(item.closest("#historyPopup"));
      if (historyCurrentSection === "typeface") {
        const collection = loadTypefaceCollection();
        const entry = collection[idx];
        if (!entry?.snapshot) return;

        try {
          sessionStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot));
        } catch {
          try { localStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot)); } catch {}
        }
        try {
          sessionStorage.removeItem(TYPEFACE_FORCE_NEW_KEY);
        } catch {
          try { localStorage.removeItem(TYPEFACE_FORCE_NEW_KEY); } catch {}
        }
        try {
          sessionStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || ""));
        } catch {
          try { localStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch {}
        }

        item.style.opacity = "0.5";
        setTimeout(() => { item.style.opacity = ""; }, 300);

        if (isPopupItem) closeHistoryPopup();
        navigateWithPageSwitch(prepareEditorPageSwitch("typeface.html"));
        return;
      }

      const col = loadPaletteCollection();
      const entry = col[idx];
      if (!entry) return;

      try {
        localStorage.setItem(PALETTE_STATE_KEY, JSON.stringify(entry.swatches || entry.state || []));
      } catch {}
      try {
        localStorage.setItem(PALETTE_EDITING_ID_KEY, String(entry.savedAt || ""));
      } catch {}

      item.style.opacity = "0.5";
      setTimeout(() => { item.style.opacity = ""; }, 300);

      if (isPopupItem) closeHistoryPopup();
      navigateWithPageSwitch(prepareEditorPageSwitch("styles.html"));
    } else if (mode === "deleted") {
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeHistoryItemMenus();
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".history-card-item");
    if (!item) return;
    if (item.closest("#historyPopup")) return;
    e.preventDefault();
    item.click();
  });

  window.addEventListener("resize", () => closeHistoryItemMenus());
  document.addEventListener("scroll", () => closeHistoryItemMenus(), true);

  /* Listen for storage changes from Styles tab */
  window.addEventListener("storage", (e) => {
    if (
      e.key === PALETTE_COLLECTION_KEY
      || e.key === PALETTE_DELETED_KEY
      || e.key === TYPEFACE_COLLECTION_KEY
      || e.key === TYPEFACE_DELETED_KEY
    ) {
      refreshHistoryCard();
    }
  });

  window.addEventListener("motvin:history-storage-change", (e) => {
    if (
      e.detail?.key === PALETTE_COLLECTION_KEY
      || e.detail?.key === PALETTE_DELETED_KEY
      || e.detail?.key === TYPEFACE_COLLECTION_KEY
      || e.detail?.key === TYPEFACE_DELETED_KEY
    ) {
      refreshHistoryCard();
    }
  });

  /* Initial render */
  syncHistorySectionUi();
  refreshHistoryCard();
});
