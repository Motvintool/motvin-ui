import os

filepath = "MOTVIN/css/styles.css"

if os.path.exists(filepath):
    with open(filepath, "r") as file:
        content = file.read()
    
    # We will search for the specific edge trigger hover block we just added
    old_css = """/* Update edge trigger hover for dark mode */
:root[data-theme="dark"] .styles-palette-edge-trigger:hover .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge-trigger:focus-visible .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge.is-open .styles-palette-edge-trigger-inner {
    background-color: #ffffff14 !important;
}"""

    new_css = """/* Update edge trigger hover for dark mode */
:root[data-theme="dark"] .styles-palette-edge-trigger:hover .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge-trigger:focus-visible .styles-palette-edge-trigger-inner,
:root[data-theme="dark"] .styles-palette-edge.is-open .styles-palette-edge-trigger-inner {
    background-color: #ffffff24 !important;
}"""
    
    new_content = content.replace(old_css, new_css)
    
    if new_content != content:
        with open(filepath, "w") as file:
            file.write(new_content)
        print(f"Increased edge trigger hover opacity in {filepath}")
    else:
        print(f"No changes made to {filepath} (block not found)")
