import os

filepath = "MOTVIN/css/main.css"

css = """
/* Update active color to #9988FF as requested */
:root[data-theme="dark"] .tree-tab.active .tree-tab-text {
    color: #9988FF !important;
}

:root[data-theme="dark"] .tree-tab.active .tree-tab-icon {
    color: #9988FF !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected new active color for tree accordion.")

