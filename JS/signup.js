document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authGoogleBtn = document.getElementById('auth-google-btn');
  const authErrorMsg = document.getElementById('auth-error-msg');

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

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorMsg.style.display = 'none';
      authSubmitBtn.disabled = true;
      
      const email = authEmail.value.trim();
      const password = authPassword.value;
      
      try {
        await window.FirebaseAuthService.registerWithEmail(email, password);
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
