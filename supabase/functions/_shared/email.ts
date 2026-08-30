// Shared transactional-email helper (Resend).
//
// Deno edge-function runtime: talks to Resend's REST API over plain fetch (no
// SDK dependency), gated on the RESEND_API_KEY secret. Designed to NEVER report
// false success — if no key is configured, or Resend returns an error, the
// caller receives an explicit failure so upstream flows can surface it instead
// of silently claiming delivery.
//
// Env secrets:
//   RESEND_API_KEY   - Resend API key (required to actually send)
//   EMAIL_FROM       - verified sender address, e.g. "RealtyNow <no-reply@realtynow.in>"
//                      (optional; defaults to "RealtyNow <onboarding@resend.dev>")

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Optional from override (must be a verified domain on the Resend account). */
  from?: string;
}

export interface EmailResult {
  ok: boolean;
  /** True if the send was attempted but the provider is not configured. */
  notConfigured?: boolean;
  /** Resend message id when delivered. */
  id?: string;
  error?: string;
  status?: number;
}

function fromAddress(): string {
  return Deno.env.get("EMAIL_FROM") || "RealtyNow <onboarding@resend.dev>";
}

/**
 * Send a transactional email via Resend.
 *
 * - Returns { ok:false, notConfigured:true } if RESEND_API_KEY is missing — an
 *   honest signal that email isn't wired up yet (never a fake success).
 * - Returns { ok:false, error, status } on any provider/HTTP error.
 * - Returns { ok:true, id } on delivery.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, notConfigured: true, error: "RESEND_API_KEY not configured" };
  }

  const body = {
    from: input.from || fromAddress(),
    to: input.to,
    subject: input.subject,
    ...(input.html ? { html: input.html } : {}),
    ...(input.text ? { text: input.text } : {}),
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.message || data?.error || `Resend HTTP ${res.status}`;
      return { ok: false, error: message, status: res.status };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}
