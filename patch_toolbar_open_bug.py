import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Fix always-open bug: only display when .open is present */
:root[data-theme="dark"] #toolbarAddMenu:not(.open),
:root[data-theme="dark"] #toolbarAlignMenu:not(.open) {
    display: none !important;
}

/* Fix figma-align-menu-item hover to be a nice dark grey, completely removing any 'white' background */
:root[data-theme="dark"] #toolbarAddMenu .figma-align-menu-item:hover,
:root[data-theme="dark"] #toolbarAlignMenu .figma-align-menu-item:hover,
:root[data-theme="dark"] .figma-align-menu-item:hover {
    background: #3a3a3a !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected fixes into {f}")

