import os

for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    if not os.path.exists(f):
        continue
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
        
    new_content = content.replace('[data-theme="dark"] {', ':root[data-theme="dark"] {')
    
    if new_content != content:
        with open(f, "w", encoding="utf-8") as file:
            file.write(new_content)
        print(f"Fixed {f}")
