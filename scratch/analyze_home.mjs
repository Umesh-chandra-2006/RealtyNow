import fs from 'fs';

const content = fs.readFileSync('e:/Realtynow_new/src/pages/public/home.tsx', 'utf-8');
const lines = content.split('\n');

console.log('--- Components / Functions in home.tsx ---');
lines.forEach((line, idx) => {
  if (line.match(/^function\s+[A-Za-z0-9_]+/)) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});

console.log('\n--- Hardcoded numbers / metrics in home.tsx ---');
lines.forEach((line, idx) => {
  if (line.match(/\d+[\d,]*\+?(\s*(Properties|Projects|Users|Listings|Agents|Builders|Cities|Sq\.Ft))/i)) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});
