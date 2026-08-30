// supabase/functions/property-workflow/index.ts
// Enterprise Property Workflow Edge Function
// Handles: create, update, verify, publish, expire, renew, calculate-score

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

  // Get auth context
  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    userId = user?.id ?? null;
  }

  const action = req.headers.get("x-action") || "";
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // calculate-score and expire are deliberately PUBLIC (no auth, no owner
  // check), so they are the abuse-prone surface of this function. Throttle
  // them per-IP; the gated actions (publish/verify/renew) stay user-limited.
  if (action === "calculate-score" || action === "expire") {
    const rate = await checkRateLimit(supabase, req, {
      endpoint: `property-workflow:${action}`,
      maxRequests: 30,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      const respHeaders = new Headers(corsHeaders);
      respHeaders.set("Content-Type", "application/json");
      for (const [k, v] of Object.entries(rate.headers)) respHeaders.set(k, v);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", success: false }),
        { status: 429, headers: respHeaders }
      );
    }
  }

  // ─── ACTION: calculate-score ───────────────────────────────────
  if (action === "calculate-score") {
    const { property_id } = body;
    if (!property_id) return error("property_id is required");

    const { data, error: err } = await supabase.rpc("fn_calculate_property_score", { p_property_id: property_id });
    if (err) return error(err.message, 500);
    return json({ success: true, data });
  }

  // ─── ACTION: publish ──────────────────────────────────────────
  if (action === "publish") {
    const { property_id } = body;
    if (!property_id || !userId) return error("property_id and auth required");

    // Verify user is admin or staff
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (!profile || !["admin", "super_admin", "verification_executive"].includes(profile.role)) {
      return error("Unauthorized: admin access required", 403);
    }

    const { data, error: err } = await supabase.rpc("admin_approve_property", {
      p_property_id: property_id,
      p_admin_id: userId
    });
    if (err) return error(err.message, 500);

    // Calculate score after publish
    await supabase.rpc("fn_calculate_property_score", { p_property_id: property_id });

    return json({ success: true, data });
  }

  // ─── ACTION: verify ───────────────────────────────────────────
  if (action === "verify") {
    const { property_id, status, notes } = body;
    if (!property_id || !userId) return error("property_id and auth required");

    const { data: currentProp } = await supabase
      .from("properties")
      .select("price, rent_amount, purpose, listing_category, price_per_unit")
      .eq("id", property_id)
      .single();

    if (!currentProp) return error("Property not found", 404);

    if (status === "approve") {
      const isRent = ["Rent", "Lease", "PG", "CoLiving", "Hostel", "Short Stay", "Vacation Rental"].includes(currentProp.purpose || "");
      const priceVal = isRent ? currentProp.rent_amount : currentProp.price;
      if (priceVal == null || Number(priceVal) <= 0) {
        return error("This property cannot be approved because the price must be greater than ₹0.");
      }
    }

    const updateData: Record<string, unknown> = {
      verified_by: userId,
      verified_at: new Date().toISOString(),
      verification_notes: notes,
      updated_at: new Date().toISOString()
    };

    if (status === "approve") {
      updateData.status = "approved";
      updateData.approval_status = "Approved";
    } else if (status === "reject") {
      updateData.status = "rejected";
      updateData.approval_status = "Rejected";
      updateData.rejection_reason = notes || "Failed verification";
    } else {
      return error("status must be 'approve' or 'reject'");
    }

    const { error: err } = await supabase.from("properties").update(updateData).eq("id", property_id);
    if (err) return error(err.message, 500);

    // Log audit
    await supabase.rpc("fn_log_audit", {
      p_action: `property_${status}d`,
      p_entity: "properties",
      p_entity_id: property_id,
      p_metadata: { verified_by: userId, notes },
      p_severity: "info"
    });

    return json({ success: true, property_id, status: updateData.status });
  }

  // ─── ACTION: expire ───────────────────────────────────────────
  if (action === "expire") {
    const { data } = await supabase.rpc("fn_expire_stale_listings");
    return json({ success: true, expired_count: data });
  }

  // ─── ACTION: renew ────────────────────────────────────────────
  if (action === "renew") {
    const { property_id, validity_days } = body;
    if (!property_id || !userId) return error("property_id and auth required");

    const validDays = [30, 60, 90, 180, 365];
    if (!validDays.includes(Number(validity_days))) return error("validity_days must be 30, 60, 90, 180, or 365");

    const { data: prop } = await supabase.from("properties").select("owner_id, published_at").eq("id", property_id).single();
    if (!prop) return error("Property not found", 404);
    if (prop.owner_id !== userId) return error("Unauthorized", 403);

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + Number(validity_days));

    const { error: err } = await supabase.from("properties").update({
      listing_validity: validity_days,
      expires_at: newExpiry.toISOString(),
      renewal_count: supabase.rpc("fn_expire_stale_listings"), // increment
      last_renewed_at: new Date().toISOString(),
      status: "published",
      updated_at: new Date().toISOString()
    }).eq("id", property_id).eq("owner_id", userId);

    if (err) return error(err.message, 500);

    return json({ success: true, property_id, new_expiry: newExpiry.toISOString() });
  }

  return error("Unknown action. Use x-action header: calculate-score | publish | verify | expire | renew", 400);
});
