import os

filepath = "MOTVIN/css/main.css"

css = """
/* User Requested Specific Fixes for History Popup Elements */

/* 1. Remove conflicting box-shadows on headers and tabs in dark mode */
:root[data-theme="dark"] .history-popup-header,
:root[data-theme="dark"] .history-popup-tabs {
    box-shadow: none !important;
}

/* 2. Fix the glowing white shadow on the section menu */
:root[data-theme="dark"] .history-popup-section-menu,
:root[data-theme="dark"] #historyPopupSectionMenu {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 0 1px #343434 !important;
    background: #1e1e1e !important;
}

/* 3. Ensure the filter button icon is visible and states are correct */
:root[data-theme="dark"] .history-popup-filter-btn svg {
    color: #ffffff !important;
}

:root[data-theme="dark"] .history-popup-filter-btn.is-active,
:root[data-theme="dark"] .history-popup-filter-btn:active {
    background: #35343D !important;
    border-color: #705BEF !important;
    color: #ffffff !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print("Injected specific user-requested fixes.")

