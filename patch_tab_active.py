import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Apply toolbarAddMenu panel styling to active tab buttons */
.tab-btn.active {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 10px rgba(0, 0, 0, 0.3), 3px 0 20px rgba(0, 0, 0, 0.12) !important;
    color: #ffffff !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Applied panel style to tab-btn.active in {filepath}")

