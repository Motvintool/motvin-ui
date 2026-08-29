import os

files = ["MOTVIN/css/styles.css", "MOTVIN/css/main.css", "MOTVIN/css/typeface.css"]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            content = file.read()
        
        # Replace the previous purple color with the new rgb color
        if "#715BF0" in content:
            content = content.replace("#715BF0", "rgb(87, 56, 207)")
            
            with open(filepath, "w") as file:
                file.write(content)
            print(f"Replaced #715BF0 with rgb(87, 56, 207) in {filepath}")
        else:
            print(f"#715BF0 not found in {filepath}")

