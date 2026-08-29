import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

css = """
/* Active Text Color in Dark Mode */
:root[data-theme="dark"] .typeface-font-picker__option.is-active,
:root[data-theme="dark"] .typeface-select-menu > *.is-active,
:root[data-theme="dark"] .btn-dropdown > *.is-active,
:root[data-theme="dark"] .btn-dropdown > *.active,
:root[data-theme="dark"] .dropdown-item.is-active,
:root[data-theme="dark"] .dropdown-item.active,
:root[data-theme="dark"] .sidebar-profile-menu__item.is-active,
:root[data-theme="dark"] .sidebar-profile-menu__item.active,
:root[data-theme="dark"] .figma-align-menu-item.is-active,
:root[data-theme="dark"] .figma-align-menu-item.active,
:root[data-theme="dark"] .history-card-header-menu-item.is-active,
:root[data-theme="dark"] .history-card-header-menu-item.active,
:root[data-theme="dark"] .styles-toolbar-button:active,
:root[data-theme="dark"] .styles-toolbar-button.is-active,
:root[data-theme="dark"] .styles-toolbar-button[aria-pressed="true"],
:root[data-theme="dark"] .styles-toolbar-button-save:active,
:root[data-theme="dark"] .styles-toolbar-button-save.is-active {
    color: #705BEF !important;
}

/* Also ensure any nested text inside active buttons gets the color */
:root[data-theme="dark"] .styles-toolbar-button:active .styles-toolbar-button-label,
:root[data-theme="dark"] .styles-toolbar-button.is-active .styles-toolbar-button-label,
:root[data-theme="dark"] .styles-toolbar-button[aria-pressed="true"] .styles-toolbar-button-label {
    color: #705BEF !important;
}
"""

for f in files:
    if not os.path.exists(f): continue
    with open(f, "a") as file:
        file.write("\n" + css)
    print(f"Updated active text color in {f}")
