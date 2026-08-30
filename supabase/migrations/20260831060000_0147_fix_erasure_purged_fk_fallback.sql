-- ============================================================
-- 0147: Erasure — fall back to anonymize when a NO ACTION audit FK
--       blocks the purged hard-delete (fix for migration 0146)
--
-- 0146's 'purged' path deletes auth.users and relies on cascades. But several
-- admin/review audit columns reference auth.users/profiles with NO ACTION
-- (the default RESTRICT): KYC reviewed_by/verified_by, invoice/ad
-- created_by/updated_by, property approved_by/reviewed_by (SET NULL covers most,
-- but NOT the audit-owned columns above). If an erased user (no payments) is
-- referenced there, the hard DELETE raises a foreign_key_violation and 0146
-- errors instead of erasing — fail-safe, but the DPDP right is not fulfilled.
--
-- Fix: catch foreign_key_violation on the purged delete and fall back to the
-- anonymize branch. The anonymize block is extracted into an internal-only
-- SECURITY DEFINER helper (NOT granted to authenticated, so it cannot be
-- invoked directly to scrub another user's profile) reused by both the
-- payments-retention branch and the FK fallback.
-- ============================================================

-- Internal-only anonymization helper: scrubs every personal-identifying profile
-- field, deactivates the account, and blocks login. Only reachable by functions
-- owned by postgres (SECURITY DEFINER); deliberately NOT granted to
-- `authenticated` so a caller cannot scrub another user.
create or replace function public.fn_apply_erasure_anonymization(v_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if v_uid is null then
    raise exception 'Invalid user' using errcode = '28000';
  end if;

  update public.profiles
     set email          = 'deleted-' || replace(v_uid::text, '-', '') || '@realtynow.internal',
         first_name     = null,
         last_name      = null,
         phone          = null,
         avatar_url     = null,
         bio            = null,
         company        = null,
         license_number = null,
         status         = 'deactivated',
         updated_at     = now()
   where id = v_uid;

  update auth.users
     set banned_until = now()
   where id = v_uid
     and (banned_until is null or banned_until < now());

  return jsonb_build_object(
    'mode', 'anonymized',
    'message',
    'Account deactivated and personal data erased. Statutory financial/tax or ' ||
    'audit records are retained without in-app profile data.'
  );
end;
$$;

revoke all on function public.fn_apply_erasure_anonymization(uuid) from public;
-- No GRANT to authenticated: internal-only (invoked by fn_request_account_erasure
-- which runs as postgres via SECURITY DEFINER).

comment on function public.fn_apply_erasure_anonymization(uuid) is
'Internal DPDP erasure helper: scrubs profile PII and blocks login. Must only be '
'invoked by security-definer functions owned by postgres; not granted to '
'authenticated to prevent scrubbing another user.';

-- ============================================================
-- Redefine the public RPC to use the helper and to fall back to
-- anonymization on foreign_key_violation.
-- ============================================================
create or replace function public.fn_request_account_erasure()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_has_retention bool;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile not found for the current user' using errcode = 'P0001';
  end if;

  -- Financial/tax records must be retained (legal obligation); Postgres fails a
  -- raw delete because public.payments.user_id has ON DELETE RESTRICT.
  select exists(
    select 1 from public.payments where user_id = v_uid
  ) into v_has_retention;

  if v_has_retention then
    return public.fn_apply_erasure_anonymization(v_uid);
  end if;

  -- No payment rows: physically remove the auth user (cascades profiles + all
  -- ON DELETE CASCADE personal rows). If a NO ACTION audit FK (KYC/invoice/ad
  -- reviewer columns) blocks the delete, fall back to anonymization rather than
  -- erroring — so the erasure right is still fulfilled.
  begin
    delete from auth.users where id = v_uid;
    return jsonb_build_object(
      'mode', 'purged',
      'message', 'Your account and personal data have been permanently deleted.'
    );
  exception when foreign_key_violation then
    return public.fn_apply_erasure_anonymization(v_uid);
  end;
end;
$$;

revoke all on function public.fn_request_account_erasure() from public;
grant execute on function public.fn_request_account_erasure() to authenticated;

comment on function public.fn_request_account_erasure() is
'DPDP/GDPR self-service erasure: purges the caller''s account and personal data, '
'or anonymizes and deactivates it when statutory retention records (payments or '
'NO ACTION audit FKs) prevent a hard delete. Identity is bound to auth.uid(); '
'callers cannot erase other accounts.';
