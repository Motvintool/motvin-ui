import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        if "rgba(255, 255, 255, 0.35) !important;" in content:
            content = content.replace("background: rgba(255, 255, 255, 0.35) !important;", "background: rgba(255, 255, 255, 0.15) !important;")
            content = content.replace("rgba(255, 255, 255, 0.4) !important;", "rgba(255, 255, 255, 0.25) !important;")
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Reverted opacity in {filepath}")
        else:
            print(f"Pattern not found in {filepath}")

