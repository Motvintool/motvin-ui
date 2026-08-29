import os

filepath = "MOTVIN/css/typeface.css"

css = """
/* Invert the background-image SVG icon on the :after pseudo-element */
:root[data-theme="dark"] .typeface-input-shell--select:after {
    filter: brightness(0) invert(1) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print(f"Updated typeface select :after icon color in {filepath}")
