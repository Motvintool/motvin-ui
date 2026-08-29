import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Standardize padding, size, and color for ALL menu items across the entire app */
.figma-align-menu-item,
.dropdown-item,
.sidebar-profile-menu__item,
.history-card-header-menu-item,
.history-popup-filter-item,
.styles-toolbar-export-option,
.typeface-font-picker__option {
    background: transparent !important;
    color: #ffffff !important;
    padding: 5.5px 8px !important;
    font-size: 11px !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 400 !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
        
        # Replace the blue hover color with the new purple hover color
        if "#008ff0" in content:
            content = content.replace("#008ff0", "#715BF0")
            print(f"Replaced #008ff0 with #715BF0 in {filepath}")
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Updated {filepath}")

