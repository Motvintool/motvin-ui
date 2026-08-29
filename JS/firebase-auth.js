// firebase-auth.js: shared Google authentication helper for sidebar/float profile menus.
(function initFirebaseAuthService() {
  const SDK_VERSION = '10.12.5';
  const AUTH_SYNC_CHANNEL = 'motvin-auth-sync-v1';
  const AUTH_SYNC_STORAGE_KEY = '__motvin_auth_sync_v1__';
  // Synchronous, same-origin snapshot of the last known signed-in user.
  // Firebase's own persistence restore is async (IndexedDB), which is what
  // makes a freshly-navigated page briefly look "logged out" until it
  // resolves. Reading this snapshot lets any page on this origin paint the
  // correct auth state instantly on load, without waiting for that round trip.
  const AUTH_SNAPSHOT_STORAGE_KEY = 'motvin-auth-snapshot-v1';
  const instanceId = `root-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  let auth = null;
  let provider = null;
  let authSdk = null;
  let currentUser = null;
  let readyPromise = null;
  let isApplyingExternalSignOut = false;
  const listeners = new Set();
  let channel = null;

  let resolveAuthInitialized = null;
  const authInitializedPromise = new Promise((resolve) => {
    resolveAuthInitialized = resolve;
  });

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function persistSnapshot(user) {
    try {
      if (user && !user.isAnonymous) {
        localStorage.setItem(AUTH_SNAPSHOT_STORAGE_KEY, JSON.stringify({
          uid: user.uid || '',
          displayName: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || '',
          isAnonymous: false,
          at: Date.now(),
        }));
      } else if (!user) {
        localStorage.removeItem(AUTH_SNAPSHOT_STORAGE_KEY);
      }
    } catch {
      // ignore storage write failures
    }
  }

  function readSnapshot() {
    try {
      const raw = localStorage.getItem(AUTH_SNAPSHOT_STORAGE_KEY);
      const parsed = raw ? safeJsonParse(raw) : null;
      if (parsed && !parsed.isAnonymous && parsed.uid) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  function publishSyncEvent(type, user) {
    const payload = {
      source: instanceId,
      type,
      uid: user && user.uid ? String(user.uid) : '',
      at: Date.now(),
    };

    try {
      if (channel) {
        channel.postMessage(payload);
      }
    } catch {
      // ignore sync channel failures
    }

    try {
      localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage write failures
    }
  }

  async function applyExternalSync(payload) {
    if (!payload || payload.source === instanceId) return;
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return;

    if (payload.type === 'sign-out') {
      if (authInstance.currentUser && !isApplyingExternalSignOut) {
        isApplyingExternalSignOut = true;
        try {
          await authSdk.signOut(authInstance);
        } catch {
          // ignore sync sign-out errors
        } finally {
          isApplyingExternalSignOut = false;
        }
      }
      emit(null);
      
      const path = window.location.pathname;
      const isLanding = path === '/' || path === '/index' || path.includes('index.html');
      if (!isLanding) {
        const scriptTag = document.querySelector('script[src*="firebase-auth.js"]');
        if (scriptTag) {
          window.location.href = scriptTag.getAttribute('src').replace(/JS\/firebase-auth\.js.*$/, 'index.html');
        } else {
          window.location.href = '/';
        }
      }
      
      return;
    }

    const activeUser = (authInstance.currentUser && !authInstance.currentUser.isAnonymous)
      ? authInstance.currentUser
      : readSnapshot();

    if (activeUser) {
      emit(activeUser);
    }
  }

  function initSyncListeners() {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
        channel.addEventListener('message', (event) => {
          void applyExternalSync(event && event.data ? event.data : null);
        });
      } catch {
        channel = null;
      }
    }

    window.addEventListener('storage', (event) => {
      if (!event || event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      const payload = safeJsonParse(event.newValue);
      if (!payload) return;
      void applyExternalSync(payload);
    });
  }

  function emit(user) {
    currentUser = user || null;
    persistSnapshot(currentUser);
    listeners.forEach((listener) => {
      try {
        listener(currentUser);
      } catch {
        // ignore listener errors
      }
    });
  }

  async function configureBestPersistence(authInstance) {
    if (!authSdk || !authInstance || typeof authSdk.setPersistence !== 'function') {
      return;
    }

    const persistenceChain = [
      authSdk.indexedDBLocalPersistence,
      authSdk.browserLocalPersistence,
      authSdk.browserSessionPersistence,
    ].filter(Boolean);

    for (const persistence of persistenceChain) {
      try {
        await authSdk.setPersistence(authInstance, persistence);
        return;
      } catch {
        // Try the next persistence backend.
      }
    }
  }

  async function ensureReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      const config = window.FIREBASE_CONFIG || {};
      if (!config.apiKey || !config.projectId) {
        return null;
      }

      const [{ initializeApp, getApps, getApp }, loadedAuthSdk] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      ]);

      authSdk = loadedAuthSdk;

      const app = getApps().length ? getApp() : initializeApp(config);
      auth = authSdk.getAuth(app);
      provider = new authSdk.GoogleAuthProvider();

      await configureBestPersistence(auth);

      authSdk.getRedirectResult(auth).catch(() => null);

      authSdk.onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
          emit(user);
          publishSyncEvent('auth-state-changed', user);
        } else if (!user || user.isAnonymous) {
          persistSnapshot(null);
          emit(null);
          publishSyncEvent('auth-state-changed', null);

          // Redirect to login if on a protected page without auth
          const p = window.location.pathname.toLowerCase();
          const protectedPaths = [
            '/files', '/files.html',
            '/my-post', '/my-post.html',
            '/saved-templates', '/saved-templates.html',
            '/about-me', '/about-me.html',
            '/motvin', '/motvin/', '/motvin/index.html'
          ];
          let isProtected = protectedPaths.some(path => p === path || p.startsWith(path + '/'));
          if (p.startsWith('/updates')) isProtected = false;
          if (isProtected) {
            window.location.href = `/login?next=${encodeURIComponent(p)}`;
          }
        }
        if (resolveAuthInitialized) {
          resolveAuthInitialized(user || null);
          resolveAuthInitialized = null;
        }
      });

      return auth;
    })().catch(() => null);

    return readyPromise;
  }

  function shouldFallbackToRedirect(errorCode) {
    return errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request';
  }

  function buildAuthErrorMessage(error) {
    const code = String(error && error.code || '');

    if (window.location.protocol === 'file:') {
      return 'Authentication cannot run from file:// URLs. Open this site via localhost or Firebase Hosting.';
    }

    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Authentication. Add it under Firebase Console > Authentication > Settings > Authorized domains.';
    }

    if (code === 'auth/operation-not-allowed') {
      return 'This sign-in method is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method.';
    }

    if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      return 'Invalid email or password.';
    }

    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists.';
    }

    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.';
    }

    if (code) {
      return `Authentication failed (${code}).`;
    }

    return 'Authentication failed. Please try again.';
  }

  async function loginWithGoogle(options) {
    const opts = options || {};
    const method = opts.method === 'redirect' ? 'redirect' : 'popup';
    const authInstance = await ensureReady();
    if (!authInstance || !provider || !authSdk) return null;

    await configureBestPersistence(authInstance);

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    if (authInstance.currentUser && authInstance.currentUser.isAnonymous) {
      try {
        await authSdk.signOut(authInstance);
      } catch {
        // ignore — proceed with sign-in anyway
      }
    }

    try {
      if (method === 'redirect') {
        await authSdk.signInWithRedirect(authInstance, provider);
        return null;
      }

      const result = await authSdk.signInWithPopup(authInstance, provider);
      
      // Sync login to Compat SDK (window.firebase.auth) so Firestore queries succeed
      if (result && window.firebase && typeof window.firebase.auth === 'function') {
        try {
          const cred = authSdk.GoogleAuthProvider.credentialFromResult(result);
          if (cred) {
            await window.firebase.auth().signInWithCredential(cred);
          }
        } catch (credErr) {
          console.warn('[firebase-auth] Compat auth credential sync error:', credErr);
        }
      }

      const signedInUser = (result && result.user) || authInstance.currentUser || null;
      emit(signedInUser);
      return signedInUser;
    } catch (error) {
      const code = String(error && error.code || '');
      if (method === 'popup' && shouldFallbackToRedirect(code)) {
        await authSdk.signInWithRedirect(authInstance, provider);
        return null;
      }
      throw new Error(buildAuthErrorMessage(error));
    }
  }

  async function loginWithEmail(email, password) {
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return null;

    await configureBestPersistence(authInstance);

    try {
      const result = await authSdk.signInWithEmailAndPassword(authInstance, email, password);
      
      // Sync login to Compat SDK
      if (result && window.firebase && typeof window.firebase.auth === 'function') {
        try {
          const cred = authSdk.EmailAuthProvider.credential(email, password);
          if (cred) {
            await window.firebase.auth().signInWithCredential(cred);
          }
        } catch (credErr) {
          console.warn('[firebase-auth] Compat auth credential sync error:', credErr);
        }
      }

      const signedInUser = (result && result.user) || authInstance.currentUser || null;
      emit(signedInUser);
      return signedInUser;
    } catch (error) {
      throw new Error(buildAuthErrorMessage(error));
    }
  }

  async function registerWithEmail(email, password) {
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return null;

    await configureBestPersistence(authInstance);

    try {
      const result = await authSdk.createUserWithEmailAndPassword(authInstance, email, password);
      
      // Sync login to Compat SDK
      if (result && window.firebase && typeof window.firebase.auth === 'function') {
        try {
          const cred = authSdk.EmailAuthProvider.credential(email, password);
          if (cred) {
            await window.firebase.auth().signInWithCredential(cred);
          }
        } catch (credErr) {
          console.warn('[firebase-auth] Compat auth credential sync error:', credErr);
        }
      }

      const signedInUser = (result && result.user) || authInstance.currentUser || null;
      emit(signedInUser);
      return signedInUser;
    } catch (error) {
      throw new Error(buildAuthErrorMessage(error));
    }
  }

  // Opt-in guest session for features that need a stable per-visitor
  // identity even before any real sign-in (e.g. per-account notification
  // read-state). Deliberately NOT called automatically inside ensureReady()
  // — this file is shared by pages (MOTVIN, ADMIN-PAGE) whose "is someone
  // signed in?" checks must keep meaning "a real account", so only callers
  // that explicitly want a guest identity should invoke this.
  async function ensureGuestSession() {
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return null;

    // Wait until IndexedDB/LocalState auth persistence is fully restored,
    // otherwise currentUser is null and signInAnonymously will create a brand new guest.
    await authInitializedPromise;

    if (authInstance.currentUser) return authInstance.currentUser;

    try {
      const result = await authSdk.signInAnonymously(authInstance);
      return (result && result.user) || authInstance.currentUser || null;
    } catch {
      return null;
    }
  }

  async function logout() {
    const authInstance = await ensureReady();

    if (window.firebase && typeof window.firebase.auth === 'function') {
      try {
        const compatAuth = window.firebase.auth();
        if (compatAuth && typeof compatAuth.signOut === 'function') {
          await compatAuth.signOut();
        }
      } catch {
        // ignore compat sign-out failures
      }
    }

    if (authInstance && authSdk) {
      await authSdk.signOut(authInstance);
    }
    emit(null);
    publishSyncEvent('sign-out', null);

    const path = window.location.pathname;
    const isLanding = path === '/' || path === '/index' || path.includes('index.html');
    if (!isLanding) {
      window.location.href = `/login?next=${encodeURIComponent(path)}`;
    }
  }

  function onChange(listener) {
    if (typeof listener !== 'function') {
      return function noop() {};
    }

    listeners.add(listener);
    // Invoke immediately with a best-guess user so callers can paint the
    // right state on first render: the real (possibly still-resolving)
    // currentUser if we have it, otherwise the last synced snapshot from
    // any page on this origin. `ensureReady()`'s own onAuthStateChanged
    // will correct this shortly after with the authoritative value.
    listener(currentUser || readSnapshot());

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }
  async function resetPassword(email) {
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return null;

    try {
      await authSdk.sendPasswordResetEmail(authInstance, email);
    } catch (error) {
      throw new Error(buildAuthErrorMessage(error));
    }
  }


  async function getIdToken(forceRefresh) {
    const authInstance = await ensureReady();
    if (!authInstance || !authSdk) return null;

    const user = authInstance.currentUser;
    if (!user) return null;

    try {
      return await authSdk.getIdToken(user, Boolean(forceRefresh));
    } catch {
      return null;
    }
  }

  window.FirebaseAuthService = {
    init: ensureReady,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    onChange,
    getIdToken,
    ensureGuestSession,
    getCurrentUser() {
      return currentUser;
    },
    // Synchronous last-known-signed-in-user snapshot shared across every
    // page on this origin. Use for instant/optimistic UI on load; always
    // treat `onChange`/`getCurrentUser` as the source of truth once ready.
    getCachedUser() {
      if (currentUser && !currentUser.isAnonymous) {
        return currentUser;
      }
      return readSnapshot();
    },
  };

  initSyncListeners();
  ensureReady();
})();
