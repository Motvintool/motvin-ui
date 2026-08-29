(function () {
const REQUIRED_FIREBASE_CONFIG_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];
const URL_BETA_CREDIT_DOC_VERSION = "v3";
const URL_BETA_LEGACY_DAILY_LIMITS = [10];
const URL_BETA_SIGNIN_ACTIVATION_STORAGE_KEY =
  "code2design.url-beta.signin-activation.v1";
const AUTH_SYNC_CHANNEL = "motvin-auth-sync-v1";
const AUTH_SYNC_STORAGE_KEY = "__motvin_auth_sync_v1__";
const AUTH_SYNC_INSTANCE_ID = `motvin-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const RUNTIME_ENV =
  typeof globalThis !== "undefined" &&
  globalThis.__MOTVIN_ENV__ &&
  typeof globalThis.__MOTVIN_ENV__ === "object"
    ? globalThis.__MOTVIN_ENV__
    : {};

function getFirebaseConfigFromEnv() {
  return {
    apiKey: RUNTIME_ENV.FIREBASE_API_KEY || "",
    authDomain: RUNTIME_ENV.FIREBASE_AUTH_DOMAIN || "",
    projectId: RUNTIME_ENV.FIREBASE_PROJECT_ID || "",
    appId: RUNTIME_ENV.FIREBASE_APP_ID || "",
    messagingSenderId: RUNTIME_ENV.FIREBASE_MESSAGING_SENDER_ID || "",
    storageBucket: RUNTIME_ENV.FIREBASE_STORAGE_BUCKET || "",
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getLocalDayToken() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function createFirebaseUrlBetaCreditService({ dailyLimit = 50 } = {}) {
  const config = getFirebaseConfigFromEnv();
  const missingRequiredConfigFields = REQUIRED_FIREBASE_CONFIG_FIELDS.filter(
    (key) => !config[key],
  );
  if (missingRequiredConfigFields.length > 0) {
    return {
      enabled: false,
      mode: "local-fallback",
      reason: "missing-firebase-config",
      missingConfigFields: missingRequiredConfigFields,
      ensureSignedIn: async () => false,
      getRemaining: async () => null,
      consumeOne: async () => ({
        allowed: false,
        remaining: null,
        reason: "firebase-disabled",
      }),
    };
  }

  try {
    const app = firebase.apps.length > 0 ? firebase.apps[0] : firebase.initializeApp(config);
    const auth = firebase.auth(app);
    const db = firebase.firestore(app);
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: "select_account",
    });
    let lastAuthError = null;
    let observedUser = auth.currentUser || null;
    let interactiveSignInPromise = null;
    let isApplyingExternalSignOut = false;
    let hasTriedCompatPersistence = false;
    const authListeners = new Set();
    let syncChannel = null;

    const getSharedAuthService = () => {
      if (typeof window === "undefined") return null;
      const service = window.FirebaseAuthService;
      return service && typeof service === "object" ? service : null;
    };

    const getSharedAuthUserSnapshot = () => {
      const service = getSharedAuthService();
      if (!service) return null;

      if (typeof service.getCurrentUser === "function") {
        const current = service.getCurrentUser();
        if (current && current.uid) return current;
      }

      if (typeof service.getCachedUser === "function") {
        const cached = service.getCachedUser();
        if (cached && cached.uid) return cached;
      }

      return null;
    };

    const waitForCompatAuthUid = (uid, timeoutMs = 800) => {
      if (!uid) return Promise.resolve(null);
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
          if (auth.currentUser && auth.currentUser.uid === uid) {
            finish(auth.currentUser);
          }
        }, 100);

        setTimeout(() => finish(auth.currentUser || null), timeoutMs);
      });
    };

    const ensureCompatPersistence = async () => {
      if (hasTriedCompatPersistence) return;
      hasTriedCompatPersistence = true;

      const persistenceChain = [
        firebase?.auth?.Auth?.Persistence?.LOCAL,
        firebase?.auth?.Auth?.Persistence?.SESSION,
      ].filter(Boolean);

      for (const persistence of persistenceChain) {
        try {
          await auth.setPersistence(persistence);
          return;
        } catch {
          // Try the next persistence backend.
        }
      }
    };

    const notifyAuthListeners = (user) => {
      authListeners.forEach((listener) => {
        try {
          listener(user || null);
        } catch {
          // Ignore listener errors.
        }
      });
    };

    const publishSyncEvent = (type, user) => {
      const payload = {
        source: AUTH_SYNC_INSTANCE_ID,
        type,
        uid: user?.uid ? String(user.uid) : "",
        at: Date.now(),
      };

      try {
        if (syncChannel) {
          syncChannel.postMessage(payload);
        }
      } catch {
        // Ignore cross-tab sync channel failures.
      }

      try {
        localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage failures.
      }
    };

    const applyExternalSync = async (payload) => {
      if (!payload || payload.source === AUTH_SYNC_INSTANCE_ID) return;

      if (payload.type === "sign-out" && auth.currentUser && !isApplyingExternalSignOut) {
        isApplyingExternalSignOut = true;
        try {
          await auth.signOut();
        } catch {
          // Ignore sync sign-out errors.
        } finally {
          isApplyingExternalSignOut = false;
        }
      }

      observedUser = auth.currentUser || null;
      notifyAuthListeners(observedUser);
    };

    if (typeof BroadcastChannel !== "undefined") {
      try {
        syncChannel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
        syncChannel.addEventListener("message", (event) => {
          void applyExternalSync(event?.data || null);
        });
      } catch {
        syncChannel = null;
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (!event || event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
        const payload = safeJsonParse(event.newValue);
        if (!payload) return;
        void applyExternalSync(payload);
      });
    }

    const sharedAuthService = getSharedAuthService();
    if (sharedAuthService && typeof sharedAuthService.onChange === "function") {
      sharedAuthService.onChange((sharedUser) => {
        const sharedUid = sharedUser?.uid ? String(sharedUser.uid) : "";
        if (!sharedUid) {
          observedUser = auth.currentUser || null;
          notifyAuthListeners(observedUser);
          return;
        }

        void waitForCompatAuthUid(sharedUid, 5000).then((compatUser) => {
          observedUser = compatUser || sharedUser || null;
          notifyAuthListeners(observedUser);
        });
      });
    }

    // Listen for auth state changes to keep observedUser in sync.
    auth.onAuthStateChanged((user) => {
      observedUser = user || null;
      notifyAuthListeners(observedUser);
      publishSyncEvent("auth-state-changed", observedUser);
    });

    const setLastAuthError = (error) => {
      if (!error) {
        lastAuthError = null;
        return;
      }
      lastAuthError = {
        code: String(error?.code || "auth/unknown"),
        message: String(error?.message || "Unknown auth error"),
      };
    };

    // Wait until Firebase Auth has restored the persisted session.
    const waitForAuthReady = async () => {
      if (typeof auth.authStateReady === "function") {
        try {
          await auth.authStateReady();
          return;
        } catch { /* fall through */ }
      }
      // Fallback: wait for the first onAuthStateChanged callback.
      await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged(
          () => { unsub(); resolve(); },
          () => { unsub(); resolve(); },
        );
        setTimeout(() => { unsub(); resolve(); }, 5000);
      });
    };

    const getActivationToken = (uid, day) => {
      return `${uid}_${day}_${URL_BETA_CREDIT_DOC_VERSION}_l${dailyLimit}`;
    };

    const markActivationToken = (token) => {
      try {
        localStorage.setItem(URL_BETA_SIGNIN_ACTIVATION_STORAGE_KEY, token);
      } catch {
        // Ignore storage failures.
      }
    };

    const readActivationToken = () => {
      try {
        return localStorage.getItem(URL_BETA_SIGNIN_ACTIVATION_STORAGE_KEY) || "";
      } catch {
        return "";
      }
    };

    const getCreditDocId = (uid, day, limit = dailyLimit) => {
      return `${uid}_${day}_${URL_BETA_CREDIT_DOC_VERSION}_l${limit}`;
    };

    const readUsed = (snap) => {
      const exists = typeof snap?.exists === 'function' ? snap.exists() : snap?.exists;
      if (!exists) return 0;
      const raw = Number(snap.data()?.used);
      if (!Number.isFinite(raw)) return 0;
      return Math.max(0, Math.floor(raw));
    };

    const ensureCurrentCreditRef = async (user, day = getLocalDayToken()) => {
      if (!user?.uid) return null;

      const currentDocId = getCreditDocId(user.uid, day, dailyLimit);
      const currentRef = db.collection("urlBetaDailyCredits").doc(currentDocId);
      const legacyRefs = URL_BETA_LEGACY_DAILY_LIMITS
        .filter((limit) => Number(limit) !== Number(dailyLimit))
        .map((limit) => ({
          limit,
          ref: db.collection("urlBetaDailyCredits").doc(getCreditDocId(user.uid, day, limit)),
        }));

      await db.runTransaction(async (tx) => {
        const nowMs = Date.now();
        const currentSnap = await tx.get(currentRef);
        let used = readUsed(currentSnap);
        let createdAtMs = (typeof currentSnap.exists === 'function' ? currentSnap.exists() : currentSnap.exists)
          ? Number(currentSnap.data()?.createdAtMs) || nowMs
          : nowMs;
        let migratedFromDocId = (typeof currentSnap.exists === 'function' ? currentSnap.exists() : currentSnap.exists)
          ? String(currentSnap.data()?.migratedFromDocId || "")
          : "";

        for (const legacyEntry of legacyRefs) {
          const legacySnap = await tx.get(legacyEntry.ref);
          if (!(typeof legacySnap.exists === 'function' ? legacySnap.exists() : legacySnap.exists)) continue;

          used = Math.max(used, readUsed(legacySnap));

          const legacyCreatedAtMs = Number(legacySnap.data()?.createdAtMs) || nowMs;
          createdAtMs = Math.min(createdAtMs, legacyCreatedAtMs);

          if (!migratedFromDocId) {
            migratedFromDocId = legacyEntry.ref.id;
          }

          tx.set(
            legacyEntry.ref,
            {
              migratedToDocId: currentDocId,
              migratedAtMs: nowMs,
              updatedAtMs: nowMs,
            },
            { merge: true },
          );
        }

        tx.set(
          currentRef,
          {
            uid: user.uid,
            day,
            used,
            limit: dailyLimit,
            activatedBySignIn: true,
            updatedAtMs: nowMs,
            createdAtMs,
            ...(migratedFromDocId ? { migratedFromDocId } : {}),
          },
          { merge: true },
        );
      });

      return {
        ref: currentRef,
        uid: user.uid,
        day,
      };
    };

    const initializeCreditsAfterSuccessfulSignIn = async (user) => {
      if (!user?.uid) return;
      const day = getLocalDayToken();
      const token = getActivationToken(user.uid, day);
      if (readActivationToken() === token) return;

      await ensureCurrentCreditRef(user, day);

      markActivationToken(token);
    };

    const ensureUser = async ({ interactive = false } = {}) => {
      await ensureCompatPersistence();
      await waitForAuthReady();

      // Always resolve any pending redirect sign-in first.
      try {
        const redirectResult = await auth.getRedirectResult();
        const redirectUser = redirectResult?.user || null;
        if (redirectUser && !redirectUser.isAnonymous) {
          observedUser = redirectUser;
          setLastAuthError(null);
          try {
            await initializeCreditsAfterSuccessfulSignIn(redirectUser);
          } catch {
            // Non-fatal.
          }
          return redirectUser;
        }
      } catch (redirectError) {
        // Keep this for diagnostics, but continue normal checks.
        setLastAuthError(redirectError);
      }

      setLastAuthError(null);

      // Already signed in?
      const current = auth.currentUser || observedUser;
      if (current && !current.isAnonymous) {
        if (interactive) {
          try { await initializeCreditsAfterSuccessfulSignIn(current); } catch { /* non-fatal */ }
        }
        return current;
      }
      
        // After redirect return, auth.currentUser can lag briefly even when
        // redirect flow already completed. Give auth state a short second chance.
        if (!interactive) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          const delayedUser = auth.currentUser || observedUser;
          if (delayedUser && !delayedUser.isAnonymous) {
            return delayedUser;
          }

          const sharedUser = getSharedAuthUserSnapshot();
          if (sharedUser && sharedUser.uid) {
            const compatUser = await waitForCompatAuthUid(sharedUser.uid, 5000);
            const syncedUser = compatUser || sharedUser;
            observedUser = syncedUser;
            return syncedUser;
          }
        }

      if (!interactive) return null;

      if (interactiveSignInPromise) {
        return interactiveSignInPromise;
      }

      interactiveSignInPromise = (async () => {
        try {
          // Sign in through the single shared Google auth service (also used
          // by the root site's sidebar) so both areas share one login action
          // and one persisted session instead of two independent sign-ins.
          if (window.FirebaseAuthService) {
            const sharedUser = await window.FirebaseAuthService.loginWithGoogle({ method: "popup" });
            if (!sharedUser) return null;

            const compatUser = await waitForCompatAuthUid(sharedUser.uid);
            const signedInUser = compatUser || sharedUser;
            observedUser = signedInUser;
            try {
              await initializeCreditsAfterSuccessfulSignIn(signedInUser);
            } catch {
              // Non-fatal; continue signed-in flow.
            }
            return signedInUser;
          }

          const result = await auth.signInWithPopup(googleProvider);
          const signedInUser = result?.user || null;
          if (signedInUser) {
            observedUser = signedInUser;
            try {
              await initializeCreditsAfterSuccessfulSignIn(signedInUser);
            } catch {
              // Non-fatal; continue signed-in flow.
            }
          }
          return signedInUser;
        } catch (popupError) {
          const code = String(popupError?.code || "");
          setLastAuthError(popupError);

          // Fallback only for popup blocker scenarios.
          // If the user closes/cancels the popup, keep them signed out without redirecting.
          if (code === "auth/popup-blocked") {
            try {
              if (window.FirebaseAuthService) {
                await window.FirebaseAuthService.loginWithGoogle({ method: "redirect" });
              } else {
                await auth.signInWithRedirect(googleProvider);
              }
              setLastAuthError({
                code: "auth/redirect-started",
                message: "Sign-in redirect started",
              });
            } catch (redirectError) {
              setLastAuthError(redirectError);
            }
          }
          return null;
        } finally {
          interactiveSignInPromise = null;
        }
      })();

      return interactiveSignInPromise;
    };

    const getCreditRef = async ({ interactive = false } = {}) => {
      const user = await ensureUser({ interactive });
      if (!user?.uid) return null;
      const day = getLocalDayToken();
      return ensureCurrentCreditRef(user, day);
    };

    return {
      enabled: true,
      mode: "firebase",
      reason: "configured",
      getCurrentUser() {
        if (observedUser || auth.currentUser) return observedUser || auth.currentUser;
        // Fall back to the shared, same-origin auth snapshot for an instant
        // best guess before this compat instance's own async restore settles.
        return getSharedAuthUserSnapshot();
      },
      async ensureSignedIn({ interactive = false } = {}) {
        const user = await ensureUser({ interactive });
        return Boolean(user?.uid);
      },
      getLastAuthError() {
        return lastAuthError;
      },
      onAuthChanged(callback) {
        if (typeof callback !== "function") {
          return () => {};
        }
        authListeners.add(callback);
        try {
          callback(observedUser || getSharedAuthUserSnapshot());
        } catch {
          // Ignore listener errors.
        }
        return () => {
          authListeners.delete(callback);
        };
      },
      async signOut() {
        try {
          if (window.FirebaseAuthService) {
            await window.FirebaseAuthService.logout();
          }
          await auth.signOut();
        } finally {
          observedUser = null;
          setLastAuthError(null);
          publishSyncEvent("sign-out", null);
          try {
            localStorage.removeItem(URL_BETA_SIGNIN_ACTIVATION_STORAGE_KEY);
          } catch {
            // Ignore storage failures.
          }
        }
      },
      async getRemaining() {
        const creditRef = await getCreditRef({ interactive: false });
        if (!creditRef?.ref) return null;
        const { ref } = creditRef;
        let snap;
        try {
          snap = await ref.get({ source: "server" });
        } catch {
          // Fall back to cache if offline.
          snap = await ref.get();
        }
        const used = readUsed(snap);
        return Math.max(0, dailyLimit - used);
      },
      async consumeOne() {
        const creditRef = await getCreditRef({ interactive: true });
        if (!creditRef?.ref || !creditRef.uid || !creditRef.day) {
          return {
            allowed: false,
            remaining: null,
            reason: "auth-required",
            authErrorCode: String(lastAuthError?.code || "auth/unknown"),
            authErrorMessage: String(lastAuthError?.message || ""),
          };
        }

        const txResult = await db.runTransaction(async (tx) => {
          const { ref, uid, day } = creditRef;
          const snap = await tx.get(ref);
          const used = readUsed(snap);

          if (used >= dailyLimit) {
            return { allowed: false, remaining: 0 };
          }

          const nextUsed = used + 1;
          tx.set(
            ref,
            {
              uid,
              day,
              used: nextUsed,
              limit: dailyLimit,
              updatedAtMs: Date.now(),
              createdAtMs: (typeof snap.exists === 'function' ? snap.exists() : snap.exists) ? snap.data()?.createdAtMs || Date.now() : Date.now(),
            },
            { merge: true },
          );

          return {
            allowed: true,
            remaining: Math.max(0, dailyLimit - nextUsed),
          };
        });

        return txResult;
      },

      /* ── User Data (Firestore-backed palette / typeface collections) ── */

      /**
       * Load a user's saved collection from Firestore.
       * @param {"palettes"|"typefaces"|"deletedPalettes"|"deletedTypefaces"} type
       * @returns {Promise<Array>} The entries array, or [] if none / signed out.
       */
      async loadUserCollection(type) {
        let user = observedUser || auth.currentUser || getSharedAuthUserSnapshot();
        if (!auth.currentUser && user?.uid) {
          const compatUser = await waitForCompatAuthUid(user.uid, 500);
          if (compatUser) user = compatUser;
        }
        console.log(`[firebase-url-beta] loadUserCollection('${type}') target user:`, user ? user.uid : null, "auth.currentUser:", auth.currentUser ? auth.currentUser.uid : null);
        if (!user?.uid) {
          console.warn(`[firebase-url-beta] loadUserCollection('${type}') skipped: no user.uid`);
          return [];
        }
        try {
          const ref = db.collection("users").doc(user.uid).collection("collections").doc(type);
          let snap;
          try {
            snap = await ref.get({ source: "server" });
          } catch (serverErr) {
            console.warn(`[firebase-url-beta] server read failed for '${type}', trying cache:`, serverErr);
            snap = await ref.get();
          }
          const exists = (typeof snap.exists === 'function' ? snap.exists() : snap.exists);
          console.log(`[firebase-url-beta] collection '${type}' doc exists:`, exists);
          if (!exists) return [];
          const data = snap.data();
          console.log(`[firebase-url-beta] collection '${type}' doc entries count:`, Array.isArray(data?.entries) ? data.entries.length : 0);
          return Array.isArray(data?.entries) ? data.entries : [];
        } catch (err) {
          console.error(`[firebase-url-beta] loadUserCollection('${type}') CRITICAL FAILURE:`, err);
          return [];
        }
      },

      /**
       * Save a user's collection to Firestore (overwrites).
       * @param {"palettes"|"typefaces"|"deletedPalettes"|"deletedTypefaces"} type
       * @param {Array} entries
       * @returns {Promise<boolean>}
       */
      async saveUserCollection(type, entries) {
        const user = observedUser || auth.currentUser || getSharedAuthUserSnapshot();
        if (!user?.uid) return false;
        try {
          const ref = db.collection("users").doc(user.uid).collection("collections").doc(type);
          await ref.set({
            entries: Array.isArray(entries) ? entries : [],
            updatedAtMs: Date.now(),
            uid: user.uid,
          });
          return true;
        } catch (err) {
          console.error(`[motvin] saveUserCollection(${type}) failed (check Firebase Security Rules):`, err);
          return false;
        }
      },
    };
  } catch (error) {
    console.warn("Firebase URL Beta credit service unavailable:", error);
    return {
      enabled: false,
      mode: "local-fallback",
      reason: "firebase-init-failed",
      initErrorCode: String(error?.code || "firebase/init-failed"),
      initErrorMessage: String(error?.message || "Firebase initialization failed"),
      ensureSignedIn: async () => false,
      getRemaining: async () => null,
      consumeOne: async () => ({
        allowed: false,
        remaining: null,
        reason: "firebase-disabled",
      }),
    };
  }
}

window.createFirebaseUrlBetaCreditService = createFirebaseUrlBetaCreditService;
})();
