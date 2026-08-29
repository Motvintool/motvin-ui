import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

menu_css = """
/* Standardized Dark Theme Dropdown Panel Styles (Matching .free-paid-dropdown-panel) */
:root[data-theme="dark"] .btn-dropdown,
:root[data-theme="dark"] .sidebar-profile-menu__panel,
:root[data-theme="dark"] .figma-align-menu,
:root[data-theme="dark"] .history-card-header-menu,
:root[data-theme="dark"] .sp-dropdown-menu,
:root[data-theme="dark"] .styles-palette-menu {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 10px rgba(0, 0, 0, 0.3), 3px 0 20px rgba(0, 0, 0, 0.12) !important;
    padding: 8px !important;
}

/* Adjust gap if they wanted the 8px spacing, though 2px-4px is standard for standard menus, let's just make the wrappers flex and gap 8px where it applies directly to children */
:root[data-theme="dark"] .btn-dropdown,
:root[data-theme="dark"] .sidebar-profile-menu__actions,
:root[data-theme="dark"] .figma-align-menu,
:root[data-theme="dark"] .history-card-header-menu {
    gap: 8px !important;
}
"""

for f in files:
    if not os.path.exists(f): continue
    with open(f, "a") as file:
        file.write("\n" + menu_css)
    print(f"Updated dropdown panel styles in {f}")
