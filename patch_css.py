import os

dark_theme_block = """
[data-theme="dark"] {
  --bg-app: #2e2e2e;
  --bg-sidebar: #2e2e2e;
  --bg-canvas: #1e1e1e;
  --text-main: #ffffff;
  --text-secondary: #b9b9b9;
  --text-muted: #787878;
  --text-white: #ffffff;
  --border-color: #464646;
  --border-color-light: #343434;
  --shadow-sm: 0px 1px 2px 0px rgba(0, 0, 0, 0.2);
  --shadow-md: 0px 4px 6px -1px rgba(0, 0, 0, 0.3), 0px 2px 4px -1px rgba(0, 0, 0, 0.24);
  --shadow-lg: 0px 10px 15px -3px rgba(0, 0, 0, 0.3), 0px 4px 6px -2px rgba(0, 0, 0, 0.2);
  --shadow-premium: 0px 10px 15px 0px rgba(0, 0, 0, 0.4), 0px 4px 6px 0px rgba(0, 0, 0, 0.24);
}
"""

def insert_after_root(filepath):
    if not os.path.exists(filepath):
        print(f"{filepath} not found")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    if '[data-theme="dark"]' in content:
        print(f"Already patched {filepath}")
        return
        
    # Find the end of the first :root block
    root_start = content.find(':root {')
    if root_start == -1:
        print(f"No :root block found in {filepath}")
        return
        
    brace_count = 0
    in_root = False
    insert_pos = -1
    
    for i in range(root_start, len(content)):
        if content[i] == '{':
            brace_count += 1
            in_root = True
        elif content[i] == '}':
            brace_count -= 1
            if in_root and brace_count == 0:
                insert_pos = i + 1
                break
                
    if insert_pos != -1:
        new_content = content[:insert_pos] + dark_theme_block + content[insert_pos:]
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Patched {filepath}")
    else:
        print(f"Could not find end of :root block in {filepath}")

for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    insert_after_root(f)
