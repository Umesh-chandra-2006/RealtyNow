const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const enLocales = path.join(srcDir, 'locales', 'en');
const hiLocales = path.join(srcDir, 'locales', 'hi');

function getLocales(langPath) {
  const data = {};
  if (fs.existsSync(langPath)) {
    for (const file of fs.readdirSync(langPath)) {
      if (file.endsWith('.json')) {
        const ns = file.replace('.json', '');
        data[ns] = JSON.parse(fs.readFileSync(path.join(langPath, file), 'utf-8'));
      }
    }
  }
  return data;
}

const enData = getLocales(enLocales);
const hiData = getLocales(hiLocales);

const regex = /t\((['"])(.*?)\1\s*,\s*(['"])(.*?)\3\)/g;

function walk(dir, callback) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walk(full, callback);
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      callback(full);
    }
  }
}

let addedEn = 0;
let addedHi = 0;

walk(srcDir, (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const keyPath = match[2];
    const defaultText = match[4];

    if (keyPath.includes('*') || keyPath.includes('`') || keyPath.includes('$')) continue;

    let ns = 'common';
    let key = keyPath;

    if (keyPath.includes('.')) {
      const parts = keyPath.split('.');
      ns = parts[0];
      key = parts.slice(1).join('.');
    } else if (keyPath.includes(':')) {
      const parts = keyPath.split(':');
      ns = parts[0];
      key = parts.slice(1).join(':');
    }

    if (!ns.match(/^[a-z0-9_-]+$/i)) continue;

    if (!enData[ns]) enData[ns] = {};
    if (!hiData[ns]) hiData[ns] = {};

    if (enData[ns][key] === undefined) {
      enData[ns][key] = defaultText;
      addedEn++;
    }

    if (hiData[ns][key] === undefined) {
      hiData[ns][key] = '[HI] ' + defaultText;
      addedHi++;
    }
  }
});

function saveLocales(langPath, data) {
  if (!fs.existsSync(langPath)) fs.mkdirSync(langPath, { recursive: true });
  for (const [ns, obj] of Object.entries(data)) {
    fs.writeFileSync(path.join(langPath, `${ns}.json`), JSON.stringify(obj, null, 2), 'utf-8');
  }
}

saveLocales(enLocales, enData);
saveLocales(hiLocales, hiData);

console.log(`Extraction complete. Added ${addedEn} English keys and ${addedHi} Hindi keys.`);
