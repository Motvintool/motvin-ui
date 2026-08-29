import os

filepath = "MOTVIN/css/history-popup.css"

css = """
/* FINAL FIXES FOR HISTORY POPUP INTERNALS */

/* 1. Missing Search Inputs & Wrappers */
:root[data-theme="dark"] .history-popup-search {
    background-color: #1e1e1e !important;
    border-color: #343434 !important;
}

:root[data-theme="dark"] .history-popup-search-input {
    background: transparent !important;
    color: #ffffff !important;
}

:root[data-theme="dark"] .history-popup-search-input::placeholder {
    color: #888888 !important;
}

:root[data-theme="dark"] .history-popup-search-icon {
    filter: brightness(0) invert(1) !important;
    opacity: 0.6 !important;
}

/* Modals & Popups Backgrounds */
:root[data-theme="dark"] .history-popup {
    background: #1a1a1a !important;
    border: 1px solid #343434 !important;
}

:root[data-theme="dark"] .history-popup-header,
:root[data-theme="dark"] .history-popup-tabs {
    background: #1a1a1a !important;
    border-bottom: 1px solid #343434 !important;
    box-shadow: none !important;
}

/* Text Colors */
:root[data-theme="dark"] .history-popup-title,
:root[data-theme="dark"] .history-popup-section-item,
:root[data-theme="dark"] .history-popup-tab,
:root[data-theme="dark"] .history-popup-filter-item,
:root[data-theme="dark"] .history-popup-item-title,
:root[data-theme="dark"] .history-popup-empty-title {
    color: #ffffff !important;
}

:root[data-theme="dark"] .history-popup-item-info,
:root[data-theme="dark"] .history-popup-item-time,
:root[data-theme="dark"] .history-popup-empty-subtitle {
    color: #a0a0a0 !important;
}

/* Backgrounds for Dropdowns/Menus */
:root[data-theme="dark"] .history-popup-section-menu,
:root[data-theme="dark"] #historyPopupSectionMenu,
:root[data-theme="dark"] .history-popup-filter-menu {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 0 1px #343434 !important;
}

/* Hover & Active States */
:root[data-theme="dark"] .history-popup-section-item:hover,
:root[data-theme="dark"] .history-popup-filter-item:hover,
:root[data-theme="dark"] .history-popup-tab:hover,
:root[data-theme="dark"] .history-popup-title-btn:hover {
    background: #ffffff14 !important;
    color: #ffffff !important;
}

:root[data-theme="dark"] .history-popup-section-item.is-active,
:root[data-theme="dark"] .history-popup-filter-item.active,
:root[data-theme="dark"] .history-popup-tab.active {
    background: #35343D !important;
    color: #705BEF !important;
}

/* List Item Borders and Hover */
:root[data-theme="dark"] .history-popup-item {
    border-bottom: 1px solid #343434 !important;
}
:root[data-theme="dark"] .history-popup-item:hover {
    background: #ffffff0a !important;
}

/* Buttons (Close, Actions) */
:root[data-theme="dark"] .history-popup-close,
:root[data-theme="dark"] .history-popup-btn,
:root[data-theme="dark"] .history-popup-filter-btn {
    color: #ffffff !important;
    border-color: #343434 !important;
    background: transparent !important;
}

:root[data-theme="dark"] .history-popup-close:hover,
:root[data-theme="dark"] .history-popup-btn:hover,
:root[data-theme="dark"] .history-popup-filter-btn:hover {
    background: #ffffff14 !important;
}

/* Ensure the filter button icon is visible and states are correct */
:root[data-theme="dark"] .history-popup-filter-btn svg {
    color: #ffffff !important;
}
:root[data-theme="dark"] .history-popup-filter-btn.is-active,
:root[data-theme="dark"] .history-popup-filter-btn:active {
    background: #35343D !important;
    border-color: #705BEF !important;
    color: #ffffff !important;
}

/* Invert Title SVG/Chevrons */
:root[data-theme="dark"] .history-popup-title-btn img,
:root[data-theme="dark"] .history-popup-title-btn svg {
    filter: brightness(0) invert(1) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print(f"Applied fixes to {filepath}")
else:
    print(f"File {filepath} not found.")

