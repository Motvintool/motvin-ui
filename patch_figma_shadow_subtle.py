import os

filepath = "MOTVIN/css/main.css"

css = """
/* Even more subtle shadow as requested */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .sidebar-panel {
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected even more subtle shadow.")

