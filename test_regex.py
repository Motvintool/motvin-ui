import re

lines = [
    "  background: #fff;",
    "  color: #fff;",
    "  border: 1px solid #e2e8f0;",
    "  background: linear-gradient(90deg, #fff, #ffffff);",
    "  background: #ffffff94;",
    "  fill: #0f172a;"
]

def process_line(line):
    # Match hex codes exactly (3 or 6 chars) not followed by hex chars
    # We use a function to replace depending on the property context
    
    # Check property type
    is_color = bool(re.search(r'(?i)^\s*(color|fill|stroke)\s*:', line))
    is_bg = bool(re.search(r'(?i)^\s*(background|background-color)\s*:', line))
    is_border = bool(re.search(r'(?i)^\s*(border|border-color|border-bottom|border-top|border-left|border-right)\s*:', line))
    
    def repl(m):
        hex_val = m.group(1).lower()
        if hex_val in ['#fff', '#ffffff']:
            if is_color: return 'var(--text-white)'
            if is_bg: return 'var(--bg-sidebar)'
            if is_border: return 'var(--bg-sidebar)' # or something else?
            return 'var(--bg-sidebar)' # default fallback
        if hex_val == '#edf2f6': return 'var(--bg-app)'
        if hex_val == '#0f172a': return 'var(--text-main)'
        if hex_val == '#64748b': return 'var(--text-secondary)'
        if hex_val == '#94a3b8': return 'var(--text-muted)'
        if hex_val == '#e2e8f0': return 'var(--border-color)'
        return m.group(0) # unchanged

    # Regex to match # followed by exactly 3 or 6 hex digits, NOT followed by another hex digit
    return re.sub(r'(#[0-9a-fA-F]{3,6})(?![0-9a-fA-F])', repl, line)

for line in lines:
    print(process_line(line))
