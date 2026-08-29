import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Fixes for Toolbar Preview/Export Cards Text & Hover States */

/* Hover states for rows */
:root[data-theme="dark"] .styles-toolbar-preview-row:hover,
:root[data-theme="dark"] .styles-toolbar-preview-row:focus-visible,
:root[data-theme="dark"] .styles-toolbar-preview-row-copy:hover,
:root[data-theme="dark"] .styles-toolbar-preview-row-copy:focus-visible,
:root[data-theme="dark"] .styles-toolbar-export-option:hover,
:root[data-theme="dark"] .styles-toolbar-export-option:focus-visible {
    background: #ffffff14 !important;
}

/* Close button hover */
:root[data-theme="dark"] .styles-toolbar-preview-close:hover,
:root[data-theme="dark"] .styles-toolbar-preview-close:focus-visible,
:root[data-theme="dark"] .styles-toolbar-export-close:hover,
:root[data-theme="dark"] .styles-toolbar-export-close:focus-visible {
    background: #ffffff14 !important;
}

/* Text Colors */
:root[data-theme="dark"] .styles-toolbar-preview-label {
    color: #a0a0a0 !important;
}
:root[data-theme="dark"] .styles-toolbar-preview-value {
    color: #ffffff !important;
}

:root[data-theme="dark"] .styles-toolbar-export-option-label {
    color: #ffffff !important;
}
:root[data-theme="dark"] .styles-toolbar-export-option-desc {
    color: #a0a0a0 !important;
}

/* Ensure icons/svgs in these rows invert correctly */
:root[data-theme="dark"] .styles-toolbar-preview-copy-icon,
:root[data-theme="dark"] .styles-toolbar-export-icon {
    filter: brightness(0) invert(1) !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected text and hover fixes into {f}")

