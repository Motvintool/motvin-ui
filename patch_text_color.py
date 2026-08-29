import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

css = """
/* Force dropdown text to be white in dark mode */
:root[data-theme="dark"] .typeface-font-picker__option,
:root[data-theme="dark"] .typeface-select-menu > *,
:root[data-theme="dark"] .btn-dropdown > *,
:root[data-theme="dark"] .dropdown-item,
:root[data-theme="dark"] .sidebar-profile-menu__item,
:root[data-theme="dark"] .sidebar-profile-menu__name,
:root[data-theme="dark"] .sidebar-profile-menu__email,
:root[data-theme="dark"] .figma-align-menu-item,
:root[data-theme="dark"] .history-card-header-menu-item,
:root[data-theme="dark"] .styles-toolbar-button,
:root[data-theme="dark"] .styles-toolbar-button-save,
:root[data-theme="dark"] .styles-toolbar-button-label {
    color: #ffffff !important;
}
"""

for f in files:
    if not os.path.exists(f): continue
    with open(f, "a") as file:
        file.write("\n" + css)
    print(f"Updated text color in {f}")
