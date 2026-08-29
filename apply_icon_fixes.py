import os

css_code = """
/* ═══════════════════════════════════════════════════════════
   GLOBAL DARK THEME ICON OVERRIDES
   ═══════════════════════════════════════════════════════════ */
:root[data-theme="dark"] img[src*="image/svg"],
:root[data-theme="dark"] [class*="icon"] svg,
:root[data-theme="dark"] svg[class*="icon"],
:root[data-theme="dark"] button svg,
:root[data-theme="dark"] button img,
:root[data-theme="dark"] .sidebar-panel-toggle-icon img,
:root[data-theme="dark"] .tree-tab-icon img,
:root[data-theme="dark"] .figma-tool-btn img,
:root[data-theme="dark"] .figma-align-menu-item img,
:root[data-theme="dark"] .sidebar-profile-menu__icon svg,
:root[data-theme="dark"] .sidebar-profile-badge-icon svg,
:root[data-theme="dark"] .dropzone-icon svg,
:root[data-theme="dark"] .theme-icon {
    filter: brightness(0) invert(1) !important;
    opacity: 1 !important;
    transition: opacity 0.2s ease !important;
}

/* Hover state: light white */
:root[data-theme="dark"] *:hover > img[src*="image/svg"],
:root[data-theme="dark"] *:hover > svg[class*="icon"],
:root[data-theme="dark"] *:hover > [class*="icon"] svg,
:root[data-theme="dark"] button:hover svg,
:root[data-theme="dark"] button:hover img,
:root[data-theme="dark"] .sidebar-panel-toggle-icon:hover img,
:root[data-theme="dark"] .tree-tab:hover .tree-tab-icon img,
:root[data-theme="dark"] .figma-tool-btn:hover img,
:root[data-theme="dark"] .figma-align-menu-item:hover img,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover .sidebar-profile-menu__icon svg,
:root[data-theme="dark"] [class*="btn"]:hover img[src*="image/svg"],
:root[data-theme="dark"] [class*="btn"]:hover svg {
    filter: brightness(0) invert(1) !important;
    opacity: 0.65 !important;
}
"""

for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    if not os.path.exists(f): continue
    with open(f, "a") as file:
        file.write(css_code)
    print(f"Appended icon overrides to {f}")
