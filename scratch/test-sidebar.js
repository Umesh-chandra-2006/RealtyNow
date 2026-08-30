import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  // Create an auth token in localStorage to bypass login
  await page.goto('http://localhost:5174/');
  await page.evaluate(() => {
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: {
        access_token: 'fake',
        user: { id: '123', role: 'customer' }
      }
    }));
  });
  
  // Not sure if fake token works because it might get verified. 
  // Let's just navigate there directly, maybe it's accessible or we can just see if it crashes before auth redirect.
  
  console.log('Navigating to my-properties...');
  await page.goto('http://localhost:5174/portal/my-properties', { waitUntil: 'networkidle0' });
  
  console.log('Clicking List Property in sidebar...');
  // Find the sidebar link for List Property
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const listProp = links.find(a => a.textContent && a.textContent.includes('List Property'));
    if (listProp) {
      console.log('Found link, clicking:', listProp.href);
      listProp.click();
    } else {
      console.log('Link not found');
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
}

test().catch(console.error);
