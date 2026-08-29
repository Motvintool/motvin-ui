import re

# File paths
icons_path = "icons.html"
logos_path = "logos.html"
motvin_js_path = "JS/motvin-icons.js"
logos_js_path = "JS/logos.js"
edit_modal_js_path = "COMPONENT/Edit Modal.js"

# 1. Extract from icons.html
with open(icons_path, 'r', encoding='utf-8') as f:
    icons_content = f.read()

# Pattern to match the detail modal block
# It starts with the comment and ends before the compare modal comment
modal_pattern = re.compile(
    r'(?P<indent>\s*)<!-- =====================================================\s+DETAIL MODAL \(fully preserved\)\s+===================================================== -->\s+<div class="mi-modal" id="detail-modal".*?<!-- =====================================================\s+COMPARE MODAL',
    re.DOTALL
)

match = modal_pattern.search(icons_content)
if not match:
    print("Could not find DETAIL MODAL in icons.html")
    exit(1)

# Extract the modal HTML (excluding the COMPARE MODAL part which we matched to find the end)
# Wait, the regex matched up to COMPARE MODAL. We should use a better pattern.
# Let's find the start index and end index.
start_idx = icons_content.find('  <!-- =====================================================\n       DETAIL MODAL (fully preserved)')
end_idx = icons_content.find('  <!-- =====================================================\n       COMPARE MODAL')

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end indices in icons.html")
    exit(1)

# The HTML block to extract
modal_html = icons_content[start_idx:end_idx]

# Create Edit Modal.js content
edit_modal_js_content = f"""window.EditModalManager = (function() {{
  const modalHTML = `
{modal_html.strip()}
  `;

  function init() {{
    if (!document.getElementById('detail-modal')) {{
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }}
  }}

  return {{ init }};
}})();
"""

with open(edit_modal_js_path, 'w', encoding='utf-8') as f:
    f.write(edit_modal_js_content)
print(f"Created {edit_modal_js_path}")

# 2. Replace in icons.html
new_icons_content = icons_content[:start_idx] + '  <script src="COMPONENT/Edit Modal.js"></script>\n\n' + icons_content[end_idx:]
with open(icons_path, 'w', encoding='utf-8') as f:
    f.write(new_icons_content)
print(f"Updated {icons_path}")

# 3. Replace in logos.html
with open(logos_path, 'r', encoding='utf-8') as f:
    logos_content = f.read()

start_idx_logos = logos_content.find('  <!-- =====================================================\n       DETAIL MODAL')
end_idx_logos = logos_content.find('  <!-- =====================================================\n       COMPARE MODAL')

if start_idx_logos != -1 and end_idx_logos != -1:
    new_logos_content = logos_content[:start_idx_logos] + '  <script src="COMPONENT/Edit Modal.js"></script>\n\n' + logos_content[end_idx_logos:]
    with open(logos_path, 'w', encoding='utf-8') as f:
        f.write(new_logos_content)
    print(f"Updated {logos_path}")
else:
    print("Could not find DETAIL MODAL in logos.html")

# 4. Modify JS/motvin-icons.js
with open(motvin_js_path, 'r', encoding='utf-8') as f:
    motvin_js_content = f.read()

if 'window.EditModalManager.init();' not in motvin_js_content:
    motvin_js_content = motvin_js_content.replace(
        'window.CollectionManager.init(',
        'window.EditModalManager.init();\n  window.CollectionManager.init('
    )
    with open(motvin_js_path, 'w', encoding='utf-8') as f:
        f.write(motvin_js_content)
    print(f"Updated {motvin_js_path}")

# 5. Modify JS/logos.js
with open(logos_js_path, 'r', encoding='utf-8') as f:
    logos_js_content = f.read()

if 'window.EditModalManager.init();' not in logos_js_content:
    logos_js_content = logos_js_content.replace(
        'window.CollectionManager.init(',
        'window.EditModalManager.init();\n  window.CollectionManager.init('
    )
    with open(logos_js_path, 'w', encoding='utf-8') as f:
        f.write(logos_js_content)
    print(f"Updated {logos_js_path}")

