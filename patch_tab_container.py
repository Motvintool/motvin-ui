import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Increase tab-container contrast (darker/higher opacity feel) in dark mode */
:root[data-theme="dark"] .tab-container {
    background: rgba(0, 0, 0, 0.4) !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
}

/* Add smooth tab switch animation for the active state */
.tab-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Applied tab container styles in {filepath}")

