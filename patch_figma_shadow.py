import os

filepath = "MOTVIN/css/main.css"

css = """
/* Replace old ugly shadow with a sleek, Figma-style layered shadow */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .sidebar-panel {
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected Figma-style shadows.")

