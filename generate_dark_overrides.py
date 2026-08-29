#!/usr/bin/env python3
"""
Generate comprehensive dark-theme CSS overrides for MOTVIN CSS files.

Strategy:
- Parse each CSS file to find rule-blocks that use hardcoded light-mode colors.
- For each such rule, emit a :root[data-theme="dark"] <selector> override
  that maps light colours → dark equivalents.
- The overrides are APPENDED at the end of each file so the original light
  theme is completely untouched.
"""

import re, os, sys

# ── Colour mapping tables ──────────────────────────────────────────────

BG_MAP = {
    '#fff':       '#383838',
    '#ffffff':    '#383838',
    '#f8fafc':    '#343434',
    '#f5f3ff':    '#3b3a58',
    '#f3f4f6':    '#343434',
    '#f1f5f9':    '#2e2e2e',
    '#edf2f6':    '#2e2e2e',
    '#eef2ff':    '#2e3350',
    '#e5e7eb':    '#464646',
    '#e6e6e6':    '#464646',
    '#e5e5e5':    '#464646',
    '#e7e7e7':    '#424242',
    '#eee':       '#3a3a3a',
    '#eeeeee':    '#3a3a3a',
    '#f0f0f0':    '#3a3a3a',
    '#f7f7fb':    '#2e2e3e',
    '#ecfdf3':    '#1a3329',
    '#f3fcf6':    '#1a3329',
    '#cbd5e1':    '#555555',
    '#d8dff7':    '#3b4470',
    '#ddd':       '#464646',
    '#dddddd':    '#464646',
}

TEXT_MAP = {
    '#000':       '#ffffff',
    '#000000':    '#ffffff',
    '#111':       '#ffffff',
    '#111111':    '#ffffff',
    '#111827':    '#e0e0e0',
    '#0f172a':    '#e0e0e0',
    '#172033':    '#e0e0e0',
    '#1f2937':    '#d0d0d0',
    '#243146':    '#c0c0c0',
    '#2e3a63':    '#c0c0c0',
    '#2f3cb5':    '#a0a8ff',
    '#334155':    '#b9b9b9',
    '#374151':    '#b9b9b9',
    '#34435e':    '#a0b0c8',
    '#455065':    '#a0aabb',
    '#475569':    '#9a9a9a',
    '#4f46bf':    '#a8a0ff',
    '#5448c7':    '#b0a8ff',
    '#5c4ae4':    '#9d8aff',
    '#5f6368':    '#9a9a9a',
    '#616161':    '#9a9a9a',
    '#64748b':    '#9a9a9a',
    '#6b7280':    '#888888',
    '#6e6e73':    '#9a9a9a',
    '#7a7a7a':    '#888888',
    '#7b4cff':    '#b89cff',
    '#7c6cff':    '#a89cff',
    '#193541':    '#c0dddd',
    '#9ca3af':    '#787878',
    '#969696':    '#787878',
    '#b88e8d':    '#d4b0af',
    '#d9b5a9':    '#e8c8bc',
    '#15803d':    '#4ade80',
}

BORDER_MAP = {
    '#e5e7eb':    '#464646',
    '#e2e8f0':    '#464646',
    '#d1d5db':    '#555555',
    '#d8dff7':    '#3b4470',
    '#c4cff9':    '#4a5580',
    '#cbd5e1':    '#555555',
    '#ccd8ff':    '#4a5580',
    '#c8d0dd':    '#555555',
    '#bdbdbd':    '#666666',
    '#f1f5f9':    '#3a3a3a',
    '#ddd':       '#464646',
    '#dddddd':    '#464646',
}

SHADOW_MAP = {
    '#0f172a':    '#000000',
    '#1f2a44':    '#000000',
}

# Accent colours that should remain unchanged
ACCENT_KEEP = {
    '#4647d3', '#5c4ae4', '#9396ff', '#008ff0',
    '#a6a7ff', '#6c46ff', '#7b4cff', '#7c6cff',
    '#22c55e', '#4ade80', '#15803d',
    '#6369d1', '#a9efef', '#d9d4e6', '#bc8f91',
    '#d7fffa',
}

GRADIENT_OVERRIDES = {
    'linear-gradient(180deg, #f6f8fc, var(--bg-app))':
        'linear-gradient(180deg, #343434, var(--bg-app))',
    'linear-gradient(152deg, #fffffff0, #ffffffe0)':
        'linear-gradient(152deg, #38383890, #38383870)',
    'linear-gradient(180deg, #f3fcf6, #ecfdf3)':
        'linear-gradient(180deg, #1a3329, #1e3b2e)',
    'linear-gradient(180deg, #f8fafc, #f1f5f9)':
        'linear-gradient(180deg, #343434, #2e2e2e)',
    'linear-gradient(90deg, #00000014, #0000)':
        'linear-gradient(90deg, #ffffff0a, #0000)',
}


def parse_css_blocks(content):
    """Parse a CSS file into a list of (selector, declarations_text, start_line)."""
    blocks = []
    i = 0
    length = len(content)
    line = 1

    while i < length:
        while i < length and content[i] in ' \t\n\r':
            if content[i] == '\n': line += 1
            i += 1

        if i >= length: break

        if content[i:i+2] == '/*':
            end = content.find('*/', i + 2)
            if end == -1: break
            line += content[i:end+2].count('\n')
            i = end + 2
            continue

        sel_start = i
        sel_line = line

        while i < length and content[i] != '{':
            if content[i] == '\n': line += 1
            i += 1

        if i >= length: break

        selector = content[sel_start:i].strip()

        if selector.startswith('@import') or selector.startswith('@charset'):
            while i < length and content[i] != ';':
                if content[i] == '\n': line += 1
                i += 1
            i += 1
            continue

        if selector.startswith('@'):
            brace_depth = 0
            while i < length:
                if content[i] == '{': brace_depth += 1
                elif content[i] == '}':
                    brace_depth -= 1
                    if brace_depth == 0:
                        i += 1
                        break
                if content[i] == '\n': line += 1
                i += 1
            continue

        i += 1
        brace_depth = 1
        block_start = i

        while i < length and brace_depth > 0:
            if content[i] == '{': brace_depth += 1
            elif content[i] == '}': brace_depth -= 1
            if content[i] == '\n': line += 1
            i += 1

        block_content = content[block_start:i-1]
        blocks.append((selector, block_content, sel_line))

    return blocks


def parse_declarations(block_text):
    """Parse a CSS block body into a list of (property, value) tuples."""
    decls = []
    parts = block_text.split(';')
    for part in parts:
        part = part.strip()
        if ':' not in part: continue
        colon = part.index(':')
        prop = part[:colon].strip()
        val = part[colon+1:].strip()
        if prop and val:
            decls.append((prop, val))
    return decls


def needs_dark_override(prop, val):
    """Check if a declaration has a hardcoded colour that needs override."""
    val_lower = val.lower()
    if '#' not in val_lower and 'rgb' not in val_lower:
        return False
    if prop.strip().startswith('--'):
        return False

    hexes = re.findall(r'#[0-9a-fA-F]{3,8}', val)
    if not hexes:
        return False

    has_relevant = False
    for h in hexes:
        h_lower = h.lower()
        if h_lower in ACCENT_KEEP:
            continue
        # Check if the hex (without alpha) is in any of our maps
        if len(h) == 9:  # #rrggbbaa
            base = h_lower[:7]
        elif len(h) == 5:  # #rgba (expand)
            base = '#' + h_lower[1]*2 + h_lower[2]*2 + h_lower[3]*2
        elif len(h) == 4:
            base = '#' + h_lower[1]*2 + h_lower[2]*2 + h_lower[3]*2
        else:
            base = h_lower

        if (base in BG_MAP or base in TEXT_MAP or base in BORDER_MAP or
            base in SHADOW_MAP):
            has_relevant = True
            break

    return has_relevant


def generate_dark_value(prop, val):
    """Generate the dark-mode version of a CSS value."""
    prop_lower = prop.lower().strip()

    is_color_prop = prop_lower in ('color', 'fill', 'stroke', '-webkit-text-fill-color')
    is_bg_prop = prop_lower in ('background', 'background-color', 'background-image')
    is_border_prop = 'border' in prop_lower
    is_shadow_prop = 'shadow' in prop_lower
    is_outline_prop = 'outline' in prop_lower

    result = val

    for light_grad, dark_grad in GRADIENT_OVERRIDES.items():
        if light_grad in result:
            result = result.replace(light_grad, dark_grad)

    def replace_hex(match):
        h = match.group(0).lower()
        h_len = len(h)

        if h in ACCENT_KEEP:
            return match.group(0)

        # For 8-char hex (#rrggbbaa)
        if h_len == 9:
            base = h[:7]
            alpha = h[7:]
            if is_bg_prop and base in BG_MAP:
                return BG_MAP[base] + alpha
            elif is_color_prop and base in TEXT_MAP:
                return TEXT_MAP[base] + alpha
            elif is_border_prop and base in BORDER_MAP:
                return BORDER_MAP[base] + alpha
            elif is_shadow_prop and base in SHADOW_MAP:
                return SHADOW_MAP[base] + alpha
            elif base in BG_MAP:
                return BG_MAP[base] + alpha
            elif base in TEXT_MAP:
                return TEXT_MAP[base] + alpha
            return match.group(0)

        # Expand 3-char hex
        if h_len == 4:
            expanded = '#' + h[1]*2 + h[2]*2 + h[3]*2
        else:
            expanded = h

        if is_color_prop:
            if expanded in TEXT_MAP: return TEXT_MAP[expanded]
        elif is_bg_prop:
            if expanded in BG_MAP: return BG_MAP[expanded]
            elif expanded in TEXT_MAP: return TEXT_MAP[expanded]
        elif is_border_prop:
            if expanded in BORDER_MAP: return BORDER_MAP[expanded]
            elif expanded in BG_MAP: return BG_MAP[expanded]
        elif is_shadow_prop:
            if expanded in SHADOW_MAP: return SHADOW_MAP[expanded]
        elif is_outline_prop:
            if expanded in BORDER_MAP: return BORDER_MAP[expanded]
        else:
            for m in [BG_MAP, TEXT_MAP, BORDER_MAP]:
                if expanded in m: return m[expanded]

        return match.group(0)

    result = re.sub(r'#[0-9a-fA-F]{3,8}', replace_hex, result)

    # Handle rgba() patterns
    result = result.replace('rgba(0, 0, 0, 0.05)', 'rgba(255, 255, 255, 0.05)')
    result = result.replace('rgba(0, 0, 0, 0.06)', 'rgba(255, 255, 255, 0.06)')
    result = result.replace('rgba(0, 0, 0, 0.08)', 'rgba(255, 255, 255, 0.06)')
    result = result.replace('rgba(15, 23, 42, 0.12)', 'rgba(0, 0, 0, 0.3)')
    result = result.replace('rgba(15, 23, 42, 0.14)', 'rgba(0, 0, 0, 0.3)')

    if result != val:
        return result
    return None


def process_file(filepath):
    """Process a single CSS file and append dark overrides."""
    print(f"\n{'='*60}")
    print(f"Processing: {filepath}")
    print(f"{'='*60}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    blocks = parse_css_blocks(content)
    print(f"  Found {len(blocks)} CSS rule blocks")

    overrides = []
    processed_selectors = set()

    for selector, block_text, line_num in blocks:
        if selector.strip() == ':root' or 'data-theme' in selector:
            continue

        decls = parse_declarations(block_text)
        dark_decls = []

        for prop, val in decls:
            if needs_dark_override(prop, val):
                dark_val = generate_dark_value(prop, val)
                if dark_val:
                    dark_decls.append((prop, dark_val))

        if dark_decls:
            sel = selector.strip()
            if sel in processed_selectors:
                continue
            processed_selectors.add(sel)

            parts = sel.split(',')
            dark_parts = []
            for part in parts:
                part = part.strip()
                dark_parts.append(f':root[data-theme="dark"] {part}')

            dark_selector = ',\n'.join(dark_parts)
            decl_text = '\n'.join(f'  {p}: {v};' for p, v in dark_decls)
            override_block = f'{dark_selector} {{\n{decl_text}\n}}'
            overrides.append(override_block)

    if overrides:
        override_section = '\n\n/* ═══════════════════════════════════════════════════════════\n'
        override_section += '   DARK THEME OVERRIDES (auto-generated)\n'
        override_section += '   ═══════════════════════════════════════════════════════════ */\n\n'
        override_section += '\n\n'.join(overrides)
        override_section += '\n'

        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(override_section)

        print(f"  ✅ Appended {len(overrides)} dark override blocks")
    else:
        print(f"  ℹ️  No overrides needed")

    return len(overrides)


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    files = [
        os.path.join(base, 'MOTVIN', 'css', 'styles.css'),
        os.path.join(base, 'MOTVIN', 'css', 'typeface.css'),
        os.path.join(base, 'MOTVIN', 'css', 'main.css'),
    ]

    total = 0
    for f in files:
        total += process_file(f)

    print(f"\n{'='*60}")
    print(f"TOTAL: {total} dark override blocks generated across {len(files)} files")
    print(f"{'='*60}")
