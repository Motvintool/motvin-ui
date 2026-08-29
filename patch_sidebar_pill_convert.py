import os

filepath = "MOTVIN/css/main.css"

css = """
/* Fix toggle pill background */
:root[data-theme="dark"] .sidebar-panel-toggle-pill {
    background: #ffffff1a !important;
}

/* Force convertButton to look exactly like light mode */
:root[data-theme="dark"] #convertButton {
    background: linear-gradient(170.2deg, #4647d3, #9396ff) !important;
    color: #ffffff !important;
}

:root[data-theme="dark"] #convertButton.ready {
    background: #0a0a0a !important;
    color: #ffffff !important;
}

/* Prevent any accidental inversions on its icon */
:root[data-theme="dark"] #convertButton img {
    filter: none !important;
}
"""

if os.path.exists(filepath):
    with open(filepath, "a") as file:
        file.write("\n" + css)
    print("Injected fixes for toggle pill and convert button.")

