import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    # Replace opacity: 0.65 !important; with opacity: 0.05 !important;
    new_content = content.replace('opacity: 0.65 !important;', 'opacity: 0.05 !important;')
    
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Updated opacity in {f}")
    else:
        print(f"No changes made to {f}")
