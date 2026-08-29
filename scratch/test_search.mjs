import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, count, error } = await supabase
    .from('v_properties_search')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error fetching v_properties_search:', error);
  } else {
    console.log(`v_properties_search total count: ${count} (items returned: ${data.length})`);
  }
}

test();
