import os

files = ["MOTVIN/css/main.css", "MOTVIN/css/history-popup.css"]

css = """
/* Remove active background color for history popup tabs */
:root[data-theme="dark"] .history-popup-tab.active {
    background: transparent !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Removed active bg from tabs in {f}")

