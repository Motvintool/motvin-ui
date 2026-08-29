import os

dark_inline_override = ' :root[data-theme="dark"] .sidebar-panel.sidebar-two-col { border-color: #464646 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15) !important; } '

for f in ["MOTVIN/styles.html", "MOTVIN/typeface.html"]:
    if not os.path.exists(f):
        print(f"{f} not found")
        continue
    
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
    
    # Check if already patched
    if 'data-theme="dark"] .sidebar-panel' in content:
        print(f"Already patched {f}")
        continue
    
    # Insert dark override before closing </style>
    target = '</style>'
    idx = content.find(target)
    if idx == -1:
        print(f"No </style> found in {f}")
        continue
    
    new_content = content[:idx] + dark_inline_override + content[idx:]
    
    with open(f, "w", encoding="utf-8") as file:
        file.write(new_content)
    print(f"Patched inline styles in {f}")
