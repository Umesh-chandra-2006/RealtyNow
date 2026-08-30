import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env manually
const envPath = path.resolve(process.cwd(), '.env');
const envStr = fs.readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envStr.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...val] = line.split('=');
      return [key.trim(), val.join('=').trim().replace(/^"|"$/g, '')];
    })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPaymentGateway() {
  try {
    console.log("1. Authenticating as demo user...");
    // Create a temporary user
    const email = `test-agent-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: "TestPassword123!"
    });
    
    if (authError) throw new Error("SignUp Error: " + authError.message);
    console.log(`User created and logged in: ${email}`);

    // Update profile to be an agent
    const userId = authData.user?.id;
    if (userId) {
       await supabase.from('profiles').update({ role: 'agent' }).eq('id', userId);
    }

    console.log("2. Fetching available packages...");
    const { data: packages, error: pkgError } = await supabase
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .limit(1);
      
    if (pkgError) throw new Error("Package Error: " + pkgError.message);
    if (!packages || packages.length === 0) throw new Error("No active packages found in the database.");
    
    const packageId = packages[0].id;
    console.log(`Found package: ${packages[0].name} (${packageId})`);

    console.log("3. Calling payment-gateway Edge Function (create-order)...");
    
    // We get the session token to authenticate the edge function call
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data: orderData, error: orderError } = await supabase.functions.invoke('payment-gateway', {
      headers: {
        'x-action': 'create-order',
      },
      body: {
        package_id: packageId,
        billing_cycle: 'monthly',
        payment_type: 'upfront',
        discount_pct: 0
      },
    });
    
    if (orderError) {
      console.error("Edge Function Error Details:", orderError);
      throw new Error("Edge Function Error: " + orderError.message);
    }
    
    console.log("Edge Function Response:");
    console.log(JSON.stringify(orderData, null, 2));
    
    if (orderData.success && orderData.razorpay_order_id) {
       console.log("✅ SUCCESS! The payment-gateway successfully communicated with Razorpay and generated an order ID.");
    } else {
       console.log("❌ FAILED. Response did not contain a successful razorpay_order_id.");
    }

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testPaymentGateway();
