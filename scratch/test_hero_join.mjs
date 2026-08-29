import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jbopkeanshuetjjqofef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3BrZWFuc2h1ZXRqanFvZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDkzNDQsImV4cCI6MjEwMTMyNTM0NH0.iZlUhrUfkvn4fNAfQegUvIaygGTI6Q8UZkIr1ycr3e4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('hero_campaigns')
    .select('*, properties(id, title, price, cities(name), localities(name))')
    .order('priority', { ascending: false });

  console.log('Error:', error);
  console.log('Fetched campaigns:', data?.length);
  for (const c of data || []) {
    console.log(`- [${c.status}] ${c.title} (Priority ${c.priority}) | Image: ${c.banner_image?.substring(0, 50)}... | Prop: ${c.properties?.title}`);
  }
}

test();
