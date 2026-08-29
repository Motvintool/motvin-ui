import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        if "rgba(255, 255, 255, 0.08) !important;" in content:
            # Revert background opacity from 0.08 back to 0.15
            content = content.replace("background: rgba(255, 255, 255, 0.08) !important;", "background: rgba(255, 255, 255, 0.15) !important;")
            # Revert border glow from 0.12 back to 0.25
            content = content.replace("rgba(255, 255, 255, 0.12) !important;", "rgba(255, 255, 255, 0.25) !important;")
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Reverted tab-btn active opacity in {filepath}")
        else:
            print(f"Pattern not found in {filepath}")

