import re
import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

def find_missing(file_path):
    with open(file_path, "r") as f:
        content = f.read()
    
    inputs = [
        ".url-text-input",
        ".dimension-input",
        ".command-palette-input",
        ".sp-search-input",
        ".typeface-font-picker__search",
        ".history-search-input"
    ]
    
    scrollbars = [
        "::-webkit-scrollbar",
        "::-webkit-scrollbar-thumb",
        "::-webkit-scrollbar-track"
    ]
    
    modals = [
        ".history-popup",
        ".command-palette-modal"
    ]
    
    print(f"\\n--- Auditing {file_path} ---")
    for item in inputs + scrollbars + modals:
        pattern = r':root\[data-theme="dark"\].*?' + re.escape(item)
        if re.search(pattern, content, re.MULTILINE):
            print(f"[OK] Dark mode covers {item}")
        else:
            print(f"[MISSING] {item} lacks direct dark mode overrides")

for f in files:
    if os.path.exists(f):
        find_missing(f)

