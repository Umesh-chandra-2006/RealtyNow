import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jbopkeanshuetjjqofef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3BrZWFuc2h1ZXRqanFvZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDkzNDQsImV4cCI6MjEwMTMyNTM0NH0.iZlUhrUfkvn4fNAfQegUvIaygGTI6Q8UZkIr1ycr3e4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Checking hero_campaigns ---');
  const { data: heroCampaigns, error: hcError } = await supabase.from('hero_campaigns').select('*');
  console.log('hero_campaigns count:', heroCampaigns?.length, 'error:', hcError?.message);
  if (heroCampaigns?.length) {
    console.log('hero_campaigns items:', JSON.stringify(heroCampaigns, null, 2));
  }

  console.log('\n--- Checking cms_hero ---');
  const { data: cmsHero, error: chError } = await supabase.from('cms_hero').select('*');
  console.log('cms_hero count:', cmsHero?.length, 'error:', chError?.message);
  if (cmsHero?.length) {
    console.log('cms_hero items:', JSON.stringify(cmsHero, null, 2));
  }

  console.log('\n--- Checking advertisements (Hero placement) ---');
  const { data: ads, error: adsError } = await supabase.from('advertisements').select('*').eq('placement', 'Hero');
  console.log('Hero ads count:', ads?.length, 'error:', adsError?.message);
  if (ads?.length) {
    console.log('Hero ads:', JSON.stringify(ads, null, 2));
  }
}

main().catch(console.error);
