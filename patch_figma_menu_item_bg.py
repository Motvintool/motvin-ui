import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Fix base background of menu items so they are transparent and blend perfectly into the #1e1e1e popup panel */
:root[data-theme="dark"] .figma-align-menu-item {
    background: transparent !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected transparent base background for menu items into {f}")

