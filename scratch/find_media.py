import re

with open('d:/ABC/app/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Find all @media blocks
media_blocks = re.findall(r'@media\s*[^{]*\{', css)
print("Found media queries:")
for mb in media_blocks:
    print(mb)

# Print specific queries related to site-header or logo
print("\n--- Site header media query rules ---")
matches = [m.start() for m in re.finditer(r'site-header|logo', css)]
for m in matches:
    start = max(0, m - 100)
    end = min(len(css), m + 150)
    print(f"Context: {css[start:end]}\n")
