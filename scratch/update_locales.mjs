import fs from 'fs';
import path from 'path';

const localesDir = 'e:/Realtynow_new/src/locales';
const languages = fs.readdirSync(localesDir);

for (const lang of languages) {
  const homeJsonPath = path.join(localesDir, lang, 'home.json');
  if (fs.existsSync(homeJsonPath)) {
    let content = fs.readFileSync(homeJsonPath, 'utf-8');
    let modified = false;
    
    if (content.includes('10,000+')) {
      content = content.replace(/"trustedUsers":\s*"[^"]*"/, '"trustedUsers": "Trusted Verified Platform"');
      content = content.replace(/"kamKakaDesc":\s*"[^"]*"/, '"kamKakaDesc": "Pan-India network of verified professionals"');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(homeJsonPath, content, 'utf-8');
      console.log(`Updated ${homeJsonPath}`);
    }
  }
}
