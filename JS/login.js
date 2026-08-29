document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authGoogleBtn = document.getElementById('auth-google-btn');
  const authErrorMsg = document.getElementById('auth-error-msg');

  const authMainView = document.getElementById('auth-main-view');
  const authResetRequestView = document.getElementById('auth-reset-request-view');
  const authResetMsgView = document.getElementById('auth-reset-msg-view');

  const authForgotPasswordLink = document.getElementById('auth-forgot-password-link');
  const authResetCancelLink = document.getElementById('auth-reset-cancel-link');
  const authResetBackBtn = document.getElementById('auth-reset-back-btn');
  const authResetForm = document.getElementById('auth-reset-form');
  const authResetEmail = document.getElementById('auth-reset-email');
  const authResetErrorMsg = document.getElementById('auth-reset-error-msg');
  const authResetSubmitBtn = document.getElementById('auth-reset-submit-btn');
  const authResetGoogleBtn = document.getElementById('auth-reset-google-btn');
  const authResetEmailDisplay = document.getElementById('auth-reset-email-display');

  const handleAuthError = (err) => {
    authErrorMsg.textContent = err.message || 'Authentication failed.';
    authErrorMsg.style.display = 'block';
    authErrorMsg.style.color = '#d93025';
    if (authSubmitBtn) authSubmitBtn.disabled = false;
    if (authGoogleBtn) authGoogleBtn.disabled = false;
  };

  if (authGoogleBtn) {
    authGoogleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      authErrorMsg.style.display = 'none';
      authGoogleBtn.disabled = true;
      try {
        await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        let target = '/files';
        if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
          target = next;
        }
        window.location.href = target;
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorMsg.style.display = 'none';
      authSubmitBtn.disabled = true;
      
      const email = authEmail.value.trim();
      const password = authPassword.value;
      
      try {
        await window.FirebaseAuthService.loginWithEmail(email, password);
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        let target = '/files';
        if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
          target = next;
        }
        window.location.href = target;
      } catch (error) {
        handleAuthError(error);
      }
    });
  }
  function switchAuthView(view) {
    if (authMainView) authMainView.style.display = 'none';
    if (authResetRequestView) authResetRequestView.style.display = 'none';
    if (authResetMsgView) authResetMsgView.style.display = 'none';

    if (view === 'main') {
      if (authMainView) authMainView.style.display = 'block';
    } else if (view === 'reset-request') {
      if (authResetRequestView) authResetRequestView.style.display = 'block';
    } else if (view === 'reset-msg') {
      if (authResetMsgView) authResetMsgView.style.display = 'block';
    }
  }

  if (authForgotPasswordLink) {
    authForgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthView('reset-request');
    });
  }

  if (authResetCancelLink) {
    authResetCancelLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthView('main');
    });
  }

  if (authResetBackBtn) {
    authResetBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthView('main');
    });
  }

  if (authResetForm) {
    authResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authResetEmail.value.trim();
      if (!email) return;

      if (authResetErrorMsg) authResetErrorMsg.style.display = 'none';
      if (authResetSubmitBtn) {
        authResetSubmitBtn.disabled = true;
        authResetSubmitBtn.textContent = 'Sending...';
      }

      try {
        await window.FirebaseAuthService.resetPassword(email);
        if (authResetEmailDisplay) {
          authResetEmailDisplay.textContent = email;
        }
        switchAuthView('reset-msg');
      } catch (error) {
        if (authResetErrorMsg) {
          authResetErrorMsg.textContent = error.message || 'Failed to send reset email.';
          authResetErrorMsg.style.display = 'block';
          authResetErrorMsg.style.color = '#d93025';
        }
      } finally {
        if (authResetSubmitBtn) {
          authResetSubmitBtn.disabled = false;
          authResetSubmitBtn.textContent = 'Reset password';
        }
      }
    });
  }

  if (authResetGoogleBtn) {
    authResetGoogleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        let target = '/files';
        if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
          target = next;
        }
        window.location.href = target;
      } catch (error) {
        // Handled silently
      }
    });
  }

  // Cookie Banner Logic
  const manageCookiesBtn = document.getElementById('manageCookiesBtn');
  const cookiesBanner = document.getElementById("cookiesBanner");
  const cookiesStateAccept = document.getElementById("cookiesStateAccept");
  const cookiesStateSettings = document.getElementById("cookiesStateSettings");
  
  const btnSettings = document.getElementById("btnSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnAcceptAll = document.getElementById("btnAcceptAll");
  const btnSavePreferences = document.getElementById("btnSavePreferences");
  const cookieCloseBtn = document.getElementById("cookieCloseBtn");
  const analyticsCookieToggle = document.getElementById("analyticsCookieToggle");

  function completeCookieFlow(preference) {
    localStorage.setItem("motvin_cookie_preference", JSON.stringify(preference));
    if (cookiesBanner) {
      cookiesBanner.style.display = "none";
    }
  }

  if (manageCookiesBtn && cookiesBanner) {
    manageCookiesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cookiesBanner.style.display = 'block';
    });
  }

  if (cookiesBanner) {
    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        cookiesStateAccept.style.display = "none";
        cookiesStateSettings.style.display = "block";
      });
    }

    if (btnCancelSettings) {
      btnCancelSettings.addEventListener("click", () => {
        cookiesStateSettings.style.display = "none";
        cookiesStateAccept.style.display = "block";
      });
    }

    if (btnAcceptAll) {
      btnAcceptAll.addEventListener("click", () => {
        completeCookieFlow({ essential: true, analytics: true });
      });
    }

    if (btnSavePreferences) {
      btnSavePreferences.addEventListener("click", () => {
        const analyticsEnabled = analyticsCookieToggle ? analyticsCookieToggle.checked : false;
        completeCookieFlow({ essential: true, analytics: analyticsEnabled });
      });
    }

    if (cookieCloseBtn) {
      cookieCloseBtn.addEventListener("click", () => {
        completeCookieFlow({ essential: true, analytics: false });
      });
    }
  }
});
