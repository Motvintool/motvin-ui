import os

filepath = "MOTVIN/css/main.css"

css = """
/* Fix for tree-accordion text and active purple box issue */

/* Normal inactive state: white text, clear background overrides */
:root[data-theme="dark"] .tree-tab .tree-tab-text {
    color: #ffffff !important;
    background: none !important;
    -webkit-text-fill-color: initial !important;
}

/* Active state: crisp purple text, clear background text-clipping overrides */
:root[data-theme="dark"] .tree-tab.active .tree-tab-text {
    color: #705BEF !important;
    background: none !important;
    -webkit-text-fill-color: initial !important;
}

/* Inactive Icon: white */
:root[data-theme="dark"] .tree-tab:not(.active) .tree-tab-icon {
    color: #ffffff !important;
}

/* Active Icon: purple */
:root[data-theme="dark"] .tree-tab.active .tree-tab-icon {
    color: #705BEF !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected fixes for tree-accordion text colors.")

