import os

filepath = "MOTVIN/css/styles.css"

css = """
/* Update edge trigger hover for dark mode */
:root[data-theme="dark"] .styles-palette-edge-trigger:hover .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge-trigger:focus-visible .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge.is-open .styles-palette-edge-trigger-inner {
    background-color: #ffffff14 !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print(f"Updated edge trigger hover color in {filepath}")
