import os

filepath = "MOTVIN/css/typeface.css"

menu_css = """
/* Typeface Menus Matching .free-paid-dropdown-panel */
:root[data-theme="dark"] .typeface-select-menu,
:root[data-theme="dark"] .typeface-font-picker,
:root[data-theme="dark"] .typeface-select-menu.typeface-select-menu--upward {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 10px rgba(0, 0, 0, 0.3), 3px 0 20px rgba(0, 0, 0, 0.12) !important;
    padding: 8px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
}

/* Hover and Active states for items inside these menus */
:root[data-theme="dark"] .typeface-font-picker__option:hover,
:root[data-theme="dark"] .typeface-select-menu > *:hover {
    background-color: #ffffff14 !important;
}

:root[data-theme="dark"] .typeface-font-picker__option.is-active,
:root[data-theme="dark"] .typeface-select-menu > *.is-active {
    background-color: #4b4958 !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + menu_css)
    print(f"Updated typeface menus in {filepath}")
