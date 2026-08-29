import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Premium dark-mode styling for the active tab button */
:root[data-theme="dark"] .tab-btn.active {
    background: #383838 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    border-radius: 8px !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Applied premium active tab style in {filepath}")

