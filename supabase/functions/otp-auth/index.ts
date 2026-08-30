// supabase/functions/otp-auth/index.ts
// Mobile OTP authentication (MSG91) — mints a real Supabase Auth session
// after MSG91 confirms OTP verification server-side.
// Actions (via x-action header, matching the payment-gateway convention):
//   verify               — public. Body: { accessToken, intent? }. Verifies
//                           the MSG91 widget access token, finds the profile
//                           by phone, and returns a Supabase session.
//                           intent: 'customer' (default) auto-creates the
//                           account if it doesn't exist yet. intent:
//                           'agent' | 'builder' | 'partner' never
//                           auto-creates and requires an exact role match —
//                           it rejects with a specific code (NOT_FOUND,
//                           PENDING_REVIEW, REJECTED, ROLE_MISMATCH,
//                           ACCOUNT_SUSPENDED) rather than minting a session
//                           for the wrong portal.
//   request-agent-access — public. Body: { accessToken, full_name?,
//                           requested_role? }. Re-verifies the MSG91 access
//                           token and logs a pending row in agent_requests
//                           for an admin to review — used after a 'verify'
//                           call with intent 'agent'/'builder' comes back
//                           NOT_FOUND.
//   review-agent-request  — admin-only. Body: { requestId, decision,
//                           notes? }. Approves or rejects a pending
//                           agent_requests row (decision: 'approved' |
//                           'rejected').
//   admin-provision       — admin-only. Body: { phone, role, first_name, last_name }.
//                           Pre-creates an agent/builder account by phone so they
//                           can log in via OTP afterward with their role intact.
//                           Also marks any matching pending agent_requests row
//                           as 'approved'.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeIndianMobile } from "../_shared/phone.ts";
import { isAuthorizedAdminMobile } from "../_shared/admin-auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function error(message: string, status = 400) {
  return json({ error: message, success: false }, status);
}

type ProfessionalIntent = "agent" | "builder" | "partner";
const PROFESSIONAL_INTENTS: ProfessionalIntent[] = ["agent", "builder", "partner"];
const APPLICATION_TABLE: Record<ProfessionalIntent, string> = {
  agent: "agent_applications",
  builder: "builder_applications",
  partner: "partner_applications",
};
// partner_applications uses `mobile_number`; agent/builder use `phone`.
const APPLICATION_PHONE_COLUMN: Record<ProfessionalIntent, string> = {
  agent: "phone",
  builder: "phone",
  partner: "mobile_number",
};

function randomPassword(): string {
  // Never persisted anywhere — generated fresh, consumed once by
  // signInWithPassword immediately below, then discarded.
  return crypto.randomUUID() + crypto.randomUUID();
}

// Supabase's Phone auth provider stays permanently disabled (MSG91 is the
// only OTP provider — see project instructions), so signInWithPassword
// cannot use `phone` as the identifier: GoTrue rejects any phone-identifier
// grant with "Phone logins are disabled" whenever that provider is off,
// regardless of Twilio/SMS config. Email/password is always-on by default,
// so every account also gets a deterministic, internal-only synthetic email
// (never shown to the user, never emailed) purely so we can mint a session
// via signInWithPassword({ email, password }) instead. This never touches
// profiles.email — the handle_new_user trigger only fires on INSERT, and
// this synthetic address is set via a separate updateUserById call.
function syntheticEmailForMobile(mobile: string): string {
  return `p${mobile}@phone.realtynow.internal`;
}

// Confirms an OTP was actually verified, server-side, using the secret Auth
// Key. Never trust a client-supplied mobile number — take it from MSG91's
// own response. Shared by the `verify` and `request-agent-access` actions.
async function verifyMsg91AccessToken(
  accessToken: string,
  authKey: string,
): Promise<{ mobile: string } | { error: string; status: number }> {
  let msg91Res: Response;
  try {
    msg91Res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
    });
  } catch {
    return { error: "Could not reach MSG91 to verify OTP", status: 502 };
  }
  const msg91Data = await msg91Res.json().catch(() => null);
  if (!msg91Data || msg91Data.type !== "success") {
    return { error: "OTP verification failed or expired", status: 401 };
  }
  const mobile = normalizeIndianMobile(String(msg91Data.message ?? ""));
  if (!mobile) return { error: "MSG91 did not return a valid mobile number", status: 502 };
  return { mobile };
}

// Helper to locate an existing user in profiles or auth.users across all phone variations and formats
async function resolveExistingUser(
  admin: any,
  mobile: string,
): Promise<{ userId?: string; profile?: any }> {
  const last10 = mobile.slice(-10);
  const phoneVariations = [
    mobile,
    `+${mobile}`,
    last10,
    `+91${last10}`,
    `+91 ${last10}`,
    `+91-${last10}`,
    `0${last10}`,
  ];

  // 1. Search profiles table with exact variations
  const { data: profilesByIn } = await admin
    .from("profiles")
    .select("id, role, status, phone, first_name, last_name")
    .in("phone", phoneVariations)
    .limit(1);

  if (profilesByIn && profilesByIn.length > 0) {
    return { userId: profilesByIn[0].id, profile: profilesByIn[0] };
  }

  // 2. Search profiles with fuzzy ilike (%last10%)
  const { data: profilesFuzzy } = await admin
    .from("profiles")
    .select("id, role, status, phone, first_name, last_name")
    .ilike("phone", `%${last10}%`)
    .limit(1);

  if (profilesFuzzy && profilesFuzzy.length > 0) {
    return { userId: profilesFuzzy[0].id, profile: profilesFuzzy[0] };
  }

  const syntheticEmail = syntheticEmailForMobile(mobile);

  // 3. Direct SQL lookup against auth.users (source of truth), via a
  // SECURITY DEFINER RPC — see migration 0111. The listUsers()-based scan
  // below (kept as a fallback) has been observed in production to miss a
  // user that provably existed with an exact matching phone and synthetic
  // email, so this direct query is the primary path.
  try {
    const { data: rpcUserId } = await admin.rpc("find_auth_user_id_by_phone", { p_mobile: mobile });
    if (rpcUserId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, role, status, phone, first_name, last_name")
        .eq("id", rpcUserId)
        .maybeSingle();
      return { userId: rpcUserId, profile: prof ?? null };
    }
  } catch (err) {
    console.warn("find_auth_user_id_by_phone RPC failed:", err);
  }

  // 4. Fallback: search auth.users by phone or synthetic email via the
  // Admin API's user list (kept for resilience; see note above).
  try {
    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (userList?.users) {
      const match = userList.users.find((u: any) => {
        const uPhoneDigits = (u.phone ?? '').replace(/[^\d]/g, '');
        const uMetaDigits = u.user_metadata?.phone ? String(u.user_metadata.phone).replace(/[^\d]/g, '') : '';
        return (
          uPhoneDigits === mobile ||
          uPhoneDigits === `91${last10}` ||
          uPhoneDigits === last10 ||
          u.phone === `+${mobile}` ||
          u.phone === `+91${last10}` ||
          u.email === syntheticEmail ||
          uMetaDigits.endsWith(last10)
        );
      });

      if (match) {
        const { data: prof } = await admin
          .from("profiles")
          .select("id, role, status, phone, first_name, last_name")
          .eq("id", match.id)
          .maybeSingle();

        return { userId: match.id, profile: prof ?? null };
      }
    }
  } catch (err) {
    console.warn("Error listing auth users:", err);
  }

  return {};
}

// createUser() can lose a race against a near-simultaneous verify call for
// the same phone (double-tap, retry-after-timeout, etc.): the loser's
// createUser fails with a phone-conflict, but an immediate resolveExistingUser
// retry can still miss the winner's just-committed row. Retrying the lookup
// a couple more times with a short delay resolves the race instead of
// surfacing Supabase's raw "phone already registered" error to the user.
async function resolveExistingUserWithRetry(
  admin: any,
  mobile: string,
  attempts = 3,
  delayMs = 300,
): Promise<{ userId?: string; profile?: any }> {
  for (let i = 0; i < attempts; i++) {
    const rec = await resolveExistingUser(admin, mobile);
    if (rec.userId) return rec;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return {};
}

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY") ?? "";

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const action = req.headers.get("x-action") || "";
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Per-IP throttling for the PUBLIC, abuse-prone actions. Admin-only actions
  // (review-agent-request, admin-provision) are deliberately NOT IP-limited so
  // a shared office IP cannot lock out admins; they remain user/role-gated.
  const PUBLIC_IP_LIMITS: Record<string, { max: number; window: number }> = {
    "verify": { max: 10, window: 60 },
    "check-admin-mobile": { max: 30, window: 60 },
    "request-agent-access": { max: 10, window: 300 },
  };
  if (PUBLIC_IP_LIMITS[action]) {
    const limits = PUBLIC_IP_LIMITS[action];
    const rate = await checkRateLimit(admin, req, {
      endpoint: `otp-auth:${action}`,
      maxRequests: limits.max,
      windowSeconds: limits.window,
    });
    if (!rate.allowed) {
      const respHeaders = new Headers(corsHeaders);
      respHeaders.set("Content-Type", "application/json");
      for (const [k, v] of Object.entries(rate.headers)) respHeaders.set(k, v);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later.", success: false }),
        { status: 429, headers: respHeaders }
      );
    }
  }

  // ─── ACTION: verify ────────────────────────────────────────────
  // Public — the caller has no session yet, that's the whole point.
  if (action === "verify") {
    const accessToken = body.accessToken as string | undefined;
    const rawIntent = body.intent as string | undefined;
    const intent: "customer" | ProfessionalIntent = PROFESSIONAL_INTENTS.includes(rawIntent as ProfessionalIntent)
      ? (rawIntent as ProfessionalIntent)
      : "customer";
    if (!accessToken) return error("accessToken is required");
    if (!MSG91_AUTH_KEY) return error("MSG91 is not configured on the server", 500);

    const verified = await verifyMsg91AccessToken(accessToken, MSG91_AUTH_KEY);
    if ("error" in verified) return error(verified.error, verified.status);
    const { mobile } = verified;

    // Find an existing profile / user across profiles and auth.users
    const resolved = await resolveExistingUser(admin, mobile);
    let userId = resolved.userId;
    let existingProfile = resolved.profile;
    let isNewUser = false;
    const isAuthorizedAdmin = isAuthorizedAdminMobile(mobile);

    if (isAuthorizedAdmin) {
      // Authorized Admin phone (Manager or Developer):
      if (!userId) {
        const tempPassword = randomPassword();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          phone: mobile,
          phone_confirm: true,
          password: tempPassword,
          user_metadata: { role: "admin" },
        });
        if (createErr || !created?.user) {
          const rec = await resolveExistingUserWithRetry(admin, mobile);
          if (rec.userId) {
            userId = rec.userId;
            existingProfile = rec.profile;
          } else {
            console.error("[otp-auth] admin createUser failed and could not be recovered:", createErr?.message);
            return error("Could not sign in with this mobile number. Please try again in a moment.", 500);
          }
        } else {
          userId = created.user.id;
          isNewUser = true;
        }
      }

      // Ensure profile role is 'admin' and status is 'active'
      await admin
        .from("profiles")
        .upsert(
          {
            id: userId,
            role: "admin",
            status: "active",
            phone: mobile,
            is_mobile_verified: true,
            otp_verified_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      // Ensure corresponding row in admins table
      await admin
        .from("admins")
        .upsert(
          {
            id: userId,
            mobile,
            role: "admin",
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

      // The "ensure profile row exists" upsert further below re-applies
      // `existingProfile?.role || "customer"` unconditionally — without this,
      // a brand-new admin phone (existingProfile still null/stale from the
      // initial lookup above) gets its role upserted to "admin" here, then
      // immediately overwritten back to "customer" by that later step.
      existingProfile = { ...existingProfile, role: "admin", status: "active" };
    } else if (PROFESSIONAL_INTENTS.includes(intent as ProfessionalIntent)) {
      const professionalIntent = intent as ProfessionalIntent;
      // Agent / Builder / Partner tabs: never auto-create, and the
      // account's actual role must exactly match the selected tab — no more
      // sharing one "agent" bucket between agent and builder logins.
      if (!existingProfile) {
        // No account yet. Distinguish "never applied" from "applied but
        // still pending/rejected" by checking that role's own application
        // table, so the UI can show a specific, honest message instead of
        // one generic "not found" for every case.
        const appTable = APPLICATION_TABLE[professionalIntent];
        const phoneColumn = APPLICATION_PHONE_COLUMN[professionalIntent];
        const { data: latestApp } = await admin
          .from(appTable)
          .select("id, status")
          .eq(phoneColumn, mobile)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestApp?.status === "rejected") {
          return json(
            { error: "Your application was not approved. Please contact RealtyNow support for more information.", success: false, code: "REJECTED" },
            403,
          );
        }
        if (latestApp) {
          return json(
            { error: "Your application is still under review. Please wait for admin approval.", success: false, code: "PENDING_REVIEW" },
            403,
          );
        }

        // Agent/Builder keep the existing self-serve "request account
        // access" follow-up (agent_requests). Partner has its own
        // registration form (partner_applications), so there's nothing to
        // request — the caller should just be pointed at registration.
        if (professionalIntent === "agent" || professionalIntent === "builder") {
          const { data: existingRequest } = await admin
            .from("agent_requests")
            .select("id")
            .eq("mobile", mobile)
            .eq("status", "pending")
            .maybeSingle();

          let requestId = existingRequest?.id;
          if (!requestId) {
            const { data: inserted, error: insertErr } = await admin
              .from("agent_requests")
              .insert({ mobile, requested_role: professionalIntent, status: "pending" })
              .select("id")
              .single();
            if (insertErr) { console.error('[otp-auth] insert OTP error:', insertErr); return error('Could not complete request', 500); }
            requestId = inserted?.id;
          }

          return json(
            {
              error: "Your account has not been created yet. Please contact the administrator.",
              success: false,
              code: "NOT_FOUND",
              requestId,
            },
            403,
          );
        }

        return json(
          { error: "No partner application was found for this mobile number. Please register as a partner first.", success: false, code: "NOT_FOUND" },
          403,
        );
      }
      if (existingProfile.role !== professionalIntent) {
        return json(
          {
            error: "This mobile number is registered under a different account type.",
            success: false,
            code: "ROLE_MISMATCH",
            actualRole: existingProfile.role,
          },
          403,
        );
      }
      if (existingProfile.status === "suspended") {
        return json(
          { error: "Your account has been suspended. Please contact RealtyNow support.", success: false, code: "ACCOUNT_SUSPENDED" },
          403,
        );
      }
    } else {
      // Buyer/Owner tab (the default intent whenever it's not admin and not
      // one of the professional intents). This branch previously had no
      // role check at all — an existing agent/builder/admin phone signing in
      // here fell straight through to the "ensure profile row exists" upsert
      // below, which *preserves* whatever role already exists, silently
      // authenticating them under their real role and landing them in the
      // wrong portal instead of telling them to use the right one. Mirror
      // the exact same guard the agent/builder/partner branch above already
      // has, so no account can ever be driven into the wrong portal by
      // picking the wrong login tab.
      if (existingProfile && existingProfile.role !== "customer") {
        return json(
          {
            error: "This mobile number is registered under a different account type.",
            success: false,
            code: "ROLE_MISMATCH",
            actualRole: existingProfile.role,
          },
          403,
        );
      }
      if (existingProfile?.status === "suspended") {
        return json(
          { error: "Your account has been suspended. Please contact RealtyNow support.", success: false, code: "ACCOUNT_SUSPENDED" },
          403,
        );
      }

      if (!userId) {
        const tempPassword = randomPassword();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          phone: mobile,
          phone_confirm: true,
          password: tempPassword,
          user_metadata: { role: "customer" },
        });

        if (createErr) {
          const errMsg = (createErr.message || "").toLowerCase();
          if (
            errMsg.includes("already") ||
            errMsg.includes("registered") ||
            errMsg.includes("exists") ||
            errMsg.includes("duplicate")
          ) {
            // Recover existing auth user seamlessly
            const rec = await resolveExistingUserWithRetry(admin, mobile);
            if (rec.userId) {
              userId = rec.userId;
              existingProfile = rec.profile;
              // The account we just recovered could belong to a
              // non-customer role too — re-check before proceeding.
              if (existingProfile && existingProfile.role !== "customer") {
                return json(
                  {
                    error: "This mobile number is registered under a different account type.",
                    success: false,
                    code: "ROLE_MISMATCH",
                    actualRole: existingProfile.role,
                  },
                  403,
                );
              }
            } else {
              console.error("[otp-auth] customer createUser failed and could not be recovered:", createErr.message);
              return error("Could not sign in with this mobile number. Please try again in a moment.", 400);
            }
          } else {
            console.error('[otp-auth] createUser failed:', createErr);
            return error("Could not create account", 500);
          }
        } else if (created?.user) {
          userId = created.user.id;
          isNewUser = true;
        }
      }
    }

    // Ensure profile row exists in public.profiles with active phone
    const { error: profileUpsertErr } = await admin.from("profiles").upsert(
      {
        id: userId!,
        phone: mobile,
        role: existingProfile?.role || "customer",
        status: existingProfile?.status || "active",
        first_name: existingProfile?.first_name || "User",
        last_name: existingProfile?.last_name || "",
        is_mobile_verified: true,
        otp_verified_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (profileUpsertErr) {
      // Don't dead-end here — the auth user already exists and a session can
      // still be minted below. But this MUST be visible (previously it was
      // swallowed entirely), since a failure here is exactly what leaves an
      // orphaned auth.users row with no matching profiles row.
      console.error("[otp-auth] profiles upsert failed for user", userId, ":", profileUpsertErr.message);
    }

    // Rotate a fresh throwaway password and immediately consume it to mint
    // a real Supabase session (proper access/refresh token pair, auto-
    // refresh works normally — no custom JWT signing needed). Also
    // (re)stamp the synthetic email on every login so accounts created
    // before this fix get backfilled automatically on next sign-in.
    const signInPassword = randomPassword();
    const syntheticEmail = syntheticEmailForMobile(mobile);
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId!, {
      email: syntheticEmail,
      email_confirm: true,
      password: signInPassword,
    });
    if (pwErr) { console.error('[otp-auth] set password error:', pwErr); return error('Could not set password', 500); }

    const plainClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signInData, error: signInErr } = await plainClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: signInPassword,
    });
    if (signInErr || !signInData?.session) {
      console.error('[otp-auth] sign-in error:', signInErr);
      return error("Could not sign in", 500);
    }

    return json({
      success: true,
      isNewUser,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });
  }

  // ─── ACTION: check-admin-mobile ────────────────────────────────
  // Public. Body: { mobile }. Lets the Admin Portal login step reject an
  // unauthorized number BEFORE an OTP is ever requested from MSG91 — real
  // enforcement still happens in `verify` above (which resolves role from
  // profiles regardless of what the client claims), this is purely a
  // pre-send gate so no OTP/SMS is spent on a number that could never pass.
  // Returns only a boolean — never the admin's name, phone, or any other
  // identifying detail, so this can't be used to enumerate who the admin is.
  if (action === "check-admin-mobile") {
    const rawMobile = body.mobile as string | undefined;
    const mobile = rawMobile ? normalizeIndianMobile(rawMobile) : null;
    if (!mobile) return json({ authorized: false });

    // 1. Check centralized list (sole authorized admin number + env vars)
    const isAuthorized = isAuthorizedAdminMobile(mobile);

    // 2. Check if an active admin profile already exists in DB
    const phoneVariations = [mobile, `+${mobile}`, mobile.replace(/^91/, '')];
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .in("phone", phoneVariations)
      .in("role", ["admin", "super_admin"])
      .eq("status", "active")
      .maybeSingle();

    return json({ authorized: isAuthorized || !!adminProfile });
  }

  // ─── ACTION: request-agent-access ──────────────────────────────
  // Public — called after a 'verify' with intent 'agent'/'builder' comes
  // back NOT_FOUND, using the same (already-verified) MSG91 access token.
  if (action === "request-agent-access") {
    const requestId = body.requestId as string | undefined;
    const fullName = (body.full_name as string | undefined)?.trim() || null;
    const requestedRole = body.requested_role === "builder" ? "builder" : "agent";
    if (!requestId) return error("requestId is required");

    const { error: updateErr } = await admin
      .from("agent_requests")
      .update({ full_name: fullName, requested_role: requestedRole })
      .eq("id", requestId);
    if (updateErr) { console.error('[otp-auth] update error:', updateErr); return error('Could not update request', 500); }

    return json({ success: true });
  }

  // ─── ACTION: review-agent-request ──────────────────────────────
  // Admin-only — approve/reject a pending agent_requests row.
  if (action === "review-agent-request") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return error("Authentication required", 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return error("Authentication required", 401);

    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
    if (callerProfile?.role !== "admin") return error("Admin access required", 403);

    const requestId = body.requestId as string | undefined;
    const decision = body.decision as string | undefined;
    if (!requestId || !["approved", "rejected"].includes(decision ?? "")) {
      return error("requestId and decision ('approved' | 'rejected') are required");
    }

    const { error: updateErr } = await admin
      .from("agent_requests")
      .update({
        status: decision,
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        notes: (body.notes as string | undefined) ?? null,
      })
      .eq("id", requestId);
    if (updateErr) { console.error('[otp-auth] update error:', updateErr); return error('Could not update request', 500); }

    return json({ success: true });
  }

  // ─── ACTION: admin-provision ───────────────────────────────────
  // Admin-only — pre-creates an agent/builder/admin account by phone.
  // Exception: an unauthenticated call is allowed ONLY to provision the
  // very first admin/super_admin account (zero profiles rows currently
  // have that role) — a one-time, self-closing bootstrap so the admin
  // portal isn't a chicken-and-egg problem. The instant one admin exists,
  // this branch permanently stops firing and every future call requires a
  // real authenticated admin caller.
  if (action === "admin-provision") {
    const phoneRaw = body.phone as string | undefined;
    const role = body.role as string | undefined;
    const firstName = body.first_name as string | undefined;
    const lastName = body.last_name as string | undefined;

    if (!phoneRaw || !role || !["agent", "builder", "admin", "super_admin"].includes(role)) {
      return error("phone and role ('agent' | 'builder' | 'admin' | 'super_admin') are required");
    }

    const authHeader = req.headers.get("Authorization");
    let callerId: string | null = null;
    let isBootstrap = false;

    if (authHeader) {
      const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) return error("Authentication required", 401);
      const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
      if (!["admin", "super_admin"].includes(callerProfile?.role ?? "")) return error("Admin access required", 403);
      callerId = caller.id;
    } else {
      if (!["admin", "super_admin"].includes(role)) return error("Authentication required", 401);
      // Only count admin/super_admin rows that could actually sign in (a real
      // phone attached) — a stray/placeholder profile row with no phone can
      // never complete OTP login, so it must not permanently block bootstrap.
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["admin", "super_admin"])
        .not("phone", "is", null);
      if ((count ?? 0) > 0) return error("Authentication required", 401);
      isBootstrap = true;
    }

    const mobile = normalizeIndianMobile(phoneRaw);
    if (!mobile) return error("Invalid mobile number");

    // The zero-admin bootstrap path above has no caller session to check —
    // it exists only so the very first admin can be created. Restrict it to
    // the one phone number authorized as admin, so it can never be used to
    // self-provision an admin account for an arbitrary number.
    if (isBootstrap && !isAuthorizedAdminMobile(mobile)) return error("Authentication required", 401);

    const { data: existingProfile } = await admin.from("profiles").select("id").eq("phone", mobile).maybeSingle();
    if (existingProfile) return error("A profile with this mobile number already exists", 409);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      phone: mobile,
      phone_confirm: true,
      password: randomPassword(),
      user_metadata: { role, first_name: firstName, last_name: lastName },
    });
    if (createErr || !created?.user) {
      console.error('[otp-auth] createUser error:', createErr);
      return error("Could not create account", 500);
    }

    // handle_new_user() already inserted a default profile row; update it
    // with the role/name the admin specified (trigger defaults role to
    // 'customer' when raw_user_meta_data doesn't carry it through cleanly).
    // Also explicitly set phone — handle_new_user() does not copy it from
    // auth.users, so without this the profile would be unreachable by the
    // `verify` action's phone lookup (which is exactly how this account is
    // meant to log in).
    await admin
      .from("profiles")
      .update({ role, first_name: firstName, last_name: lastName, status: "active", phone: mobile })
      .eq("id", created.user.id);

    // If this mobile number had a pending self-serve request, close it out.
    if (callerId) {
      await admin
        .from("agent_requests")
        .update({ status: "approved", reviewed_by: callerId, reviewed_at: new Date().toISOString() })
        .eq("mobile", mobile)
        .eq("status", "pending");
    }

    return json({ success: true, user_id: created.user.id });
  }

  return error("Unknown action. Use x-action: verify | request-agent-access | review-agent-request | admin-provision", 400);
});
