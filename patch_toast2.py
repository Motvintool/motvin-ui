import os

def patch_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace the previously injected block:
    search_str = """          if (!navigator.onLine && state === "success" && (message.includes("Saved") || title.includes("Saved"))) {
            title = "You are offline";
            message = "Saved locally. Cannot sync to cloud until you reconnect.";
            state = "error";
          }"""

    replacement = """          if (!navigator.onLine && state === "success" && (message.includes("Saved") || title.includes("Saved"))) {
            // Keep the existing title (Styles/Typeface)
            message = "Saved offline";
            state = "warning";
          }"""

    if search_str in content:
        content = content.replace(search_str, replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")
    else:
        print(f"Could not find target block in {filepath}")

patch_file("MOTVIN/styles.html")
patch_file("MOTVIN/typeface.html")
