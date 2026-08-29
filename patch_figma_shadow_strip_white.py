import os

filepath = "MOTVIN/css/main.css"

css = """
/* Remove the 1px white stroke from the shadow */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .sidebar-panel {
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.15) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected shadow fix without white stroke.")

