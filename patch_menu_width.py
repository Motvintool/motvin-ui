import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Reduce width of the toolbar dropdowns */
#toolbarAddMenu,
#toolbarAlignMenu {
    width: max-content !important;
    min-width: 130px !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Updated width in {filepath}")

