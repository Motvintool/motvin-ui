import os

MARKER = '/* ═══════════════════════════════════════════════════════════'

for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    if not os.path.exists(f):
        continue
    
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
    
    idx = content.find(MARKER)
    if idx == -1:
        print(f"No generated block found in {f}")
        continue
    
    # Remove everything from the marker to the end
    # Also strip trailing whitespace before the marker
    new_content = content[:idx].rstrip() + '\n'
    
    with open(f, "w", encoding="utf-8") as file:
        file.write(new_content)
    print(f"Removed generated overrides from {f}")
