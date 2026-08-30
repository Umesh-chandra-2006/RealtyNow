import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // This batch job mutates user_packages (expiring them) and inserts
    // renewal notifications using the service key. It must never be callable
    // by anonymous clients. Guard it with a shared secret that the scheduler
    // presents in the x-cron-secret header. If INTERNAL_CRON_SECRET is not
    // configured, refuse to run rather than silently exposing the endpoint.
    const cronSecret = Deno.env.get('INTERNAL_CRON_SECRET');
    if (!cronSecret) {
      console.error('process-renewals: INTERNAL_CRON_SECRET is not configured; refusing to run');
      return new Response(JSON.stringify({ error: 'Server not configured for scheduled processing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      });
    }
    const presented = req.headers.get('x-cron-secret') ?? '';
    const a = presented.trim();
    const b = cronSecret.trim();
    // Constant-time-ish compare
    if (a.length !== b.length || a.split('').some((ch, i) => ch !== b[i])) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch active packages
    const { data: packages, error: pkgsError } = await supabaseClient
      .from('user_packages')
      .select('id, user_id, package_id, expiry_date, auto_renew')
      .eq('status', 'active');

    if (pkgsError) throw pkgsError;

    // 2. Fetch active discount campaigns mapped to days_before_expiry
    const { data: campaigns, error: campsError } = await supabaseClient
      .from('discount_campaigns')
      .select('*')
      .eq('is_active', true)
      .not('days_before_expiry', 'is', null);

    if (campsError) throw campsError;

    const campaignsByDay = new Map(
      (campaigns || []).map((c) => [c.days_before_expiry, c])
    );

    let processedCount = 0;
    const now = new Date();

    for (const pkg of packages || []) {
      const expiry = new Date(pkg.expiry_date);
      const diffMs = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // A) Handle Expiry
      if (diffDays <= 0) {
        if (pkg.auto_renew) {
           // Theoretically call Stripe/Razorpay subscription API here
        } else {
          // Expire package
          await supabaseClient
            .from('user_packages')
            .update({ status: 'expired' })
            .eq('id', pkg.id);

          // Generate notification
          await supabaseClient.from('renewal_notifications').insert({
            user_id: pkg.user_id,
            package_id: pkg.package_id,
            user_package_id: pkg.id,
            notification_type: 'expired',
            status: 'pending',
            metadata: { message: 'Your package has expired. Listings are no longer prioritized.' }
          });
          processedCount++;
        }
        continue;
      }

      // B) Handle Reminders & Discounts
      const campaign = campaignsByDay.get(diffDays);
      if ([30, 15, 10, 7, 5, 3, 1].includes(diffDays)) {
        let message = `Your package expires in ${diffDays} days.`;
        let notification_type = 'reminder';

        if (campaign) {
           notification_type = 'discount_offer';
           const discountText = campaign.discount_type === 'percentage' 
             ? `${campaign.percentage}% OFF` 
             : `₹${campaign.flat_amount} OFF`;
           message += ` Renew today and get ${discountText}. Use code: ${campaign.coupon_code}`;
        } else if (diffDays === 1) {
           message = `Final reminder! Your package expires tomorrow.`;
        }

        // Insert notification
        await supabaseClient.from('renewal_notifications').insert({
          user_id: pkg.user_id,
          package_id: pkg.package_id,
          user_package_id: pkg.id,
          notification_type: notification_type,
          status: 'pending',
          metadata: { message, days_remaining: diffDays, coupon_code: campaign?.coupon_code }
        });
        processedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
