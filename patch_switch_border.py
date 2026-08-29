import os

filepath = "MOTVIN/css/typeface.css"

css = """
/* Update border color for typeface switches */
:root[data-theme="dark"] .typeface-unit-switch,
:root[data-theme="dark"] .typeface-icon-switch {
    border-color: #464646 !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as f:
        f.write("\n" + css)
    print(f"Updated typeface switch border color in {filepath}")
