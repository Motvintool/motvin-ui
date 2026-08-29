import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Fix toggle pill background to have a right transparent gradient */
:root[data-theme="dark"] .sidebar-panel-toggle-pill {
    background: linear-gradient(90deg, #ffffff1a 0%, rgba(255, 255, 255, 0) 100%) !important;
}

/* Fix figma-align-menu-item hover states (for toolbarAddMenu and toolbarAlignMenu) */
:root[data-theme="dark"] #toolbarAddMenu .figma-align-menu-item:hover,
:root[data-theme="dark"] #toolbarAlignMenu .figma-align-menu-item:hover,
:root[data-theme="dark"] .figma-align-menu-item:hover {
    background: #ffffff14 !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected pill and menu hover fixes into {f}")

