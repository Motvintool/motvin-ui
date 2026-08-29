import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

css_append = """
/* Force exact width of 150px as requested */
#toolbarAddMenu,
#toolbarAlignMenu {
    width: 150px !important;
    min-width: 150px !important;
}
"""

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
            
        with open(filepath, "w") as file:
            file.write(content + "\n" + css_append)
        print(f"Set exact width 150px in {filepath}")

