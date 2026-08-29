import os

files_to_patch = [
    "MOTVIN/styles.html",
    "MOTVIN/typeface.html",
    "MOTVIN/index.html"
]

for filepath in files_to_patch:
    if not os.path.exists(filepath):
        print(f"{filepath} not found")
        continue
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    target_string = '<script src="https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js"'
    replacement = '<script src="../JS/theme-manager.js"></script>\n    <script src="https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js"'
    
    if replacement not in content:
        new_content = content.replace(target_string, replacement, 1)
        if new_content != content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Patched {filepath}")
        else:
            print(f"Could not find target in {filepath}")
    else:
        print(f"Already patched {filepath}")
