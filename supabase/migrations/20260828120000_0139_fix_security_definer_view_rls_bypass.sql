-- =============================================================================
-- Migration: 20260828120000_0139_fix_security_definer_view_rls_bypass.sql
-- Description: Closes an RLS bypass on 5 views flagged ERROR by Supabase's
--              security advisor (lint 0010_security_definer_view). Views
--              default to running with their creator's privileges unless
--              security_invoker is set, so anon/authenticated (which hold
--              broad default grants per this project's standard Supabase
--              privilege model, normally reined in by RLS on the base
--              tables) could read every row through these views regardless
--              of RLS on profiles/enquiries/favorites/login_attempts/
--              rate_limits. Confirmed exploitable: `set role anon` could
--              read agent emails, other users' saved properties, and
--              login-security telemetry through these views.
--
--              security_invoker = on makes each view enforce RLS for the
--              querying role instead of the view owner, closing the bypass
--              without changing the view's columns/logic. Write-grants are
--              also dropped since none of these views are meant to be
--              written through directly.
-- =============================================================================

ALTER VIEW public.v_agent_lead_summary SET (security_invoker = on);
ALTER VIEW public.v_crm_pipeline SET (security_invoker = on);
ALTER VIEW public.v_security_alerts SET (security_invoker = on);
ALTER VIEW public.v_saved_properties SET (security_invoker = on);
ALTER VIEW public.vw_published_properties SET (security_invoker = on);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_agent_lead_summary,
     public.v_crm_pipeline,
     public.v_security_alerts,
     public.v_saved_properties,
     public.vw_published_properties
  FROM anon, authenticated;

-- v_security_alerts, v_agent_lead_summary, and v_crm_pipeline surface
-- internal operational data (login-security telemetry, per-agent revenue,
-- CRM pipeline counts) with no client-side usage in src/ — restrict them to
-- admin/service-role access only, not the generic authenticated app role,
-- and never anonymous visitors.
REVOKE SELECT ON public.v_security_alerts, public.v_agent_lead_summary, public.v_crm_pipeline
  FROM anon, authenticated;

-- v_saved_properties (used by the logged-in "my saved properties" portal
-- page) must stay selectable by authenticated users - security_invoker=on
-- above already scopes each query to the caller's own rows via the
-- favorites_own RLS policy (auth.uid() = user_id). Anonymous visitors have
-- no legitimate reason to read anyone's saved properties.
REVOKE SELECT ON public.v_saved_properties FROM anon;
