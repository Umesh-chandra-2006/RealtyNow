import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.agents'].includes(file)) {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = walk('e:/Realtynow_new/src');
console.log(`Searching across ${allFiles.length} source files...`);

const keywords = [
  'mock',
  'dummy',
  'sample',
  'fake',
  'seed',
  '10,000+',
  '5,000+',
  '15,000+',
  '25,000+',
  '50,000+'
];

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const kw of keywords) {
      if (line.toLowerCase().includes(kw) && !line.includes('// test') && !line.includes('eslint')) {
        const rel = path.relative('e:/Realtynow_new', f);
        console.log(`[${rel}:${idx+1}] (${kw}): ${line.trim().slice(0, 140)}`);
        break;
      }
    }
  });
}
