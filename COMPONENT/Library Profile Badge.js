window.LibraryProfileBadge = (function () {
  function render(user) {
    if (user && !user.isAnonymous) {
      if (user.photoURL) {
        return `<img src="${user.photoURL}" alt="" class="mi-top-avatar" />`;
      } else {
        // Generate initials from display name, or use 'U' as fallback
        let initial = "U";
        if (user.displayName) {
          const match = user.displayName.match(/[a-zA-Z0-9]/);
          if (match) initial = match[0].toUpperCase();
        }
        return `
          <div class="mi-avatar-initials-outer">
            <div class="mi-avatar-initials-inner">${initial}</div>
          </div>
        `;
      }
    } else {
      return `<img src="ASSET/Icons/sidebar-avatar-placeholder.svg" alt="" class="mi-top-avatar" />`;
    }
  }

  function updateContainer(container, user) {
    if (!container) return;
    
    container.innerHTML = render(user);
    
    // Update classes based on state
    if (user && !user.isAnonymous) {
      if (user.photoURL) {
        container.className = "mi-top-avatar-wrap";
      } else {
        container.className = "mi-top-avatar-wrap mi-initials-mode";
      }
    } else {
      container.className = "mi-top-avatar-wrap mi-logged-out";
    }
  }

  return { render, updateContainer };
})();
