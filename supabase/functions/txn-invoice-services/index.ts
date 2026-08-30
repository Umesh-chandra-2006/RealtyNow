import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sendEmail } from "../_shared/email.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200, req?: Request) {
  const cors = req ? getCorsHeaders(req) : {};
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function error(message: string, status = 400, req?: Request) {
  return json({ error: message, success: false }, status, req);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

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
    if (!RAZORPAY_WEBHOOK_SECRET) return error("Webhook secret missing", 500, req);

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return error("Signature missing", 401, req);

    const bodyText = await req.text();
    const expectedSig = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(bodyText)
      .digest("hex");

    if (expectedSig !== signature) return error("Invalid signature", 401, req);

    let event;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return error("Invalid JSON", 400, req);
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
        return json({ success: false, message: 'No matching payment row' }, 404, req);
      }

      if (paymentRecord.status === 'success') {
        // Already confirmed — idempotent replay, no double-processing.
        return json({ success: true, message: 'Webhook processed (already confirmed)' }, 200, req);
      }

      if (Math.abs(Number(paymentRecord.amount) - Number(capturedAmount)) > 0.01) {
        console.error(
          'txn webhook: amount mismatch. expected',
          paymentRecord.amount,
          'captured',
          capturedAmount
        );
        return json({ success: false, message: 'Amount mismatch — webhook rejected' }, 400, req);
      }

      const { error: updateErr } = await supabase
        .from('txn_payments')
        .update({ status: 'success', transaction_id: paymentId, paid_date: new Date().toISOString() })
        .eq('id', paymentRecord.id);

      if (updateErr) {
        console.error('txn webhook: failed to update payment', updateErr);
        return json({ success: false, message: 'Update failed' }, 500, req);
      }

      if (paymentRecord.invoice_id) {
        await supabase
          .from('txn_invoices')
          .update({ payment_status: 'paid', invoice_status: 'issued' })
          .eq('id', paymentRecord.invoice_id);
      }
    }

    return json({ success: true, message: "Webhook processed" }, 200, req);
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
      headers: { ...getCorsHeaders(req), ...rate.headers, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Authentication required", 401, req);
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return error("Authentication invalid", 401, req);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (action === "send-whatsapp") {
    // No server-side WhatsApp provider is wired up yet. Return an explicit
    // "not configured" failure rather than a fake success, so callers surface
    // the real state instead of believing an invoice was delivered.
    return json({ success: false, message: "WhatsApp not configured" }, 501, req);
  }

  if (action === "send-email") {
    const { email, customer_name, invoice_no, pdf_url } = body;
    if (!email) return error("email is required", 400, req);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b61f24;">RealtyNow Invoice</h2>
        ${customer_name ? `<p>Hello ${escapeHtml(customer_name)},</p>` : "<p>Hello,</p>"}
        <p>Your invoice <strong>${escapeHtml(invoice_no || "-")}</strong> has been generated.</p>
        ${pdf_url ? `<p>Download: <a href="${escapeHtml(pdf_url)}">View invoice</a></p>` : ""}
        <p>Thank you for choosing RealtyNow.</p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Your RealtyNow Invoice ${invoice_no || ""}`.trim(),
      html,
    });

    if (!result.ok) {
      if (result.notConfigured) {
        return json({ success: false, message: "Email not configured" }, 501, req);
      }
      console.error("txn send-email: provider error", result);
      return json({ success: false, message: `Email send failed: ${result.error}` }, 502, req);
    }

    return json({ success: true, message: "Email dispatched successfully", id: result.id });
  }

  return error(`Unknown action: ${action}`, 400, req);
});

/** Minimal HTML-escape for values interpolated into email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
