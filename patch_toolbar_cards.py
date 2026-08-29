import os

filepath = "MOTVIN/css/styles.css"

css = """
/* Fixes for Toolbar Preview/Export Cards and Backdrop */

/* Fix the blinding white backdrop overlay */
:root[data-theme="dark"] .styles-toolbar-preview-popover {
    background: rgba(0, 0, 0, 0.7) !important;
}

/* Update the cards to use standard dark theme panel styles */
:root[data-theme="dark"] .styles-toolbar-preview-card,
:root[data-theme="dark"] .styles-toolbar-export-card,
:root[data-theme="dark"] .styles-toolbar-export-body {
    background: #1a1a1a !important;
    border: 1px solid #343434 !important;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.8) !important;
}

/* Ensure text inside headers is white */
:root[data-theme="dark"] .styles-toolbar-preview-title,
:root[data-theme="dark"] .styles-toolbar-export-title {
    color: #ffffff !important;
}

/* Ensure the header border matches */
:root[data-theme="dark"] .styles-toolbar-preview-header {
    border-bottom: 1px solid #343434 !important;
    box-shadow: none !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print("Injected fixes for toolbar cards and backdrop.")

