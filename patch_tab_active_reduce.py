import os
import re

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        # Target the specific frosted glass values we injected
        if "rgba(255, 255, 255, 0.15) !important;" in content:
            # Reduce background opacity from 0.15 to 0.08
            content = content.replace("background: rgba(255, 255, 255, 0.15) !important;", "background: rgba(255, 255, 255, 0.08) !important;")
            # Reduce border glow from 0.25 to 0.12
            content = content.replace("rgba(255, 255, 255, 0.25) !important;", "rgba(255, 255, 255, 0.12) !important;")
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Reduced tab-btn active opacity in {filepath}")
        else:
            print(f"Pattern not found in {filepath}")

