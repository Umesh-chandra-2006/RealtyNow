import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-action",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function error(message: string, status = 400) {
  return json({ error: message, success: false }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const action = req.headers.get("x-action") || "unknown";

  // =========================================================
  // RAZORPAY WEBHOOK (UNAUTHENTICATED, SECURED VIA HMAC)
  // =========================================================
  if (action === "payment-webhook") {
    const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!RAZORPAY_WEBHOOK_SECRET) return error("Webhook secret missing", 500);

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return error("Signature missing", 401);

    const bodyText = await req.text();
    const expectedSig = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(bodyText)
      .digest("hex");

    if (expectedSig !== signature) return error("Invalid signature", 401);

    let event;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return error("Invalid JSON", 400);
    }

    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      const capturedAmount = event.payload.payment.entity.amount / 100; // paise -> rupees

      // Look up the payment row we created BEFORE this webhook could fire.
      // We must verify the captured amount matches the order amount exactly —
      // the HMAC signature proves Razorpay sent the event, but a signed event
      // must not be allowed to flush a DIFFERENT (e.g. larger, already-paid)
      // row, or mark success for an underpayment/overpayment.
      const { data: paymentRecord, error: fetchErr } = await supabase
        .from('txn_payments')
        .select('id, invoice_id, amount, status')
        .eq('gateway', orderId)
        .maybeSingle();

      if (fetchErr || !paymentRecord) {
        console.error('txn webhook: no matching txn_payments row for order', orderId);
        return json({ success: false, message: 'No matching payment row' }, 404);
      }

      if (paymentRecord.status === 'success') {
        // Already confirmed — idempotent replay, no double-processing.
        return json({ success: true, message: 'Webhook processed (already confirmed)' });
      }

      if (Math.abs(Number(paymentRecord.amount) - Number(capturedAmount)) > 0.01) {
        console.error(
          'txn webhook: amount mismatch. expected',
          paymentRecord.amount,
          'captured',
          capturedAmount
        );
        return json({ success: false, message: 'Amount mismatch — webhook rejected' }, 400);
      }

      const { error: updateErr } = await supabase
        .from('txn_payments')
        .update({ status: 'success', transaction_id: paymentId, paid_date: new Date().toISOString() })
        .eq('id', paymentRecord.id);

      if (updateErr) {
        console.error('txn webhook: failed to update payment', updateErr);
        return json({ success: false, message: 'Update failed' }, 500);
      }

      if (paymentRecord.invoice_id) {
        await supabase
          .from('txn_invoices')
          .update({ payment_status: 'paid', invoice_status: 'issued' })
          .eq('id', paymentRecord.invoice_id);
      }
    }

    return json({ success: true, message: "Webhook processed" });
  }

  // =========================================================
  // AUTHENTICATED ACTIONS (REQUIRE USER JWT)
  // =========================================================
  const rate = await checkRateLimit(supabase, req, {
    endpoint: "txn-invoice-services",
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", success: false }), {
      status: rate.status,
      headers: { ...corsHeaders, ...rate.headers, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Authentication required", 401);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return error("Authentication invalid", 401);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (action === "send-whatsapp") {
    const { customer_name, invoice_no, amount, pdf_url } = body;
    // Simulate WhatsApp API Call (e.g. Twilio, Meta)
    console.log(`[WhatsApp Simulation] To: ${customer_name}`);
    console.log(`Hello ${customer_name}, Your invoice has been generated.\nInvoice No: ${invoice_no}\nAmount: ₹${amount}\nDownload Here: ${pdf_url}\nRegards, RealtyNow`);
    
    return json({ success: true, message: "WhatsApp message dispatched successfully" });
  }

  if (action === "send-email") {
    const { email, customer_name, invoice_no, pdf_url } = body;
    // Simulate Email API Call (e.g. Resend, Sendgrid)
    console.log(`[Email Simulation] To: ${email} | Subj: Invoice ${invoice_no}`);
    console.log(`Sending PDF link: ${pdf_url}`);
    
    return json({ success: true, message: "Email dispatched successfully" });
  }

  return error(`Unknown action: ${action}`);
});
