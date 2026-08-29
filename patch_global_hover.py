import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Unify all dropdown menu items to use the free-paid-dropdown-option hover style (#008ff0) */
:root[data-theme="dark"] .figma-align-menu-item:hover,
:root[data-theme="dark"] .dropdown-item:hover,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover,
:root[data-theme="dark"] .history-card-header-menu-item:hover,
:root[data-theme="dark"] .history-popup-filter-item:hover,
:root[data-theme="dark"] .styles-toolbar-export-option:hover,
:root[data-theme="dark"] .typeface-font-picker__option:hover,
:root[data-theme="dark"] .sp-dropdown-menu > *:hover {
    background: #008ff0 !important;
    outline: none !important;
    color: #ffffff !important;
}

/* Ensure any svgs or images inside these items become perfectly white on hover */
:root[data-theme="dark"] .figma-align-menu-item:hover img,
:root[data-theme="dark"] .figma-align-menu-item:hover svg,
:root[data-theme="dark"] .dropdown-item:hover img,
:root[data-theme="dark"] .dropdown-item:hover svg,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover img,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover svg,
:root[data-theme="dark"] .history-card-header-menu-item:hover img,
:root[data-theme="dark"] .history-card-header-menu-item:hover svg {
    filter: brightness(0) invert(1) !important;
    opacity: 1 !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected global blue hover state into {f}")

