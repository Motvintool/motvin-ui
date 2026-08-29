import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    # Replace #35343D with a darker/reduced version #2a2931
    new_content = content.replace(
        "background-color: #35343D !important;",
        "background-color: #2a2931 !important;"
    )
    
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Reduced active background color in {f}")
    else:
        print(f"No changes made to {f}")
