import os

filepath = "MOTVIN/css/typeface.css"

css = """
/* Turn the dropdown arrow / icon white inside the typeface select inputs */
:root[data-theme="dark"] .typeface-input-shell.typeface-input-shell--select svg,
:root[data-theme="dark"] .typeface-input-shell.typeface-input-shell--select img {
    filter: brightness(0) invert(1) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print(f"Updated typeface select icon color in {filepath}")
