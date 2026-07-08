import re

with open('d:/ABC/app/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Find occurrences of logo, site-header, phone-screen, chat-window, visibility, display: none
queries = ['.logo', '.site-header', 'visibility', 'display: none', 'hidden']
for q in queries:
    print(f"\n--- Searching for: {q} ---")
    matches = [m.start() for m in re.finditer(re.escape(q), css)]
    for m in matches:
        start = max(0, m - 100)
        end = min(len(css), m + 150)
        print(f"Context (pos {m}): {css[start:end]}\n")
