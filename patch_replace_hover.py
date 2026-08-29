import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
        
        # Replace the specific #3a3a3a block that had too much specificity
        old_block = "background: #3a3a3a !important;"
        new_block = "background: #008ff0 !important;\n  color: #ffffff !important;\n  outline: none !important;"
        
        if old_block in content:
            content = content.replace(old_block, new_block)
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Successfully replaced #3a3a3a in {filepath}")
        else:
            print(f"Target block not found in {filepath}")

