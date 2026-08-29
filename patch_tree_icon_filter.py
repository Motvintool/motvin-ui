import os

filepath = "MOTVIN/css/main.css"

css = """
/* Remove the aggressive SVG inversion filter from the tree-tab icons so they can actually inherit the #9988FF color */
:root[data-theme="dark"] .explorer-content .tree-tab-icon svg,
:root[data-theme="dark"] .explorer-content .tree-tab-icon img {
    filter: none !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected filter removal for tree tab icons.")

