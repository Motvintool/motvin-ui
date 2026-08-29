import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    new_content = content.replace(
        "background-color: #373641 !important;",
        "background-color: #4b4958 !important;"
    )
    
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Updated toolbar icon active background in {f}")
    else:
        print(f"No changes made to {f}")
