import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

toolbar_css = """
/* Toolbar Button Hover & Active States */
:root[data-theme="dark"] .styles-toolbar-button:hover,
:root[data-theme="dark"] .styles-toolbar-button-save:hover {
    background-color: #ffffff14 !important;
}

:root[data-theme="dark"] .styles-toolbar-button:active,
:root[data-theme="dark"] .styles-toolbar-button.is-active,
:root[data-theme="dark"] .styles-toolbar-button[aria-pressed="true"],
:root[data-theme="dark"] .styles-toolbar-button-save:active,
:root[data-theme="dark"] .styles-toolbar-button-save.is-active {
    background-color: #4b4958 !important;
}
"""

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    # Update menus in index.html (which used #3b3a58 for hover/active) to the new #ffffff14
    new_content = content.replace("#3b3a58", "#ffffff14")
    
    # Append toolbar CSS if not already there
    if "/* Toolbar Button Hover & Active States */" not in new_content:
        new_content += "\n" + toolbar_css
        
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Updated menus and toolbar buttons in {f}")
    else:
        print(f"No changes made to {f}")
