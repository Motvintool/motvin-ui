import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

css = """
/* FINAL DARK THEME AUDIT OVERRIDES */

/* 1. Missing Search Inputs & Wrappers */
:root[data-theme="dark"] .command-palette-input,
:root[data-theme="dark"] .history-popup-search,
:root[data-theme="dark"] .sp-search-input-wrap,
:root[data-theme="dark"] .typeface-font-picker__search-wrap {
    background-color: #1e1e1e !important;
    border-color: #343434 !important;
}

/* Ensure the inputs themselves are transparent or dark and text is white */
:root[data-theme="dark"] .history-popup-search-input,
:root[data-theme="dark"] .sp-search-input,
:root[data-theme="dark"] .typeface-font-picker__search,
:root[data-theme="dark"] .command-palette-input {
    background: transparent !important;
    color: #ffffff !important;
}

/* 2. Placeholders */
:root[data-theme="dark"] .command-palette-input::placeholder,
:root[data-theme="dark"] .history-popup-search-input::placeholder,
:root[data-theme="dark"] .typeface-font-picker__search::placeholder,
:root[data-theme="dark"] .sp-search-input::placeholder {
    color: #888888 !important;
}

/* 3. Invert Search Icons */
:root[data-theme="dark"] .command-palette-search-icon,
:root[data-theme="dark"] .history-popup-search-icon,
:root[data-theme="dark"] .typeface-font-picker__search-icon,
:root[data-theme="dark"] .sp-search-icon {
    filter: brightness(0) invert(1) !important;
    opacity: 0.6 !important;
}

/* 4. Scrollbar Tracks */
:root[data-theme="dark"] ::-webkit-scrollbar-track {
    background: #1a1a1a !important;
}
:root[data-theme="dark"] ::-webkit-scrollbar-thumb {
    background: #343434 !important;
}

/* 5. Modals & Popups Backgrounds */
:root[data-theme="dark"] .command-palette,
:root[data-theme="dark"] .command-palette-modal,
:root[data-theme="dark"] .history-popup {
    background: #1a1a1a !important;
    border: 1px solid #343434 !important;
}

/* 6. Stray Dividers / Borders in Modals */
:root[data-theme="dark"] .command-palette-header,
:root[data-theme="dark"] .command-palette-footer,
:root[data-theme="dark"] .history-popup-header,
:root[data-theme="dark"] .history-popup-section-menu,
:root[data-theme="dark"] .history-popup-title-btn {
    border-color: #343434 !important;
}

/* Ensure command palette items are visible */
:root[data-theme="dark"] .command-palette-item-title {
    color: #ffffff !important;
}
:root[data-theme="dark"] .command-palette-item-subtitle {
    color: #aaaaaa !important;
}
"""

for f in files:
    if not os.path.exists(f): continue
    with open(f, "a") as file:
        file.write("\n" + css)
    print(f"Applied final audit fixes to {f}")
