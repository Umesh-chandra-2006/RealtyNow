import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jbopkeanshuetjjqofef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3BrZWFuc2h1ZXRqanFvZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDkzNDQsImV4cCI6MjEwMTMyNTM0NH0.iZlUhrUfkvn4fNAfQegUvIaygGTI6Q8UZkIr1ycr3e4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: exProps } = await supabase.from('cms_exclusive_properties').select('*');
  console.log('cms_exclusive_properties:', JSON.stringify(exProps, null, 2));
}

check();
