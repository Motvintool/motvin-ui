// theme-manager.js — Scalable theme system for Light / Dark / System modes.
// All pages that load this script automatically get full theme support.
(function initThemeManager() {
  const STORAGE_KEY = 'siteTheme';
  const VALID_THEMES = ['dark', 'light', 'system'];

  // Apply theme to <html> before first paint to avoid FOUC.
  // This IIFE runs synchronously so it must stay small and fast.
  function resolveSystemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  }

  function getSavedTheme() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return VALID_THEMES.includes(saved) ? saved : 'dark';
    } catch {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }

  function getEffectiveTheme(theme) {
    if (theme === 'system') return resolveSystemTheme();
    return theme === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    const effective = getEffectiveTheme(theme);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', theme);
  }

  function setTheme(theme) {
    const normalized = VALID_THEMES.includes(theme) ? theme : 'dark';
    saveTheme(normalized);
    applyTheme(normalized);
    document.dispatchEvent(new CustomEvent('theme:changed', {
      detail: { theme: normalized, effective: getEffectiveTheme(normalized) },
    }));
  }

  function getCurrentTheme() {
    return getSavedTheme();
  }

  function getEffective() {
    return getEffectiveTheme(getSavedTheme());
  }

  // Apply immediately on script load.
  applyTheme(getSavedTheme());

  // Watch system preference changes when in "system" mode.
  try {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemChange = () => {
      if (getSavedTheme() === 'system') {
        applyTheme('system');
        document.dispatchEvent(new CustomEvent('theme:changed', {
          detail: { theme: 'system', effective: getEffectiveTheme('system') },
        }));
      }
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', onSystemChange);
    } else {
      mq.addListener(onSystemChange);
    }
  } catch {
    // Ignore browsers that don't support matchMedia.
  }

  // Watch for theme changes from other tabs/iframes
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const newTheme = e.newValue;
      if (VALID_THEMES.includes(newTheme)) {
        applyTheme(newTheme);
        document.dispatchEvent(new CustomEvent('theme:changed', {
          detail: { theme: newTheme, effective: getEffectiveTheme(newTheme) },
        }));
      }
    }
  });

  window.ThemeManager = {
    setTheme,
    getCurrentTheme,
    getEffective,
    resolveSystemTheme,
  };
})();
