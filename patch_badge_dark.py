import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Premium dark-mode styling for the explorer-title-badge */
:root[data-theme="dark"] .explorer-title-badge {
    background: rgba(87, 56, 207, 0.15) !important;
    color: #9988FF !important;
    border: 1px solid rgba(153, 136, 255, 0.25) !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Updated badge style in {filepath}")

