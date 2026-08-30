// supabase/functions/payment-gateway/index.ts
// Enterprise Payment Gateway Edge Function
// Handles: create-order, verify-payment, generate-invoice, refund

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function error(message: string, status = 400) {
  return json({ error: message, success: false }, status);
}

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const rate = await checkRateLimit(supabase, req, {
    endpoint: "payment-gateway",
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", success: false }), {
      status: rate.status,
      headers: { ...corsHeaders, ...rate.headers, "Content-Type": "application/json" },
    });
  }

  const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

  // Get authenticated user
  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    userId = user?.id ?? null;
  }
  if (!userId) return error("Authentication required", 401);

  const action = req.headers.get("x-action") || "";
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  // ─── ACTION: create-order ─────────────────────────────────────
  if (action === "create-order") {
    const { package_id, billing_cycle, payment_type, coupon_code } = body;
    if (!package_id) return error("package_id is required");

    // Fetch package
    const { data: pkg } = await supabase.from("packages").select("*").eq("id", package_id).eq("is_active", true).single();
    if (!pkg) return error("Package not found or inactive", 404);

    const basePrice = billing_cycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;

    // SECURITY (audit finding): the client previously supplied discount_pct
    // directly, letting anyone grant themselves a 100% discount. Discounts are
    // now derived ONLY from a server-validated coupon. The raw client value is
    // ignored entirely — never trust a price-affecting field from the browser.
    let discountAmt = 0;
    let appliedCampaignId: string | null = null;
    if (coupon_code && typeof coupon_code === "string" && coupon_code.trim()) {
      const code = coupon_code.trim();
      const { data: campaign, error: campErr } = await supabase
        .from("discount_campaigns")
        .select("id, discount_type, percentage, flat_amount, valid_from, valid_to, is_active, min_purchase, max_discount")
        .eq("coupon_code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!campErr && campaign) {
        const now = Date.now();
        const validFrom = campaign.valid_from ? new Date(campaign.valid_from).getTime() : -Infinity;
        const validTo = campaign.valid_to ? new Date(campaign.valid_to).getTime() : Infinity;
        if (now >= validFrom && now <= validTo && (!campaign.min_purchase || basePrice >= campaign.min_purchase)) {
          if (campaign.discount_type === "percentage") {
            const raw = basePrice * (Number(campaign.percentage) / 100);
            discountAmt = campaign.max_discount ? Math.min(raw, campaign.max_discount) : raw;
          } else {
            discountAmt = Math.min(campaign.flat_amount ?? 0, basePrice);
          }
          appliedCampaignId = campaign.id;
        } else {
          return error("Coupon code is not currently valid");
        }
      } else {
        return error("Invalid coupon code");
      }
    }
    discountAmt = Math.round(Math.max(0, Number(discountAmt)) * 100) / 100;
    const subtotal     = basePrice - discountAmt;
    const taxAmount    = Math.round(subtotal * 0.18 * 100) / 100;
    const totalAmount  = Math.round((subtotal + taxAmount) * 100) / 100;

    // Create internal payment record and invoice
    const { data: paymentData, error: payErr } = await supabase.rpc("fn_create_payment_and_invoice", {
      p_user_id:       userId,
      p_package_id:    package_id,
      p_amount:        basePrice,
      p_payment_type:  payment_type || "upfront",
      p_billing_cycle: billing_cycle || "monthly",
      p_gateway:       "razorpay",
      p_discount_pct:  0,
      p_discount_amount: discountAmt,
      p_coupon_id:     appliedCampaignId,
    });
    if (payErr) return error(payErr.message, 500);

    // Create Razorpay order
    let razorpayOrderId = `order_mock_${Date.now()}`; // Fallback for dev
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      try {
        const rzResponse = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          },
          body: JSON.stringify({
            amount: Math.round(totalAmount * 100), // paise
            currency: "INR",
            receipt: paymentData.invoice_number,
            notes: { payment_id: paymentData.payment_id, user_id: userId }
          })
        });
        const rzOrder = await rzResponse.json();
        if (rzOrder.id) {
          razorpayOrderId = rzOrder.id;
          // Update payment with gateway order ID
          await supabase.from("payments").update({ gateway_order_id: razorpayOrderId }).eq("id", paymentData.payment_id);
        }
      } catch (e) {
        console.error("Razorpay order creation failed:", e);
      }
    }

    return json({
      success: true,
      payment_id: paymentData.payment_id,
      invoice_id: paymentData.invoice_id,
      invoice_number: paymentData.invoice_number,
      agent_package_id: paymentData.agent_package_id,
      razorpay_order_id: razorpayOrderId,
      razorpay_key_id: RAZORPAY_KEY_ID,
      amount: totalAmount,
      currency: "INR",
      breakdown: { subtotal, tax: taxAmount, discount: discountAmt, total: totalAmount }
    });
  }

  // ─── ACTION: verify-payment ───────────────────────────────────
  if (action === "verify-payment") {
    const { payment_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;
    if (!payment_id || !razorpay_payment_id) return error("payment_id and razorpay_payment_id required");

    // Ownership + replay guard: the payment must belong to the caller, still
    // be pending (fn_confirm_payment is not otherwise idempotent-safe against
    // re-confirming an already-paid/refunded row), and — critically — the
    // order id supplied here must match the one this edge function itself
    // generated for THIS payment in create-order. Without this check, a
    // validly-signed Razorpay response for a caller's OWN small/legitimate
    // order could be replayed against a different (e.g. someone else's,
    // larger) payment_id, since the HMAC signature only binds
    // razorpay_order_id|razorpay_payment_id, not our internal payment_id.
    const { data: paymentRow, error: fetchErr } = await supabase
      .from("payments")
      .select("id, user_id, status, gateway_order_id, amount")
      .eq("id", payment_id)
      .maybeSingle();
    if (fetchErr || !paymentRow) return error("Payment not found", 404);
    if (paymentRow.user_id !== userId) return error("Payment does not belong to this account", 403);
    if (paymentRow.status !== "pending") return error("Payment is not in a confirmable state", 409);
    if (razorpay_order_id && paymentRow.gateway_order_id && paymentRow.gateway_order_id !== razorpay_order_id) {
      return error("Order mismatch — this signature does not correspond to this payment", 400);
    }

    // Verify Razorpay signature — mandatory whenever the gateway secret is
    // configured (i.e. always in production). Previously this was skipped
    // entirely whenever the caller simply omitted razorpay_order_id/
    // razorpay_signature, letting anyone confirm any pending payment for
    // free without ever touching Razorpay.
    if (RAZORPAY_KEY_SECRET) {
      if (!razorpay_order_id || !razorpay_signature) {
        return error("razorpay_order_id and razorpay_signature are required", 400);
      }
      const expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSig !== razorpay_signature) {
        await supabase.rpc("fn_log_audit", {
          p_action: "payment_signature_mismatch",
          p_entity: "payments",
          p_entity_id: payment_id as string,
          p_severity: "critical"
        });
        return error("Payment signature verification failed", 400);
      }
    }

    // Confirm payment in DB
    const { data, error: confirmErr } = await supabase.rpc("fn_confirm_payment", {
      p_payment_id:         payment_id,
      p_gateway_payment_id: razorpay_payment_id,
      p_gateway_order_id:   razorpay_order_id,
      p_gateway_signature:  razorpay_signature
    });
    if (confirmErr) return error(confirmErr.message, 500);

    // Log audit
    await supabase.rpc("fn_log_audit", {
      p_action: "payment_confirmed",
      p_entity: "payments",
      p_entity_id: payment_id as string,
      p_metadata: { razorpay_payment_id, amount: body.amount },
      p_severity: "info"
    });

    return json({ success: true, data });
  }

  // ─── ACTION: generate-invoice ─────────────────────────────────
  if (action === "generate-invoice") {
    const { invoice_id } = body;
    if (!invoice_id) return error("invoice_id is required");

    const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoice_id).eq("user_id", userId).single();
    if (!inv) return error("Invoice not found or access denied", 404);

    // In production, this would call a PDF generation service
    // For now, return the structured invoice data
    const { data: userProfile } = await supabase.from("profiles").select("first_name, last_name, email, phone").eq("id", userId).single();

    return json({
      success: true,
      invoice: {
        ...inv,
        billing_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : "Customer",
        billing_email: userProfile?.email,
        company_name: "RealtyNow India Pvt. Ltd.",
        company_gst: "GSTINXXXXXX",
        company_address: "123, Tech Hub, Hyderabad, Telangana - 500032",
        download_url: `/portal/invoices/${invoice_id}`
      }
    });
  }

  // ─── ACTION: subscription-activate ────────────────────────────
  // Server-verified subscription activation. The browser previously called the
  // `activate_subscription_payment` RPC directly with a self-supplied amount,
  // letting anyone grant themselves a plan (see 0141/0145). Here the amount is
  // always recomputed from the plan server-side, the Razorpay signature is
  // verified (mandatory for paid plans), and only then is the service-role
  // activation RPC invoked. The caller's identity (userId) comes from the JWT
  // verified at the top of this handler.
  if (action === "subscription-activate") {
    const { plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!plan_id) return error("plan_id is required");
    if (!userId) return error("Proxy authentication required", 401);

    // Fetch the plan and compute the amount server-side — NEVER trust a
    // client-supplied amount.
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) return error("Plan not found or inactive", 404);

    const basePrice = Number(plan.price || 0);
    const expectedAmount = Math.round(basePrice * 1.18 * 100) / 100; // incl. 18% GST

    // Paid plans require a verified Razorpay transaction.
    if (basePrice > 0) {
      if (!RAZORPAY_KEY_SECRET) return error("Razorpay gateway not configured", 500);
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return error("razorpay_order_id, razorpay_payment_id and razorpay_signature are required", 400);
      }
      const expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (expectedSig !== razorpay_signature) {
        await supabase.rpc("fn_log_audit", {
          p_action: "subscription_signature_mismatch",
          p_entity: "subscription_plans",
          p_entity_id: plan_id as string,
          p_severity: "critical",
        });
        return error("Payment signature verification failed", 400);
      }
    }

    const { data: subscriptionId, error: activateErr } = await supabase.rpc(
      "activate_subscription_payment",
      {
        p_customer_id: userId,
        p_plan_id: plan_id,
        p_amount: expectedAmount,
        p_gateway: basePrice > 0 ? "Razorpay" : "Free",
        p_gateway_order_id: razorpay_order_id || `free_${Date.now()}`,
        p_gateway_payment_id: razorpay_payment_id || `pay_${Date.now()}`,
      }
    );
    if (activateErr) {
      await supabase.rpc("fn_log_audit", {
        p_action: "subscription_activation_failed",
        p_entity: "subscription_plans",
        p_entity_id: plan_id as string,
        p_metadata: { error: activateErr.message },
        p_severity: "warning",
      });
      return error(activateErr.message, 500);
    }

    return json({ success: true, subscription_id: subscriptionId, plan_id, amount: expectedAmount });
  }

  return error("Unknown action. Use x-action: create-order | verify-payment | generate-invoice | subscription-activate", 400);
});
