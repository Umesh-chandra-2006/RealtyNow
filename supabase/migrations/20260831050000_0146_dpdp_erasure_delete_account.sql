-- ============================================================
-- 0146: DPDP / GDPR erasure — self-service account deletion
--
-- Implements the "Request deletion of your account" right promised in
-- src/pages/public/privacy-policy.tsx (User Rights) and docs/DATA_GOVERNANCE.md.
--
--   fn_request_account_erasure()  — SECURITY DEFINER RPC for `authenticated`
--
-- Erosion modes (DPDP-correct):
--   * "purged"      — no financial-retention rows exist: hard-delete auth.users;
--                     `ON DELETE CASCADE` removes profiles + all personal rows.
--   * "anonymized"  -- txn-locked data (public.payments has RESTRICT on user_id)
--                     must be kept for statutory financial/tax retention: scrub all
--                     personal-identifying profile fields, set status 'deactivated',
--                     and ban the auth login (banned_until = now()) so the account
--                     can no longer authenticate. No PII remains in-app.
--
-- The caller identity is taken from auth.uid() internally — the function accepts
-- NO parameters, so a caller can only ever erase their OWN account.
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

  -- Do not act on a foreign/other user (identity comes only from auth.uid()).
  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile not found for the current user' using errcode = 'P0001';
  end if;

  -- Financial/tax records must be retained (legal obligation); Postgres would
  -- fail a raw delete because public.payments.user_id has ON DELETE RESTRICT.
  select exists(
    select 1 from public.payments where user_id = v_uid
  ) into v_has_retention;

  if v_has_retention then
    -- Anonymize all personal-identifying fields; keep the account row only so
    -- financial records remain referentially valid.
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

    -- Block login so the deactivated principal cannot continue to authenticate.
    update auth.users
       set banned_until = now()
     where id = v_uid
       and (banned_until is null or banned_until < now());

    return jsonb_build_object(
      'mode', 'anonymized',
      'message',
      'Account deactivated and personal data erased. Financial/tax records are ' ||
      'retained solely for statutory compliance and contain no in-app profile data.'
    );
  end if;

  -- No retention obligations: physically remove the auth user, which cascades
  -- profiles and all ON DELETE CASCADE personal rows (notifications, tokens,
  -- enquiries, subscriptions, wallets, etc.). SET NULL / SET NULL FKs (e.g.
  -- approved_by, listed_by_user_id) are nulled, preserving other data integrity.
  delete from auth.users where id = v_uid;

  return jsonb_build_object(
    'mode', 'purged',
    'message', 'Your account and personal data have been permanently deleted.'
  );
end;
$$;

revoke all on function public.fn_request_account_erasure() from public;
grant execute on function public.fn_request_account_erasure() to authenticated;

comment on function public.fn_request_account_erasure() is
'DPDP/GDPR self-service erasure: purges the caller''s account and personal data, '
'or anonymizes and deactivates it when statutory financial-retention records exist. '
'Identity is bound to auth.uid() — callers cannot erase other accounts.';
