import os
import re

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        # Replace the base #343434
        content = re.sub(
            r'(:root\[data-theme="dark"\]\s*\.tab-container\s*\{\s*background:\s*)#343434(;?)',
            r'\1#646464\2',
            content
        )
        
        # Replace the !important override if it exists (maybe it was #343434 or #3F3F3F)
        content = re.sub(
            r'(:root\[data-theme="dark"\]\s*\.tab-container\s*\{[^}]*background:\s*)(#[0-9a-fA-F]{6})(\s*!important;?)',
            r'\1#646464\3',
            content
        )

        with open(filepath, "w") as file:
            file.write(content)
        print(f"Updated tab-container color to #646464 in {filepath}")

