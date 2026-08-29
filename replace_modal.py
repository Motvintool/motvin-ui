import sys

with open('icons.html', 'r') as f:
    lines = f.readlines()

with open('/Users/surendar-15488/.gemini/antigravity-ide/brain/53736d5d-a2d1-4367-9cef-aa224fe0f3da/scratch/new-modal.html', 'r') as f:
    modal_content = f.read()

# Lines 404 to 725 (0-indexed 403 to 725)
start_idx = 403
end_idx = 725

new_lines = lines[:start_idx] + [modal_content + '\n'] + lines[end_idx:]

with open('icons.html', 'w') as f:
    f.writelines(new_lines)
