import sys

script_to_inject = """
    <script>
      if (window.location.search.includes('embedded=true')) {
        document.write('<style>.sidebar.sidebar-left, .sidebar-panel.sidebar-two-col { width: 100% !important; max-width: none !important; flex: 1 !important; }</style>');
      }
    </script>
"""

for filepath in ['MOTVIN/styles.html', 'MOTVIN/typeface.html']:
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the exact insertion point (right after <meta http-equiv="X-UA-Compatible" content="IE=edge" />)
    target = '<meta http-equiv="X-UA-Compatible" content="IE=edge" />'
    
    if target in content and script_to_inject not in content:
        new_content = content.replace(target, target + '\n' + script_to_inject, 1)
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Injected script into {filepath}")
    else:
        print(f"Target not found or already injected in {filepath}")

