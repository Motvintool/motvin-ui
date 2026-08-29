import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Fix border stroke issue (prevent double borders and box model shifts) */
:root[data-theme="dark"] .styles-toolbar-preview-card,
:root[data-theme="dark"] .styles-toolbar-export-card {
    background: #1e1e1e !important;
    border: none !important;
    box-shadow: 0 0 0 1px #343434, 0 8px 32px rgba(0, 0, 0, 0.6) !important;
    border-radius: 12px !important;
}

/* Strip inner body of redundant styling */
:root[data-theme="dark"] .styles-toolbar-export-body {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Fixed stroke issue in {f}")

