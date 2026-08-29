import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Make toolbar menus globally dark and match the free-paid panel sizing across ALL themes */
#toolbarAddMenu,
#toolbarAlignMenu {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 10px rgba(0, 0, 0, 0.3), 3px 0 20px rgba(0, 0, 0, 0.12) !important;
    padding: 8px !important;
    gap: 8px !important;
    flex-direction: column;
}

#toolbarAddMenu > *,
#toolbarAlignMenu > * {
    color: #ffffff !important;
}

#toolbarAddMenu .figma-align-menu-item,
#toolbarAlignMenu .figma-align-menu-item,
.figma-align-menu-item {
    background: transparent !important;
    color: #ffffff !important;
    padding: 5.5px 8px !important;
}

/* Unified hover state globally (no data-theme prefix) */
#toolbarAddMenu .figma-align-menu-item:hover,
#toolbarAlignMenu .figma-align-menu-item:hover,
.figma-align-menu-item:hover {
    background: #008ff0 !important;
    outline: none !important;
    color: #ffffff !important;
}

/* Ensure nested SVGs invert correctly by default (against dark panel) and on hover */
#toolbarAddMenu .figma-align-menu-item img,
#toolbarAddMenu .figma-align-menu-item svg,
#toolbarAlignMenu .figma-align-menu-item img,
#toolbarAlignMenu .figma-align-menu-item svg,
.figma-align-menu-item img,
.figma-align-menu-item svg {
    filter: brightness(0) invert(1) !important;
    opacity: 1 !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected global menu styling into {f}")

