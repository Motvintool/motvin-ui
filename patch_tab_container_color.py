import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        if "background: #343434 !important;" in content:
            # We specifically target the tab-container revert block I wrote
            content = content.replace(
                "/* Restore original solid background for tab-container */\n:root[data-theme=\"dark\"] .tab-container {\n    background: #343434 !important;\n    border: none !important;\n}",
                "/* Restore original solid background for tab-container */\n:root[data-theme=\"dark\"] .tab-container {\n    background: #3F3F3F !important;\n    border: none !important;\n}"
            )
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Updated tab-container color in {filepath}")
        else:
            print(f"Pattern not found in {filepath}")

