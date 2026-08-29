import sys

with open('icons.html', 'r') as f:
    text = f.read()

# Fix PNG dropdown
text = text.replace(
    '<button id="btn-png-size">512px</button>',
    '<button id="btn-png-size"><span id="png-size-label">512px</span></button>'
)
text = text.replace(
    '<button data-png="512">512px</button>',
    '<button data-png="512" class="mi-dd-item">512px</button>'
)
text = text.replace(
    '<button data-png="256">256px</button>',
    '<button data-png="256" class="mi-dd-item">256px</button>'
)

# Fix Copy JSX dropdown
text = text.replace(
    '<button class="mi-new-btn-white-border" id="btn-copy-jsx">Copy JSX</button>',
    '<button class="mi-new-btn-white-border" id="btn-copy-fmt"><span id="copy-fmt-label">Copy JSX</span></button>\n                 <button id="btn-copy-jsx" style="display:none;"></button>'
)
text = text.replace(
    '<button data-fmt="svg">SVG</button>',
    '<button data-fmt="svg" class="mi-dd-item">SVG</button>'
)
text = text.replace(
    '<button data-fmt="jsx">JSX</button>',
    '<button data-fmt="jsx" class="mi-dd-item">JSX</button>'
)

with open('icons.html', 'w') as f:
    f.write(text)
