window.AuthModal = (function () {
  const modalHTML = `
  <!-- Authentication Modal -->
  <div id="auth-modal" class="auth-modal-overlay" style="display: none;">
    <div class="auth-modal-content">
      <button class="auth-modal-close" id="auth-modal-close" aria-label="Close modal">&times;</button>
      
      <div id="auth-main-view">
        <div class="auth-modal-header">
          <h2 id="auth-modal-title">Sign in</h2>
          <p id="auth-modal-subtitle">Welcome back! Please enter your details.</p>
        </div>
        
        <button class="auth-google-btn" id="auth-modal-google-btn">
          <img src="ASSET/Icons/google.svg" alt="Google Logo" onerror="this.src='https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'" />
          Continue with Google
        </button>

        <div class="auth-divider">
          <span>or</span>
        </div>

        <form id="auth-modal-form">
          <div class="auth-input-group">
            <label for="auth-email">Email</label>
            <input type="email" id="auth-email" required />
          </div>
          
          <div class="auth-input-group">
            <label for="auth-password">Password</label>
            <input type="password" id="auth-password" required />
          </div>

          <div id="auth-error-msg" class="auth-error-msg" style="display: none;"></div>

          <button type="submit" class="auth-submit-btn" id="auth-modal-submit-btn">Log in</button>
          
          <div id="auth-forgot-password-wrapper" style="text-align: center; margin-top: 12px; padding-bottom: 16px;">
            <a href="#" id="auth-forgot-password-link" style="font-size: 15px; color: #006BD6; text-decoration: underline; display: inline-block;">Reset Password</a>
          </div>
        </form>

        <div class="auth-modal-footer">
          <span id="auth-toggle-text">Don't have an account? </span>
          <a href="#" id="auth-toggle-mode">Sign up</a>
        </div>
      </div>

      <!-- Reset Password Request View -->
      <div id="auth-reset-request-view" style="display: none; width: 100%;">
        <div class="auth-modal-header" style="margin-bottom: 24px;">
          <h2 style="font-size: 24px; color: #202124; text-align: center;">Enter your email to reset password</h2>
        </div>
        
        <button class="auth-google-btn" id="auth-reset-google-btn">
          <img src="ASSET/Icons/google.svg" alt="Google Logo" onerror="this.src='https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'" />
          Continue with Google
        </button>

        <div class="auth-divider">
          <span>or</span>
        </div>

        <form id="auth-reset-form">
          <div class="auth-input-group">
            <label for="auth-reset-email">Email</label>
            <input type="email" id="auth-reset-email" required />
          </div>

          <div id="auth-reset-error-msg" class="auth-error-msg" style="display: none;"></div>

          <button type="submit" class="auth-submit-btn" id="auth-reset-submit-btn" style="margin-top: 16px;">Reset password</button>
          
          <div style="text-align: center; margin-top: 16px;">
            <a href="#" id="auth-reset-cancel-link" style="font-size: 15px; color: #006BD6; text-decoration: underline; display: inline-block;">Cancel</a>
          </div>
        </form>
      </div>

      <!-- Reset Password Msg View -->
      <div id="auth-reset-msg-view" style="display: none; width: 100%;">
        <div class="auth-modal-header" style="margin-bottom: 16px;">
          <h2 style="font-size: 24px; color: #202124; text-align: center; white-space: pre-wrap; line-height: 1.2;">Received your password<br>reset request</h2>
        </div>
        
        <p style="font-size: 15px; line-height: 22px; color: #000000; text-align: center; margin-bottom: 24px;">
          If an account exists for <span id="auth-reset-email-display" style="font-weight: 600;"></span>, you will get an email with instructions on resetting your password. If it doesn't arrive, be sure to check your spam folder.
        </p>

        <button type="button" class="auth-submit-btn" id="auth-reset-back-btn">Back to Log in</button>
      </div>
    </div>
  </div>
  `;

  let currentAuthMode = 'login'; // 'login' or 'register'
  
  // Element references (will be populated on init)
  let authModal, authModalClose, authModalTitle, authModalSubtitle;
  let authGoogleBtn, authForm, authEmail, authPassword, authSubmitBtn;
  let authToggleText, authToggleMode, authErrorMsg;
  let authMainView, authResetRequestView, authResetMsgView;
  let authResetGoogleBtn, authResetForm, authResetEmail, authResetErrorMsg;
  let authResetSubmitBtn, authResetCancelLink, authForgotPasswordLink;
  let authForgotPasswordWrapper, authResetEmailDisplay, authResetBackBtn;

  function init() {
    // Only inject if it doesn't already exist
    if (!document.getElementById("auth-modal")) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    authModal = document.getElementById('auth-modal');
    authModalClose = document.getElementById('auth-modal-close');
    authModalTitle = document.getElementById('auth-modal-title');
    authModalSubtitle = document.getElementById('auth-modal-subtitle');
    authGoogleBtn = document.getElementById('auth-modal-google-btn');
    authForm = document.getElementById('auth-modal-form');
    authEmail = document.getElementById('auth-email');
    authPassword = document.getElementById('auth-password');
    authSubmitBtn = document.getElementById('auth-modal-submit-btn');
    authToggleText = document.getElementById('auth-toggle-text');
    authToggleMode = document.getElementById('auth-toggle-mode');
    authErrorMsg = document.getElementById('auth-error-msg');

    authMainView = document.getElementById('auth-main-view');
    authResetRequestView = document.getElementById('auth-reset-request-view');
    authResetMsgView = document.getElementById('auth-reset-msg-view');

    authResetGoogleBtn = document.getElementById('auth-reset-google-btn');
    authResetForm = document.getElementById('auth-reset-form');
    authResetEmail = document.getElementById('auth-reset-email');
    authResetErrorMsg = document.getElementById('auth-reset-error-msg');
    authResetSubmitBtn = document.getElementById('auth-reset-submit-btn');
    authResetCancelLink = document.getElementById('auth-reset-cancel-link');
    authForgotPasswordLink = document.getElementById('auth-forgot-password-link');
    authForgotPasswordWrapper = document.getElementById('auth-forgot-password-wrapper');
    authResetEmailDisplay = document.getElementById('auth-reset-email-display');
    authResetBackBtn = document.getElementById('auth-reset-back-btn');

    bindEvents();
  }

  function switchAuthView(view) {
    authMainView.style.display = 'none';
    authResetRequestView.style.display = 'none';
    authResetMsgView.style.display = 'none';

    if (view === 'main') {
      authMainView.style.display = 'block';
    } else if (view === 'reset-request') {
      authResetRequestView.style.display = 'block';
      authResetErrorMsg.style.display = 'none';
      authResetEmail.value = authEmail.value; // Pre-fill if they already typed it
    } else if (view === 'reset-msg') {
      authResetMsgView.style.display = 'block';
    }
  }

  function openModal(mode) {
    if (!authModal) init();

    currentAuthMode = mode;
    switchAuthView('main');
    authErrorMsg.style.display = 'none';
    authEmail.value = '';
    authPassword.value = '';
    
    if (mode === 'login') {
      authModalTitle.textContent = 'Sign in';
      authModalSubtitle.textContent = 'Welcome back! Please enter your details.';
      authSubmitBtn.textContent = 'Log in';
      authToggleText.textContent = "Don't have an account? ";
      authToggleMode.textContent = 'Sign up';
      if (authForgotPasswordWrapper) authForgotPasswordWrapper.style.display = 'block';
    } else {
      authModalTitle.textContent = 'Create Account';
      authModalSubtitle.textContent = 'Start your journey with us today.';
      authSubmitBtn.textContent = 'Sign up';
      authToggleText.textContent = "Already have an account? ";
      authToggleMode.textContent = 'Log in';
      if (authForgotPasswordWrapper) authForgotPasswordWrapper.style.display = 'none';
    }
    
    authModal.style.display = 'flex';
  }

  function closeModal() {
    authModal.style.display = 'none';
  }

  const handleAuthError = (err) => {
    authErrorMsg.textContent = err.message || 'Authentication failed.';
    authErrorMsg.style.display = 'block';
    authErrorMsg.style.color = '#d93025';
    authSubmitBtn.disabled = false;
    authGoogleBtn.disabled = false;
  };

  const handleResetError = (err) => {
    authResetErrorMsg.textContent = err.message || 'Action failed.';
    authResetErrorMsg.style.display = 'block';
    authResetErrorMsg.style.color = '#d93025';
    authResetSubmitBtn.disabled = false;
  };

  const googleLoginFlow = async (e) => {
    e.preventDefault();
    authErrorMsg.style.display = 'none';
    authGoogleBtn.disabled = true;
    if (authResetGoogleBtn) authResetGoogleBtn.disabled = true;
    try {
      await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
      closeModal();
    } catch (error) {
      handleAuthError(error);
    }
  };

  function bindEvents() {
    authModalClose.addEventListener('click', closeModal);
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal();
    });

    authToggleMode.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(currentAuthMode === 'login' ? 'register' : 'login');
    });

    authGoogleBtn.addEventListener('click', googleLoginFlow);
    if (authResetGoogleBtn) authResetGoogleBtn.addEventListener('click', googleLoginFlow);

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
      authResetBackBtn.addEventListener('click', () => {
        switchAuthView('main');
      });
    }

    if (authResetForm) {
      authResetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authResetEmail.value.trim();
        if (!email) {
          handleResetError(new Error("Please enter your email address."));
          return;
        }

        authResetErrorMsg.style.display = 'none';
        authResetSubmitBtn.disabled = true;
        authResetSubmitBtn.textContent = 'Sending...';

        try {
          await window.FirebaseAuthService.resetPassword(email);
          authResetEmailDisplay.textContent = email;
          switchAuthView('reset-msg');
        } catch (error) {
          handleResetError(error);
        } finally {
          authResetSubmitBtn.disabled = false;
          authResetSubmitBtn.textContent = 'Reset password';
        }
      });
    }

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorMsg.style.display = 'none';
      authSubmitBtn.disabled = true;
      
      const email = authEmail.value.trim();
      const password = authPassword.value;
      
      try {
        if (currentAuthMode === 'login') {
          await window.FirebaseAuthService.loginWithEmail(email, password);
        } else {
          await window.FirebaseAuthService.registerWithEmail(email, password);
        }
        closeModal();
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  // Initialize immediately since it's a global component script
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });

  return { open: openModal, close: closeModal };
})();
