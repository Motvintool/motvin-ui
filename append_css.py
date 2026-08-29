import sys

with open('/Users/surendar-15488/.gemini/antigravity-ide/brain/53736d5d-a2d1-4367-9cef-aa224fe0f3da/scratch/new-modal.css', 'r') as f:
    css_content = f.read()

with open('CSS/motvin-icons.css', 'a') as f:
    f.write('\n' + css_content + '\n')
