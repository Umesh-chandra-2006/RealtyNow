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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = walk('e:/Realtynow_new/src');

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (
      line.match(/(total|verified|active|published|available)\s*(properties|projects|listings)/i) ||
      line.match(/(\d+[\d,]*\+?\s*(properties|projects|listings))/i) ||
      line.match(/count.*properties/i) ||
      line.match(/properties.*count/i)
    ) {
      const rel = path.relative('e:/Realtynow_new', f);
      console.log(`[${rel}:${idx+1}] ${line.trim().slice(0, 130)}`);
    }
  });
}
