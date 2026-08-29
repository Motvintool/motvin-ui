import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/typeface.css", "MOTVIN/css/main.css"]

for f in files:
    if not os.path.exists(f): continue
    with open(f, "r") as file:
        content = file.read()
    
    # Replace the older active background we set earlier
    new_content = content.replace(
        "background-color: #4b4958 !important;",
        "background-color: #35343D !important;"
    )
    
    if new_content != content:
        with open(f, "w") as file:
            file.write(new_content)
        print(f"Updated active background color in {f}")
    else:
        print(f"No changes made to {f}")
