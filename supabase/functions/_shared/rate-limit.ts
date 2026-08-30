// Shared rate-limiting helper for Supabase edge functions.
//
// Wraps the existing DB-level `public.fn_check_rate_limit` (migration 0036) so
// edge functions can uniformly throttle abusive callers per-IP/per-endpoint and
// return standard `x-ratelimit-*` headers plus a 429 when a window is exhausted.
//
// The underlying table + function are service_role-only (RLS), so callers must
// pass a service-role Supabase client (typically `serviceClient()`).

export interface RateLimitOptions {
  /** Semantics identifier surfaced in logs. */
  endpoint: string;
  /** Max requests allowed within the window. Default 60. */
  maxRequests?: number;
  /** Window length in seconds. Default 60. */
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** HTTP status to use when !allowed (429). */
  status: number;
  headers: Record<string, string>;
}

function clientIp(req: Request): string {
  // Supabase edge runtime populates x-forwarded-for / x-real-ip.
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  // Fall back to a stable route key per deployment when no IP is visible.
  return 'unknown';
}

export async function checkRateLimit(
  supabase: any,
  req: Request,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const { endpoint, maxRequests = 60, windowSeconds = 60 } = opts;
  const identifier = `${clientIp(req)}`;

  try {
    const { data, error } = await supabase.rpc('fn_check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // Fail open: a rate-limit infra error must not take the whole API down.
      console.warn(`[rate-limit] fn_check_rate_limit errored for ${endpoint}:`, error.message);
      return { allowed: true, status: 200, headers: {} };
    }

    const result = data as Record<string, unknown>;
    const allowed = result?.allowed !== false;

    const headers: Record<string, string> = {
      'x-ratelimit-endpoint': endpoint,
      'x-ratelimit-limit': String(maxRequests),
    };
    if (typeof result?.request_count === 'number') {
      headers['x-ratelimit-request-count'] = String(result.request_count);
    }
    if (typeof result?.remaining === 'number') {
      headers['x-ratelimit-remaining'] = String(result.remaining);
    }
    if (typeof result?.retry_after_seconds === 'number') {
      headers['retry-after'] = String(result.retry_after_seconds);
    }

    return { allowed, status: allowed ? 200 : 429, headers };
  } catch (err) {
    console.warn(`[rate-limit] unexpected error for ${endpoint}:`, (err as Error)?.message);
    return { allowed: true, status: 200, headers: {} };
  }
}
