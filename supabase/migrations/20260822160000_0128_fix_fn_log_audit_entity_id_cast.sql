/*
  Migration 0128 — Fix fn_log_audit() entity_id type mismatch

  fn_log_audit(p_entity_id TEXT, ...) has always inserted p_entity_id directly
  into audit_logs.entity_id (uuid column). Postgres has no implicit/assignment
  cast from a TEXT variable to uuid, so this raised
  "column entity_id is of type uuid but expression is of type text" (42804)
  on every call that passed a non-null entity_id — silently swallowed by the
  function's own `EXCEPTION WHEN OTHERS THEN NULL` safety net. Confirmed live:
  audit_logs has had no new rows since 2026-08-18 despite fn_log_audit being
  called from many places (this session's new referral/commission RPCs
  included). Fix: cast defensively (falls back to NULL entity_id if the
  string genuinely isn't a UUID, rather than dropping the whole audit row).
  Signature unchanged — no call sites need updating.
*/
create or replace function public.fn_log_audit(
  p_action       TEXT,
  p_entity       TEXT DEFAULT NULL,
  p_entity_id    TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT NULL,
  p_severity     TEXT DEFAULT 'info',
  p_changes      JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id uuid;
BEGIN
  BEGIN
    v_entity_id := p_entity_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_entity_id := NULL;
  END;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata, severity, changes)
  VALUES (auth.uid(), p_action, p_entity, v_entity_id, p_metadata, p_severity, p_changes);
EXCEPTION WHEN OTHERS THEN
  NULL; -- Never block operations for audit logging
END;
$$;
