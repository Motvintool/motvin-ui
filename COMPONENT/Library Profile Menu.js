window.LibraryProfileMenu = (function () {
  const menuHTML = `
    <div class="mi-top-avatar-wrap mi-logged-out">
      <img src="ASSET/Icons/sidebar-avatar-placeholder.svg" alt="" class="mi-top-avatar" />
    </div>
    <!-- Profile Menu Dropdown -->
    <div class="mi-profile-dropdown" id="profile-dropdown">
      <div class="mi-profile-dropdown-inner">
        <!-- User Info (hidden when logged out) -->
        <div class="mi-profile-user-info-section" style="display: none;">
          <div class="mi-profile-user-info">
            <p class="mi-profile-name">surendarv</p>
            <p class="mi-profile-email">surendarv638@gmail.com</p>
          </div>
          <div class="mi-profile-divider-wrap"><div class="mi-profile-divider"></div></div>
        </div>

        <!-- Menu Items -->
        <div class="mi-profile-menu-items">
          <a href="#" class="mi-profile-item" id="mi-profile-saved">
            <img src="ASSET/Icons/icons-logos-profile-menu-savedcollections.svg" />
            <span>Saved Collections</span>
          </a>
          <a href="/updates/" target="_blank" rel="noopener noreferrer" class="mi-profile-item">
            <img src="ASSET/Icons/icons-logos-profile-menu-releasenotes.svg" />
            <span>Release Notes</span>
          </a>
          <a href="https://chat.whatsapp.com/JxLUrQpNpaXJ4ido6muIW6?s=cl&p=i&ilr=4" target="_blank" rel="noopener noreferrer" class="mi-profile-item">
            <img src="ASSET/Icons/icons-logos-profile-menu-community.svg" />
            <span>Community</span>
          </a>
        </div>
        <div class="mi-profile-divider-wrap"><div class="mi-profile-divider"></div></div>

        <!-- Auth Action (Login / Logout) -->
        <a href="#" class="mi-profile-item mi-profile-auth-action">
          <img src="ASSET/Icons/icons-logos-profile-menu-login.svg" class="mi-profile-auth-icon" />
          <span class="mi-profile-auth-text">Log in</span>
        </a>
      </div>
    </div>
  `;

  function init() {
    const container = document.getElementById("profile-menu-container");
    if (!container) return;

    container.innerHTML = menuHTML;

    const avatarWrap = container.querySelector(".mi-top-avatar-wrap");
    const avatarImg = container.querySelector(".mi-top-avatar");
    const profileDropdown = container.querySelector("#profile-dropdown");

    const userInfoSection = profileDropdown.querySelector(".mi-profile-user-info-section");
    const profileName = profileDropdown.querySelector(".mi-profile-name");
    const profileEmail = profileDropdown.querySelector(".mi-profile-email");
    const authAction = profileDropdown.querySelector(".mi-profile-auth-action");
    const authText = profileDropdown.querySelector(".mi-profile-auth-text");
    const authIcon = profileDropdown.querySelector(".mi-profile-auth-icon");
    const savedCollectionsAction = profileDropdown.querySelector("#mi-profile-saved");

    // Toggle dropdown on avatar click
    avatarWrap.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("is-open");
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!avatarWrap.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove("is-open");
      }
    });

    // Handle Login/Logout click
    authAction.addEventListener("click", async (e) => {
      e.preventDefault();
      profileDropdown.classList.remove("is-open");
      if (!window.FirebaseAuthService) return;

      const user = window.FirebaseAuthService.getCurrentUser();
      if (user && !user.isAnonymous) {
        await window.FirebaseAuthService.logout();
      } else {
        if (window.AuthModal) {
          window.AuthModal.open('login');
        } else {
          console.error("AuthModal component not loaded.");
        }
      }
    });

    // Handle Saved Collections click
    if (savedCollectionsAction) {
      savedCollectionsAction.addEventListener("click", (e) => {
        e.preventDefault();
        profileDropdown.classList.remove("is-open");
        const btnFavorites = document.getElementById("btn-favorites");
        if (btnFavorites) {
          btnFavorites.click();
        }
      });
    }

    const initAuth = () => {
      if (window.FirebaseAuthService) {
        window.FirebaseAuthService.onChange((user) => {
          if (window.LibraryProfileBadge) {
            window.LibraryProfileBadge.updateContainer(avatarWrap, user);
          }
          
          if (user && !user.isAnonymous) {
            userInfoSection.style.display = "flex";
            profileName.textContent = user.displayName || "User";
            profileEmail.textContent = user.email || "";
            authText.textContent = "Log out";
            authIcon.src = "ASSET/Icons/icons-logos-profile-menu-loggedout.svg";
          } else {
            userInfoSection.style.display = "none";
            authText.textContent = "Log in";
            authIcon.src = "ASSET/Icons/icons-logos-profile-menu-login.svg";
          }
        });
      }
    };

    if (window.FirebaseAuthService) {
      initAuth();
    } else {
      setTimeout(initAuth, 500);
    }
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (window.LibraryProfileMenu) {
    window.LibraryProfileMenu.init();
  }
});
