import os

filepath = "MOTVIN/componet/toast-notification/toast-notification.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Check if already patched
if 'host-context' in content:
    print("Already patched")
    exit(0)

dark_styles = """
                /* ─── Dark theme overrides ─── */
                :host-context([data-theme="dark"]) .toast-container {
                    background-color: #383838;
                    border-color: #464646;
                    box-shadow: 0px 20px 25px -5px rgba(0, 0, 0, 0.25), 0px 8px 10px -6px rgba(0, 0, 0, 0.25);
                }
                :host-context([data-theme="dark"]) .title {
                    color: #ffffff;
                }
                :host-context([data-theme="dark"]) .message {
                    color: #b9b9b9;
                }
                :host-context([data-theme="dark"]) .close-btn:hover {
                    background-color: #464646;
                }
"""

# Insert before </style>
target = '</style>'
idx = content.find(target)
if idx == -1:
    print("Could not find </style>")
    exit(1)

new_content = content[:idx] + dark_styles + '            ' + content[idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Patched toast notification component")
