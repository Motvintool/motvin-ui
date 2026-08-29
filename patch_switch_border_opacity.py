import os

filepath = "MOTVIN/css/typeface.css"

if os.path.exists(filepath):
    with open(filepath, "r") as file:
        content = file.read()
    
    # Increase visibility (lightness) of the border since 464646 was too dark
    new_content = content.replace(
        "border-color: #464646 !important;",
        "border-color: #5c5c5c !important;"
    )
    
    if new_content != content:
        with open(filepath, "w") as file:
            file.write(new_content)
        print(f"Updated border visibility in {filepath}")
    else:
        print(f"No changes made to {filepath}")
