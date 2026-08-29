/* ==============================================================
   Motvin Updates — Script
   Connects to Firebase Firestore "updates" collection,
   renders a Spline-style changelog feed.
   ============================================================== */

(() => {
  'use strict';

  /* ─── Firebase Config ─── */
  // Uses the same Firebase project as the main Motvin app.
  const firebaseConfig = {
    apiKey: 'AIzaSyBgW94s3aYLnz8_6g9bli42Ev_kNbOAyIM',
    authDomain: 'motvin-prod.firebaseapp.com',
    projectId: 'motvin-prod',
    appId: '1:177361046673:web:7c69a0e2d1755b89558330',
    messagingSenderId: '177361046673',
    storageBucket: 'motvin-prod.firebasestorage.app',
  };

  const updatesCollectionCandidates = ['updates-feed', 'updatesFeed', 'updates'];
  const ownerAdminEmails = ['surendarv638@gmail.com'];
  const adminCollectionName = 'releaseNotesAdmins';

  function hasRequiredFirebaseConfig(config) {
    return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  /* ─── Init Firebase ─── */
  const app = hasRequiredFirebaseConfig(firebaseConfig)
    ? (firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig))
    : null;
  const auth = app ? firebase.auth(app) : null;
  const db = app ? firebase.firestore(app) : null;
  const provider = auth ? new firebase.auth.GoogleAuthProvider() : null;

  if (provider) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }

  /* ─── DOM Refs ─── */
  const feedEl    = document.getElementById('updatesFeed');
  const loadingEl = document.getElementById('loadingState');
  const loginLink = document.getElementById('loginLink');
  const headerContainer = document.querySelector('.header .container');
  const navMenu = document.getElementById('navMenu');
  const navMenuToggle = document.getElementById('navMenuToggle');
  let publicAuthBanner = null;

  const html = document.documentElement;
  const releaseQueryKey = 'release';
  // Keep admin routing portable across direct MOTVIN hosting and nested parent-site mounts.
  const updatesAdminPath = './admin.html';
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getSystemTheme() {
    return 'light'; // Always default to light theme per user request
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isOwnerAdmin(email) {
    return ownerAdminEmails.includes(normalizeEmail(email));
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
  }

  function syncThemeMode() {
    applyTheme(getSystemTheme());
  }

  function initMobileNav() {
    if (!navMenu || !navMenuToggle) {
      return;
    }

    const mobileQuery = window.matchMedia('(max-width: 680px)');
    const handleViewportChange = (event) => {
      if (!event.matches) {
        closeMenu();
      }
    };

    function closeMenu() {
      navMenu.classList.remove('is-open');
      navMenuToggle.setAttribute('aria-expanded', 'false');
      navMenuToggle.setAttribute('aria-label', 'Open navigation menu');
    }

    function openMenu() {
      navMenu.classList.add('is-open');
      navMenuToggle.setAttribute('aria-expanded', 'true');
      navMenuToggle.setAttribute('aria-label', 'Close navigation menu');
    }

    navMenuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('is-open');
      if (isOpen) {
        closeMenu();
        return;
      }
      openMenu();
    });

    document.addEventListener('click', (event) => {
      if (!mobileQuery.matches) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (navMenu.contains(target) || navMenuToggle.contains(target)) {
        return;
      }

      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    navMenu.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest('a, button')) {
        closeMenu();
      }
    });

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleViewportChange);
    }

    closeMenu();
  }

  syncThemeMode();

  const handleThemeQueryChange = () => {
    syncThemeMode();
  };

  const handleThemeResync = () => {
    syncThemeMode();
  };

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', handleThemeQueryChange);
  } else if (typeof systemThemeQuery.addListener === 'function') {
    systemThemeQuery.addListener(handleThemeQueryChange);
  }

  window.addEventListener('focus', handleThemeResync);
  window.addEventListener('pageshow', handleThemeResync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleThemeResync();
    }
  });

  /* ─── Helpers ─── */
  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function getReleaseTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get(releaseQueryKey) || '';
  }

  function buildReleaseIdentifier(data, docId) {
    return data?.share?.slug || slugify(data?.title) || docId;
  }

  function buildShareUrl(data, docId) {
    const url = new URL(window.location.href);
    url.searchParams.set(releaseQueryKey, buildReleaseIdentifier(data, docId));
    return url.toString();
  }

  function buildShareText(data) {
    const shareTitle = data?.share?.title || data?.title || 'Motvin update';
    const shareSummary = data?.share?.summary || data?.description || 'See what changed in Motvin.';
    return `${shareTitle} — ${shareSummary}`;
  }

  function buildChangeItems(changes = {}) {
    const items = [];

    if (Array.isArray(changes.features)) {
      changes.features.forEach((item) => items.push(item));
    }
    if (Array.isArray(changes.improvements)) {
      changes.improvements.forEach((item) => items.push(item));
    }
    if (Array.isArray(changes.fixes)) {
      changes.fixes.forEach((item) => items.push(item));
    }

    return items;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const result = document.execCommand('copy');
    document.body.removeChild(input);
    return result;
  }

  async function shareRelease(button) {
    const shareUrl = button.dataset.shareUrl || '';
    const shareText = button.dataset.shareText || 'Motvin update';
    const shareTitle = button.dataset.shareTitle || 'Motvin';

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        button.textContent = 'Shared';
      } else {
        await copyToClipboard(shareUrl);
        button.textContent = 'Link copied';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }

    window.setTimeout(() => {
      button.textContent = 'Share';
    }, 1800);
  }

  function focusTargetRelease() {
    const targetRelease = getReleaseTarget();
    if (!targetRelease) {
      return;
    }

    const target = document.querySelector(`[data-release-id="${CSS.escape(targetRelease)}"]`);
    if (!target) {
      return;
    }

    target.classList.add('update-target');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderMessage(className, message) {
    feedEl.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
  }

  function setPublicAuthBanner(message = '', tone = 'neutral') {
    if (!message) {
      if (publicAuthBanner) {
        publicAuthBanner.remove();
        publicAuthBanner = null;
      }
      return;
    }

    if (!headerContainer) {
      return;
    }

    if (!publicAuthBanner) {
      publicAuthBanner = document.createElement('div');
      publicAuthBanner.className = 'public-auth-banner';
      headerContainer.insertBefore(publicAuthBanner, headerContainer.firstChild);
    }

    publicAuthBanner.textContent = message;
    publicAuthBanner.dataset.tone = tone;
  }

  async function hasReleaseNotesAdminAccess(user) {
    const email = normalizeEmail(user?.email);

    if (!email || !db) {
      return false;
    }

    if (isOwnerAdmin(email)) {
      return true;
    }

    try {
      const snapshot = await db.collection(adminCollectionName).doc(email).get();
      return snapshot.exists;
    } catch (error) {
      console.error('Failed to verify release notes admin access:', error);
      return false;
    }
  }

  function updateLoginLinkLabel(user, canAccessAdmin = false) {
    if (!loginLink) {
      return;
    }

    if (!user) {
      loginLink.textContent = 'Log in';
      loginLink.setAttribute('href', updatesAdminPath);
      return;
    }

    loginLink.textContent = canAccessAdmin ? 'Admin' : 'Logout';
    loginLink.setAttribute('href', canAccessAdmin ? updatesAdminPath : '#');
  }

  // Wait for this page's own compat Auth instance to observe the uid the
  // shared FirebaseAuthService just signed in, so Firestore (compat) reads
  // below carry the right ID token. Both SDKs persist to the same IndexedDB
  // store on this origin, so this normally resolves almost immediately.
  function waitForCompatAuthUid(uid, timeoutMs = 4000) {
    if (!uid || !auth) return Promise.resolve(null);
    if (auth.currentUser && auth.currentUser.uid === uid) {
      return Promise.resolve(auth.currentUser);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (user) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        unsub();
        resolve(user);
      };
      const unsub = auth.onAuthStateChanged((user) => {
        if (user && user.uid === uid) finish(user);
      });
      const poll = setInterval(() => {
        if (auth.currentUser && auth.currentUser.uid === uid) finish(auth.currentUser);
      }, 150);
      setTimeout(() => finish(auth.currentUser || null), timeoutMs);
    });
  }

  async function handleLogout(event) {
    if (!auth || !loginLink) {
      return;
    }

    event.preventDefault();

    try {
      if (window.FirebaseAuthService) {
        await window.FirebaseAuthService.logout();
      }
      await auth.signOut();
      updateLoginLinkLabel(null, false);
      setPublicAuthBanner('');
    } catch (error) {
      console.error('Sign-out failed:', error);
      setPublicAuthBanner('Unable to sign out right now. Please try again.', 'error');
    }
  }

  async function handleGoogleLogin(event) {
    if (!auth || !provider || !loginLink) {
      return;
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const canAccessAdmin = await hasReleaseNotesAdminAccess(currentUser);
      event.preventDefault();

      if (canAccessAdmin) {
        window.location.href = updatesAdminPath;
        return;
      }

      if (!canAccessAdmin) {
        await handleLogout(event);
        return;
      }
    }

    event.preventDefault();

    const originalLabel = loginLink.textContent;
    loginLink.textContent = 'Signing in...';

    try {
      // Sign in through the single shared Google auth service (also used by
      // the root site and the MOTVIN app) so login state stays consistent
      // everywhere instead of running an independent sign-in here.
      let user = null;
      if (window.FirebaseAuthService) {
        const sharedUser = await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
        if (!sharedUser) {
          loginLink.textContent = originalLabel;
          return;
        }
        user = (await waitForCompatAuthUid(sharedUser.uid)) || sharedUser;
      } else {
        const result = await auth.signInWithPopup(provider);
        user = result?.user || auth.currentUser;
      }

      const canAccessAdmin = await hasReleaseNotesAdminAccess(user);

      updateLoginLinkLabel(user, canAccessAdmin);

      if (canAccessAdmin) {
        window.location.href = updatesAdminPath;
        return;
      }

      updateLoginLinkLabel(user, false);
      setPublicAuthBanner('');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      loginLink.textContent = originalLabel;
      setPublicAuthBanner('Google sign-in failed. Please try again.', 'error');
    }
  }

  function bindPublicLogin() {
    if (!loginLink || !auth || !provider) {
      return;
    }

    loginLink.addEventListener('click', handleGoogleLogin);

    // Paint an optimistic best-guess label synchronously from the shared,
    // same-origin auth snapshot instead of leaving the default "Log in"
    // markup showing until this compat SDK's own async restore resolves
    // below (admin access still gets confirmed once it does).
    if (window.FirebaseAuthService && typeof window.FirebaseAuthService.getCachedUser === 'function') {
      const cachedUser = window.FirebaseAuthService.getCachedUser();
      if (cachedUser && !cachedUser.isAnonymous) updateLoginLinkLabel(cachedUser, false);
    }

    auth.onAuthStateChanged(async (user) => {
      // Guest sessions (Firebase Anonymous Auth, used elsewhere for
      // per-account notification read-state) share this same origin's auth
      // persistence, so `user` can be a truthy anonymous object here even
      // for someone who never actually signed in.
      if (!user || user.isAnonymous) {
        updateLoginLinkLabel(null, false);
        setPublicAuthBanner('');
        return;
      }

      const canAccessAdmin = await hasReleaseNotesAdminAccess(user);
      updateLoginLinkLabel(user, canAccessAdmin);

      if (canAccessAdmin) {
        setPublicAuthBanner('Signed in with release-notes admin access.', 'success');
      } else {
        setPublicAuthBanner('');
      }
    });
  }

  function renderChangeList(changes) {
    const items = buildChangeItems(changes);
    if (!items.length) return '';
    const listItems = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `
      <div class="changes">
        <h3 class="changes-title">Changes</h3>
        <ul class="change-list change-list-flat">${listItems}</ul>
      </div>`;
  }

  /* ─── Render a single update entry ─── */
  function renderUpdate(data, index, docId) {
    const imageSection = data.image
      ? `<div class="update-image"><img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title || 'Update preview')}" loading="lazy" /></div>`
      : '';

    const changesHtml = renderChangeList(data.changes || {});
    const shareUrl = buildShareUrl(data, docId);
    const releaseId = buildReleaseIdentifier(data, docId);
    const shareText = buildShareText(data);

    return `
      <article class="update" data-release-id="${escapeHtml(releaseId)}" style="animation-delay: ${index * 0.07}s">
        <div class="update-grid">
          <div class="update-sidebar">
            <div class="update-sidebar-sticky">
              <a class="update-title-link" href="${escapeHtml(shareUrl)}">
                <h2 class="update-title">${escapeHtml(data.title || 'Untitled Update')}</h2>
              </a>
              <time class="update-date">${formatDate(data.date)}</time>
            </div>
          </div>
          <div class="update-main">
            ${imageSection}
            ${data.description ? `<p class="update-desc">${escapeHtml(data.description)}</p>` : ''}
            ${changesHtml}
            <div class="update-meta-row">
              <button class="update-share update-share-minimal" type="button" data-share-url="${escapeHtml(shareUrl)}" data-share-text="${escapeHtml(shareText)}" data-share-title="${escapeHtml(data.title || 'Motvin update')}">Share</button>
            </div>
          </div>
        </div>
      </article>`;
  }

  /* ─── Fetch & Render ─── */
  async function getUpdatesSnapshot() {
    let missingIndexDetected = false;

    for (const collectionName of updatesCollectionCandidates) {
      try {
        return await db
          .collection(collectionName)
          .orderBy('date', 'desc')
          .get();
      } catch (err) {
        const errorCode = String(err?.code || '');

        if (errorCode === 'failed-precondition') {
          missingIndexDetected = true;
          continue;
        }

        if (errorCode === 'permission-denied' || errorCode === 'unauthenticated') {
          throw err;
        }
      }
    }

    if (missingIndexDetected) {
      throw new Error('missing-firestore-index');
    }

    return null;
  }

  async function loadUpdates() {
    if (!db) {
      loadingEl.remove();
      renderMessage('error-state', 'Firebase is not configured for this page.');
      return;
    }

    try {
      const snapshot = await getUpdatesSnapshot();

      loadingEl.remove();

      if (!snapshot) {
        renderMessage('empty-state', 'No updates collection was found yet. Add documents to Updates Feed to populate this page.');
        return;
      }

      if (snapshot.empty) {
        renderMessage('empty-state', 'No updates yet. Check back soon.');
        return;
      }

      let html = '';
      snapshot.docs.forEach((doc, i) => {
        html += renderUpdate(doc.data(), i, doc.id);
      });
      feedEl.innerHTML = html;
      feedEl.querySelectorAll('.update-share').forEach((button) => {
        button.addEventListener('click', () => {
          shareRelease(button);
        });
      });
      focusTargetRelease();
    } catch (err) {
      console.error('Failed to load updates:', err);
      loadingEl.remove();

      if (err?.message === 'missing-firestore-index') {
        renderMessage('error-state', 'Updates Feed needs a Firestore index for date sorting before entries can load.');
        return;
      }

      if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
        renderMessage('error-state', 'Updates Feed is not readable with the current Firestore rules.');
        return;
      }

      renderMessage('error-state', 'Unable to load updates. Please try again later.');
    }
  }

  /* ─── Boot ─── */
  initMobileNav();
  bindPublicLogin();
  loadUpdates();

  /* ─── Firestore Document Schema Reference ─── */
  /*
    Collection: "updates"

    Each document:
    {
      title: string,            // "Styles Panel Redesign"
      date: Timestamp,          // Firestore Timestamp
      description: string,      // "We rebuilt the styles panel from the ground up..."
      image: string (optional), // URL to preview image
      changes: {
        features: string[],     // ["New color picker", "Gradient support"]
        improvements: string[], // ["Faster rendering", "Better scroll performance"]
        fixes: string[]         // ["Fixed tooltip overlap", "Resolved export bug"]
      }
    }
  */
})();
