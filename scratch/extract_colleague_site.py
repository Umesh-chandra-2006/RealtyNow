import re
import os

saved_js_path = r"C:\Users\H S R KRISHNA\.gemini\antigravity\brain\7e9fff66-ee7f-4a96-863b-9df1009d8afe\.system_generated\steps\65\content.md"

if not os.path.exists(saved_js_path):
    print(f"File not found: {saved_js_path}")
    exit(1)

with open(saved_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract string literals
strings = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', content)
strings += re.findall(r"'([^'\\]*(?:\\.[^'\\]*)*)'", content)
strings += re.findall(r"`([^`\\]*(?:\\.[^`\\]*)*)`", content)

# Filter strings containing English letters, not CSS/SVG paths, length > 15
interesting_strings = []
for s in strings:
    s = s.strip()
    if len(s) > 15 and re.search(r'[a-zA-Z]', s) and not s.startswith('http') and not s.startswith('M ') and not s.startswith('d="M') and not s.startswith('path/'):
        interesting_strings.append(s)

# De-duplicate and sort by length
interesting_strings = list(set(interesting_strings))
interesting_strings.sort(key=len)

# Save to scratch directory
os.makedirs('d:/ABC/scratch', exist_ok=True)
with open('d:/ABC/scratch/strings.txt', 'w', encoding='utf-8') as f:
    for s in interesting_strings:
        f.write(s + '\n')

print(f"Extracted {len(interesting_strings)} interesting strings to d:/ABC/scratch/strings.txt")
