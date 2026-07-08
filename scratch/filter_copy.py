with open('d:/ABC/scratch/strings.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

copywriting_strings = []
for line in lines:
    line = line.strip()
    # Check if string has spaces, letters, length > 40, and doesn't look like code/regex/svg
    if len(line) > 30 and ' ' in line and not line.startswith('M') and not line.startswith('d=') and not line.startswith('relative') and not line.startswith('w-') and not 'instance' in line and not 'function' in line and not '{' in line and not 'class' in line:
        copywriting_strings.append(line)

copywriting_strings = list(set(copywriting_strings))
copywriting_strings.sort(key=len)

with open('d:/ABC/scratch/copywriting.txt', 'w', encoding='utf-8') as f:
    for s in copywriting_strings:
        f.write(s + '\n')

print(f"Extracted {len(copywriting_strings)} copywriting strings to d:/ABC/scratch/copywriting.txt")
