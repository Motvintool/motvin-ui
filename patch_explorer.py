import os

filepath = "MOTVIN/css/main.css"

css = """
/* Fixes for Explorer Content Text/Icon Colors and Shadows */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .explorer-title {
    color: #ffffff !important;
}

:root[data-theme="dark"] .explorer-content img,
:root[data-theme="dark"] .explorer-content svg {
    filter: brightness(0) invert(1) !important;
}

/* User requested dark shadow for explorer-content and sidebar-panel */
:root[data-theme="dark"] .explorer-content,
:root[data-theme="dark"] .sidebar-panel {
    box-shadow: 12px 0 24px rgba(0, 0, 0, 0.4) !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected fixes for explorer content.")

