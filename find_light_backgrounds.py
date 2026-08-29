import re
import os

filepath = "MOTVIN/css/styles.css"
if not os.path.exists(filepath):
    print("File not found")
    exit()

with open(filepath, "r") as f:
    content = f.read()

# Very basic CSS parser to find blocks with white backgrounds
# This regex looks for selector { ... background: #fff/white; ... }
block_pattern = re.compile(r'([^{]+)\{[^}]*background(?:-color)?\s*:\s*(?:#fff(?:fff)?|white)[^a-z0-9][^}]*\}', re.IGNORECASE)

blocks = block_pattern.findall(content)
missing_overrides = []

for block in blocks:
    # Clean up the selector
    selector = block.strip().split(',')[-1].strip() # just take the last part of a multi-selector
    
    # Check if this selector has a dark mode override anywhere in the file
    dark_pattern = r':root\[data-theme="dark"\].*?' + re.escape(selector)
    if not re.search(dark_pattern, content, re.MULTILINE):
        missing_overrides.append(selector)

print("Selectors with light backgrounds that might lack dark mode overrides:")
for m in set(missing_overrides):
    # Only print interesting ones
    if not m.startswith('@') and not "::" in m and not ":root" in m:
        print(f" - {m}")

