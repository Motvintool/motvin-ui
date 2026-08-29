import os

filepath = "MOTVIN/css/main.css"

css = """
/* Increase blur on explorer and sidebar shadows as requested */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .sidebar-panel {
    box-shadow: 12px 0 64px rgba(0, 0, 0, 0.6) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected high blur shadow.")

