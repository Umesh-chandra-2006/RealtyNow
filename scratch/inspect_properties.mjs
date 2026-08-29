import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const { data: allProps, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching properties:', error);
    return;
  }

  console.log(`Total properties in DB: ${allProps.length}`);
  
  const statusCounts = {};
  allProps.forEach(p => {
    const s = `status:${p.status} (is_live:${p.is_live}, approval_status:${p.approval_status})`;
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.log('Status breakdown:', JSON.stringify(statusCounts, null, 2));

  console.log('\nList of properties:');
  allProps.forEach((p, i) => {
    console.log(`${i+1}. [${p.id}] "${p.title}" | Status: ${p.status} | Live: ${p.is_live} | Price: ${p.price}`);
  });
}

inspect();
