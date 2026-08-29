import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    # We will replace the hover block completely
    old_block = """/* Hover state: light white */
:root[data-theme="dark"] *:hover > img[src*="image/svg"],
:root[data-theme="dark"] *:hover > svg[class*="icon"],
:root[data-theme="dark"] *:hover > [class*="icon"] svg,
:root[data-theme="dark"] button:hover svg,
:root[data-theme="dark"] button:hover img,
:root[data-theme="dark"] .sidebar-panel-toggle-icon:hover img,
:root[data-theme="dark"] .tree-tab:hover .tree-tab-icon img,
:root[data-theme="dark"] .figma-tool-btn:hover img,
:root[data-theme="dark"] .figma-align-menu-item:hover img,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover .sidebar-profile-menu__icon svg,
:root[data-theme="dark"] [class*="btn"]:hover img[src*="image/svg"],
:root[data-theme="dark"] [class*="btn"]:hover svg {
    filter: brightness(0) invert(1) !important;
    opacity: 0.05 !important;
}"""

    new_block = """/* Hover state: light white */
:root[data-theme="dark"] *:hover > img[src*="image/svg"],
:root[data-theme="dark"] *:hover > svg[class*="icon"],
:root[data-theme="dark"] *:hover > [class*="icon"] svg,
:root[data-theme="dark"] button:hover svg,
:root[data-theme="dark"] button:hover img,
:root[data-theme="dark"] .sidebar-panel-toggle-icon:hover img,
:root[data-theme="dark"] .tree-tab:hover .tree-tab-icon img,
:root[data-theme="dark"] .figma-tool-btn:hover img,
:root[data-theme="dark"] .figma-align-menu-item:hover img,
:root[data-theme="dark"] .sidebar-profile-menu__item:hover .sidebar-profile-menu__icon svg,
:root[data-theme="dark"] [class*="btn"]:hover img[src*="image/svg"],
:root[data-theme="dark"] [class*="btn"]:hover svg,
:root[data-theme="dark"] div:hover > img[src*="image/svg"],
:root[data-theme="dark"] div:hover > svg {
    filter: brightness(0) invert(1) opacity(0.5) !important;
    opacity: 0.5 !important;
}"""
    
    new_content = content.replace(old_block, new_block)
    
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Updated opacity block in {f}")
    else:
        print(f"No changes made to {f} (block not found)")
