// Allowed origins for cross-origin browser access. '*' is a security risk on
// any endpoint that reads: it lets arbitrary sites issue credentialed requests
// to our API/functions. Restrict to the realtynow domains.
const ALLOWED_ORIGINS: string[] = [
  'https://www.realtynow.in',
  'https://realtynow.in',
  'https://realtynow.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

export function getCorsHeaders(req: Request | { headers: Headers }): Record<string, string> {
  const origin = req?.headers?.get?.('Origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-action, x-client-info',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// Backwards-compatible default for call sites that don't vary on Origin.
// Prefer getCorsHeaders(req) everywhere possible.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://www.realtynow.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};
