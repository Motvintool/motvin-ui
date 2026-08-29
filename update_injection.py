import sys

old_script = """
    <script>
      if (window.location.search.includes('embedded=true')) {
        document.write('<style>.sidebar.sidebar-left, .sidebar-panel.sidebar-two-col { width: 100% !important; max-width: none !important; flex: 1 !important; }</style>');
      }
    </script>
"""

new_script = """
    <script>
      if (window.location.search.includes('embedded=true')) {
        document.write('<style>html, body, .app-container, .sidebar.sidebar-left, .sidebar-panel.sidebar-two-col, .explorer-content { width: 100% !important; max-width: none !important; flex: 1 !important; } .sidebar-panel.sidebar-two-col { display: grid !important; grid-template-columns: auto 1fr !important; }</style>');
      }
    </script>
"""

for filepath in ['MOTVIN/styles.html', 'MOTVIN/typeface.html']:
    with open(filepath, 'r') as f:
        content = f.read()
    
    if old_script in content:
        content = content.replace(old_script, new_script)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
    elif new_script in content:
        print(f"Already updated {filepath}")
    else:
        print(f"Could not find old script in {filepath}")

