import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Restore original solid background for tab-container */
:root[data-theme="dark"] .tab-container {
    background: #343434 !important;
    border: none !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        # Optional: remove the previous override to keep files clean, though appending works too
        if "rgba(0, 0, 0, 0.4) !important;" in content:
            content = content.replace("background: rgba(0, 0, 0, 0.4) !important;", "background: #343434 !important;")
            content = content.replace("border: 1px solid rgba(255, 255, 255, 0.05) !important;", "border: none !important;")
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Reverted tab container in {filepath}")
        else:
            with open(filepath, "w") as file:
                file.write(content + "\n" + css_append)
            print(f"Appended tab container fix in {filepath}")

