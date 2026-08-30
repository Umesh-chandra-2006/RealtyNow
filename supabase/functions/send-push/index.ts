// supabase/functions/send-push/index.ts
// Sends a Firebase Cloud Messaging (Web Push) notification for an
// already-created row in public.notifications, to every active push_tokens
// row for that notification's user_id.
//
// Deliberately narrow: this function does NOT accept arbitrary title/body
// from the caller — it only re-delivers content that a trusted, RLS/role-
// checked process (notify_user()/fn_send_notification(), called from
// property/enquiry/payment/renewal triggers or the admin-only
// admin_send_notification RPC) already inserted into `notifications`. That
// makes it safe to call with just the public anon key (see migration 0060's
// fn_dispatch_push) — the worst a malicious caller could do is re-trigger
// delivery of a notification that already legitimately exists for its
// rightful recipient, not inject new content or notify an arbitrary user
// with arbitrary text.
//
// Body: { notification_id: string }
//
// Uses the Firebase Admin SDK's HTTP v1 API directly (JWT-signed service
// account -> OAuth2 access token -> FCM send), rather than the
// firebase-admin npm package, for reliability in the Deno edge runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sendEmail } from "../_shared/email.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

// ── Service-account JWT -> OAuth2 access token (RS256, Web Crypto) ──
function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to get FCM access token: ${JSON.stringify(data)}`);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function handler(req: Request): Promise<Response> {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Anon-key callable by design (fn_dispatch_push uses the public anon key), so
  // throttle per-IP tightly: an abuser could otherwise re-trigger FCM sends and
  // flip valid push tokens inactive (deactivating push for real users).
  const rate = await checkRateLimit(admin, req, {
    endpoint: "send-push",
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

  let body: { notification_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const notificationId = body.notification_id;
  if (!notificationId) return json({ error: "notification_id is required", success: false }, 400);

  let pushConfigError: string | null = null;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
    // FCM not configured — record it and continue so the transactional email
    // channel (independent of push) can still be attempted below.
    pushConfigError = "FCM is not configured on the server (FIREBASE_SERVICE_ACCOUNT_JSON missing)";
  }

  const { data: notification } = await admin.from("notifications").select("*").eq("id", notificationId).maybeSingle();
  if (!notification) return json({ error: "Notification not found", success: false }, 404);

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", notification.user_id)
    .eq("is_active", true);

  let delivered = 0;

  if (tokens && tokens.length > 0 && !pushConfigError) {
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON!);
    } catch {
      pushConfigError = "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON";
      sa = null!;
    }

    if (sa) {
      const accessToken = await getAccessToken(sa);

      for (const t of tokens) {
        const message = {
          message: {
            token: t.token,
            notification: { title: notification.title, body: notification.body ?? "" },
            data: {
              notification_id: notification.id,
              type: notification.type ?? "",
              link: notification.link ?? "/",
            },
            webpush: {
              fcm_options: { link: notification.link ?? "/" },
              notification: { icon: "/pwa-192x192.png" },
            },
          },
        };

        // Retry once on transient failure — satisfies "retry failed delivery"
        // without an unbounded retry loop that could hang the function.
        let lastError: string | null = null;
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(message),
            });
            const resBody = await res.json().catch(() => ({}));
            if (res.ok) {
              ok = true;
              delivered++;
              await admin.from("notification_delivery_log").insert({
                notification_id: notification.id,
                channel: "push",
                status: "delivered",
                provider: "fcm",
                provider_ref: resBody.name ?? null,
              });
            } else {
              lastError = JSON.stringify(resBody);
              const errCode = resBody?.error?.status;
              if (errCode === "NOT_FOUND" || errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
                // Token is dead — deactivate it so future sends skip it.
                await admin.from("push_tokens").update({ is_active: false }).eq("id", t.id);
                break; // no point retrying an invalid token
              }
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
        }

        if (!ok) {
          await admin.from("notification_delivery_log").insert({
            notification_id: notification.id,
            channel: "push",
            status: "failed",
            provider: "fcm",
            error_message: lastError,
          });
        }
      }
    }
  }

  // ── Transactional email for the same notification (honest delivery log) ──
  // Best-effort, never a fake success: resolves the recipient's email from
  // auth.users (the notification row only stores user_id) and dispatches via
  // the shared Resend helper. Logs channel="email" to notification_delivery_log
  // with the real outcome.
  let emailDispatched = false;
  let emailSkipped: string | null = null;
  const { data: recipient } = await admin
    .from("auth.users")
    .select("email")
    .eq("id", notification.user_id)
    .maybeSingle();

  const recipientEmail = recipient?.email;
  if (!recipientEmail) {
    emailSkipped = "Recipient has no email on record";
  } else if (recipientEmail.endsWith("@realtynow.internal")) {
    emailSkipped = "Synthetic internal email; not deliverable";
  } else {
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p style="font-size: 18px; color: #111;">${escapeHtml(notification.title)}</p>
          ${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ""}
          ${notification.link ? `<p><a href="${escapeHtml(notification.link)}" style="color:#b61f24;">View details</a></p>` : ""}
          <p style="color:#666; font-size: 13px;">You are receiving this because you're signed up with RealtyNow.</p>
        </div>
      `,
    });

    await admin.from("notification_delivery_log").insert({
      notification_id: notification.id,
      channel: "email",
      status: emailResult.ok ? "sent" : "failed",
      provider: emailResult.ok ? "resend" : null,
      provider_ref: emailResult.id ?? null,
      error_message: emailResult.ok ? null : emailResult.error ?? null,
    });
    emailDispatched = emailResult.ok;
    if (!emailResult.ok) emailSkipped = emailResult.error ?? "Email send failed";
  }

  return json({
    success: true,
    delivered,
    total_tokens: tokens ? tokens.length : 0,
    push_config_error: pushConfigError,
    email_dispatched: emailDispatched,
    email_skipped: emailSkipped,
  });
}

/** Minimal HTML-escape for values interpolated into email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(handler);
