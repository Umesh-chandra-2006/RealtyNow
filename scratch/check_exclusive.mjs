import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jbopkeanshuetjjqofef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3BrZWFuc2h1ZXRqanFvZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDkzNDQsImV4cCI6MjEwMTMyNTM0NH0.iZlUhrUfkvn4fNAfQegUvIaygGTI6Q8UZkIr1ycr3e4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: paidCamps } = await supabase.from('paid_campaigns').select('*, paid_campaign_items(*)').eq('campaign_type', 'REALTYNOW_EXCLUSIVE');
  console.log('REALTYNOW_EXCLUSIVE paid_campaigns:', paidCamps?.length);

  const { data: exProps } = await supabase.from('cms_exclusive_properties').select('*');
  console.log('cms_exclusive_properties:', exProps?.length);

  const { data: luxuryProps } = await supabase.from('properties').select('id, title, price, is_luxury, is_featured, is_live, status, cities(name), localities(name)').eq('is_luxury', true);
  console.log('is_luxury properties:', luxuryProps?.length);
  for (const p of luxuryProps || []) {
    console.log(`- ${p.title} | ${p.cities?.name} | Price: ${p.price}`);
  }
}

check();
