import os

# Add --stroke-0: #ffffff to the dark theme :root block in each CSS file
for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    if not os.path.exists(f):
        continue
    
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
    
    if '--stroke-0' in content:
        print(f"Already has --stroke-0 in {f}")
        continue
    
    # Find the first :root[data-theme="dark"] block and add --stroke-0 inside it
    target = ':root[data-theme="dark"] {\n'
    idx = content.find(target)
    if idx == -1:
        print(f"No :root[data-theme='dark'] block found in {f}")
        continue
    
    insert_pos = idx + len(target)
    new_content = content[:insert_pos] + '  --stroke-0: #ffffff;\n' + content[insert_pos:]
    
    with open(f, "w", encoding="utf-8") as file:
        file.write(new_content)
    print(f"Added --stroke-0 to {f}")
