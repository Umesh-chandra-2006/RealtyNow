// supabase/functions/admin-security/index.ts
// Second-factor "Secret Access Code" gate for the admin panel — layered on top of the
// existing Supabase Auth mobile-OTP login (otp-auth edge function / src/pages/auth/otp-login.tsx).
// Every caller must already hold a valid Supabase session with profiles.role = 'admin'; this
// function never authenticates the first factor, only the second one, plus admin account
// management for super_admins. Mirrors the CORS / Deno.serve / x-action conventions of
// otp-auth and the service-role pattern of verifyProperty.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { isAuthorizedAdminMobile } from '../_shared/admin-auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 12;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400) {
  return json({ success: false, error: message }, status);
}

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

function clientInfo(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const device = req.headers.get('user-agent') || 'unknown';
  return { ip, device };
}

function validCode(code: unknown): code is string {
  return typeof code === 'string' && code.length >= MIN_CODE_LENGTH && code.length <= MAX_CODE_LENGTH;
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  adminId: string | null,
  req: Request,
  action: 'otp_login' | 'secret_setup' | 'secret_verify' | 'secret_reset' | 'logout',
  status: 'success' | 'failed' | 'locked',
) {
  const { ip, device } = clientInfo(req);
  await supabase.from('admin_login_logs').insert({ admin_id: adminId, ip, device, action, status });
}

// Resolves the caller's Supabase Auth user, requires profiles.role IN ('admin','super_admin')
// (or an authorized admin phone number), and self-heals a missing `admins` row (e.g. an
// admin profile created before this migration, or by the otp-auth admin-provision path) —
// defaults new rows to role 'admin', never 'super_admin', so self-healing can never silently
// grant elevated access.
async function resolveAdminCaller(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ userId: string; admin: Record<string, unknown>; profile: Record<string, unknown> } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Authentication required', status: 401 };
  const callerClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Authentication required', status: 401 };

  const { data: profile } = await supabase.from('profiles').select('role, phone, first_name, last_name, email, status').eq('id', userId).maybeSingle();
  const callerPhone = profile?.phone ? normalizeIndianMobile(profile.phone) : null;
  const isAuthorized = callerPhone ? isAuthorizedAdminMobile(callerPhone) : false;

  if (!['admin', 'super_admin'].includes(profile?.role ?? '') && !isAuthorized) {
    return { error: 'Admin access required', status: 403 };
  }
  if (profile?.status === 'suspended') return { error: 'This account has been suspended.', status: 403 };

  // If profile is authorized by phone but not yet set to admin role, update it
  if (isAuthorized && !['admin', 'super_admin'].includes(profile?.role ?? '')) {
    await supabase.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', userId);
    if (profile) profile.role = 'admin';
  }

  let { data: admin } = await supabase.from('admins').select('*').eq('id', userId).maybeSingle();
  if (!admin) {
    const { data: created } = await supabase
      .from('admins')
      .insert({ id: userId, mobile: profile?.phone ?? '', role: 'admin', status: 'active' })
      .select('*')
      .single();
    admin = created;
  }
  if (!admin) return { error: 'Could not resolve admin account', status: 500 };
  return { userId, admin, profile: profile as Record<string, unknown> };
}

function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (/^91\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  return null;
}

Deno.serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const action = req.headers.get('x-action') || '';
  const supabase = serviceClient();
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for some actions */
  }

  const resolved = await resolveAdminCaller(req, supabase);
  if ('error' in resolved) return fail(resolved.error, resolved.status);
  const { admin, profile } = resolved;
  const adminId = admin.id as string;

  // ─── get-me ──────────────────────────────────────────────────────
  // Returns the caller's own identity (profiles name/email/phone + admins
  // role/status/mobile) so the client never needs to query either table
  // directly with the anon key.
  if (action === 'get-me') {
    return json({
      success: true,
      admin: {
        id: admin.id,
        mobile: admin.mobile,
        role: admin.role,
        status: admin.status,
      },
      profile: {
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        email: profile.email ?? null,
        phone: profile.phone ?? null,
      },
    });
  }

  // ─── get-status ─────────────────────────────────────────────────
  if (action === 'get-status') {
    const { data: security } = await supabase
      .from('admin_security')
      .select('failed_attempts, locked_until')
      .eq('admin_id', adminId)
      .maybeSingle();
    const locked = !!security?.locked_until && new Date(security.locked_until as string) > new Date();
    return json({
      success: true,
      hasSecretCode: !!security,
      locked,
      lockedUntil: security?.locked_until ?? null,
      role: admin.role,
      status: admin.status,
    });
  }

  // Suspended admins can't do anything past this point.
  if (admin.status === 'suspended') return fail('This admin account has been suspended.', 403);

  // ─── setup-secret-code ──────────────────────────────────────────
  if (action === 'setup-secret-code') {
    const code = body.code;
    if (!validCode(code)) return fail(`Secret code must be ${MIN_CODE_LENGTH}-${MAX_CODE_LENGTH} characters.`);
    const { data: existing } = await supabase.from('admin_security').select('admin_id').eq('admin_id', adminId).maybeSingle();
    if (existing) return fail('A secret code is already set — use reset instead.', 409);

    const hash = bcrypt.hashSync(code, 10);
    const { error } = await supabase.from('admin_security').insert({ admin_id: adminId, secret_code_hash: hash });
    if (error) return fail(error.message, 500);
    await logEvent(supabase, adminId, req, 'secret_setup', 'success');
    return json({ success: true });
  }

  // ─── verify-secret-code ─────────────────────────────────────────
  if (action === 'verify-secret-code') {
    const code = body.code;
    if (typeof code !== 'string' || !code) return fail('Secret code is required.');

    const { data: security } = await supabase
      .from('admin_security')
      .select('secret_code_hash, failed_attempts, locked_until')
      .eq('admin_id', adminId)
      .maybeSingle();
    if (!security) return json({ success: false, needsSetup: true });

    if (security.locked_until && new Date(security.locked_until as string) > new Date()) {
      await logEvent(supabase, adminId, req, 'secret_verify', 'locked');
      return json({
        success: false,
        locked: true,
        lockedUntil: security.locked_until,
        error: 'Too many failed attempts. Try again later.',
      });
    }

    const isMatch = bcrypt.compareSync(code, security.secret_code_hash as string);
    if (isMatch) {
      await supabase.from('admin_security').update({ failed_attempts: 0, locked_until: null }).eq('admin_id', adminId);
      await logEvent(supabase, adminId, req, 'secret_verify', 'success');
      return json({ success: true });
    }

    const nextAttempts = ((security.failed_attempts as number) ?? 0) + 1;
    const willLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
    await supabase
      .from('admin_security')
      .update({
        failed_attempts: nextAttempts,
        locked_until: willLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null,
      })
      .eq('admin_id', adminId);
    await logEvent(supabase, adminId, req, 'secret_verify', willLock ? 'locked' : 'failed');
    return json({
      success: false,
      locked: willLock,
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - nextAttempts),
      error: willLock ? 'Too many failed attempts. Account locked for 15 minutes.' : 'Incorrect secret code.',
    });
  }

  // ─── reset-secret-code (self-service, requires the current code) ──
  if (action === 'reset-secret-code') {
    const currentCode = body.currentCode;
    const newCode = body.newCode;
    if (typeof currentCode !== 'string' || !currentCode) return fail('Current secret code is required.');
    if (!validCode(newCode)) return fail(`New secret code must be ${MIN_CODE_LENGTH}-${MAX_CODE_LENGTH} characters.`);

    const { data: security } = await supabase
      .from('admin_security')
      .select('secret_code_hash, locked_until')
      .eq('admin_id', adminId)
      .maybeSingle();
    if (!security) return fail('No secret code set up yet — use setup instead.', 409);
    if (security.locked_until && new Date(security.locked_until as string) > new Date()) {
      return fail('Account is temporarily locked. Try again later.', 423);
    }
    if (!bcrypt.compareSync(currentCode, security.secret_code_hash as string)) {
      await logEvent(supabase, adminId, req, 'secret_reset', 'failed');
      return fail('Current secret code is incorrect.', 401);
    }

    const hash = bcrypt.hashSync(newCode as string, 10);
    await supabase
      .from('admin_security')
      .update({ secret_code_hash: hash, failed_attempts: 0, locked_until: null })
      .eq('admin_id', adminId);
    await logEvent(supabase, adminId, req, 'secret_reset', 'success');
    return json({ success: true });
  }

  // ─── logout (audit log only — the actual session teardown is client-side) ──
  if (action === 'logout') {
    await logEvent(supabase, adminId, req, 'logout', 'success');
    return json({ success: true });
  }

  // ─── log-otp-login — called once right after the existing mobile-OTP sign-in
  // (otp-auth edge function) succeeds for an admin, so the first factor shows up in
  // the same audit trail as the second-factor secret-code events. otp-auth itself is
  // left untouched — this is a separate, additive log call from the client. ──
  if (action === 'log-otp-login') {
    await logEvent(supabase, adminId, req, 'otp_login', 'success');
    return json({ success: true });
  }

  // ─── Everything below requires super_admin ─────────────────────
  if (admin.role !== 'super_admin') return fail('Super admin access required.', 403);

  // ─── super-reset-secret-code ────────────────────────────────────
  if (action === 'super-reset-secret-code') {
    const targetAdminId = body.targetAdminId;
    const newCode = body.newCode;
    if (typeof targetAdminId !== 'string' || !targetAdminId) return fail('targetAdminId is required.');
    if (!validCode(newCode)) return fail(`New secret code must be ${MIN_CODE_LENGTH}-${MAX_CODE_LENGTH} characters.`);

    const { data: target } = await supabase.from('admins').select('id').eq('id', targetAdminId).maybeSingle();
    if (!target) return fail('Target admin not found.', 404);

    const hash = bcrypt.hashSync(newCode as string, 10);
    const { error } = await supabase
      .from('admin_security')
      .upsert({ admin_id: targetAdminId, secret_code_hash: hash, failed_attempts: 0, locked_until: null });
    if (error) return fail(error.message, 500);
    await logEvent(supabase, targetAdminId, req, 'secret_reset', 'success');
    return json({ success: true });
  }

  // ─── create-admin ────────────────────────────────────────────────
  if (action === 'create-admin') {
    const mobileRaw = body.mobile;
    const role = body.role === 'super_admin' ? 'super_admin' : 'admin';
    const firstName = (body.first_name as string | undefined) ?? null;
    const lastName = (body.last_name as string | undefined) ?? null;
    if (typeof mobileRaw !== 'string' || !mobileRaw) return fail('mobile is required.');
    const mobile = normalizeIndianMobile(mobileRaw);
    if (!mobile) return fail('Invalid mobile number.');

    let { data: profile } = await supabase.from('profiles').select('id, role').eq('phone', mobile).maybeSingle();

    if (!profile) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        phone: mobile,
        phone_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { role: 'admin', first_name: firstName, last_name: lastName },
      });
      if (createErr || !created?.user) return fail(createErr?.message ?? 'Could not create account', 500);
      await supabase
        .from('profiles')
        .update({ role: 'admin', first_name: firstName, last_name: lastName, status: 'active' })
        .eq('id', created.user.id);
      profile = { id: created.user.id, role: 'admin' };
    } else if (profile.role !== 'admin') {
      await supabase.from('profiles').update({ role: 'admin' }).eq('id', profile.id);
    }

    const { error: upsertErr } = await supabase
      .from('admins')
      .upsert({ id: profile.id, mobile, role, status: 'active' });
    if (upsertErr) return fail(upsertErr.message, 500);

    return json({ success: true, adminId: profile.id });
  }

  // ─── update-admin-status (suspend / reactivate) ─────────────────
  if (action === 'update-admin-status') {
    const targetAdminId = body.targetAdminId;
    const status = body.status === 'suspended' ? 'suspended' : 'active';
    if (typeof targetAdminId !== 'string' || !targetAdminId) return fail('targetAdminId is required.');
    if (targetAdminId === adminId && status === 'suspended') return fail('You cannot suspend your own account.');

    const { error } = await supabase.from('admins').update({ status, updated_at: new Date().toISOString() }).eq('id', targetAdminId);
    if (error) return fail(error.message, 500);
    return json({ success: true });
  }

  // ─── list-admins ─────────────────────────────────────────────────
  if (action === 'list-admins') {
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, mobile, role, status, created_at, profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    if (error) return fail(error.message, 500);

    const ids = (admins ?? []).map((a) => a.id as string);
    const { data: security } = ids.length
      ? await supabase.from('admin_security').select('admin_id, failed_attempts, locked_until, updated_at').in('admin_id', ids)
      : { data: [] };
    const securityMap = new Map((security ?? []).map((s) => [s.admin_id, s]));

    return json({
      success: true,
      admins: (admins ?? []).map((a) => ({ ...a, security: securityMap.get(a.id as string) ?? null })),
    });
  }

  // ─── list-login-logs ─────────────────────────────────────────────
  if (action === 'list-login-logs') {
    const filterAdminId = typeof body.adminId === 'string' ? body.adminId : undefined;
    let q = supabase.from('admin_login_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (filterAdminId) q = q.eq('admin_id', filterAdminId);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return json({ success: true, logs: data ?? [] });
  }

  return fail(
    'Unknown action. Use x-action: get-me | get-status | setup-secret-code | verify-secret-code | reset-secret-code | super-reset-secret-code | create-admin | update-admin-status | list-admins | list-login-logs',
  );
});
