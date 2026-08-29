import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css = """
/* Explicitly style toolbarAddMenu and toolbarAlignMenu exactly like btn-dropdown */
:root[data-theme="dark"] #toolbarAddMenu,
:root[data-theme="dark"] #toolbarAlignMenu {
    background: #1e1e1e !important;
    border: 1px solid #343434 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 10px rgba(0, 0, 0, 0.3), 3px 0 20px rgba(0, 0, 0, 0.12) !important;
    padding: 8px !important;
    gap: 8px !important;
    display: flex;
    flex-direction: column;
}

/* Ensure text inside them defaults to white */
:root[data-theme="dark"] #toolbarAddMenu > *,
:root[data-theme="dark"] #toolbarAlignMenu > * {
    color: #ffffff !important;
}
"""

for f in files:
    if os.path.exists(f):
        with open(f, "a") as file:
            file.write("\n" + css)
        print(f"Injected menu styling into {f}")

