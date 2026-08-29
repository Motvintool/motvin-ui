import re
import os

def process_line(line):
    # Skip CSS variable definitions
    if re.search(r'^\s*--', line):
        return line
        
    is_color = bool(re.search(r'(?i)^\s*(color|fill|stroke)\s*:', line))
    is_bg = bool(re.search(r'(?i)^\s*(background|background-color)\s*:', line))
    is_border = bool(re.search(r'(?i)^\s*(border|border-color|border-bottom|border-top|border-left|border-right)\s*:', line))
    
    def repl(m):
        hex_val = m.group(1).lower()
        if hex_val in ['#fff', '#ffffff']:
            if is_color: return 'var(--text-white)'
            if is_bg: return 'var(--bg-sidebar)'
            if is_border: return 'var(--border-color)'
            return 'var(--bg-sidebar)' # default fallback
        if hex_val == '#edf2f6': return 'var(--bg-app)'
        if hex_val == '#0f172a': return 'var(--text-main)'
        if hex_val == '#64748b': return 'var(--text-secondary)'
        if hex_val == '#94a3b8': return 'var(--text-muted)'
        if hex_val == '#e2e8f0': return 'var(--border-color)'
        return m.group(0) # unchanged

    # Regex to match # followed by exactly 3 or 6 hex digits, NOT followed by another hex digit
    # We must also ensure it's not preceded by a hex digit (to avoid matching the end of an 8-char hex)
    return re.sub(r'(?<![0-9a-fA-F])(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})(?![0-9a-fA-F])', repl, line)

for f in ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]:
    if not os.path.exists(f):
        continue
    
    with open(f, "r", encoding="utf-8") as file:
        lines = file.readlines()
        
    new_lines = [process_line(line) for line in lines]
    
    if new_lines != lines:
        with open(f, "w", encoding="utf-8") as file:
            file.writelines(new_lines)
        print(f"Refactored colors in {f}")
    else:
        print(f"No changes in {f}")
