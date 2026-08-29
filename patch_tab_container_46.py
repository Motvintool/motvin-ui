import os
import re

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        # Replace the base #646464
        content = re.sub(
            r'(:root\[data-theme="dark"\]\s*\.tab-container\s*\{\s*background:\s*)#646464(;?)',
            r'\1#464646\2',
            content
        )
        
        # Replace the !important override if it exists
        content = re.sub(
            r'(:root\[data-theme="dark"\]\s*\.tab-container\s*\{[^}]*background:\s*)(#646464)(\s*!important;?)',
            r'\1#464646\3',
            content
        )

        with open(filepath, "w") as file:
            file.write(content)
        print(f"Updated tab-container color to #464646 in {filepath}")

