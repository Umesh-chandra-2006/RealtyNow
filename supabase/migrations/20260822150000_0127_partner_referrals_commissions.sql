/*
  Migration 0127 — Partner Referral + Commission backend

  Adds the ability for an approved business partner to submit a referral
  (customer/property/service), have staff assign it to an agent, track it to
  completion, and have a commission auto-generate on completion. Payouts
  deliberately reuse the EXISTING wallets/wallet_transactions/withdrawal_requests
  system (migration 0040) + fn_request_withdrawal() RPC — nothing new needed
  there beyond crediting the wallet on commission approval.

  Backend only (confirmed with user) — no new frontend pages this pass.

  House convention followed: assignment/status-transition/financial mutations
  are plain SECURITY DEFINER Postgres RPCs (mirrors fn_assign_lead /
  fn_update_lead_status / fn_request_withdrawal), not Edge Functions — Edge
  Functions in this codebase are reserved for auth.users creation, which none
  of this needs.
*/

-- =========================================================
-- A. REFERRALS
-- =========================================================
create sequence if not exists public.referral_code_seq start 1;

create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referral_code      text unique,
  partner_id         uuid not null references public.partners(id) on delete cascade,
  referral_type      text not null check (referral_type in ('customer', 'property', 'service')),
  category           text,
  details            jsonb not null default '{}'::jsonb,
  enquiry_id         uuid references public.enquiries(id) on delete set null,
  status             text not null default 'pending' check (status in (
                       'pending', 'verified', 'assigned', 'in_process', 'completed', 'cancelled', 'rejected'
                     )),
  assigned_agent_id  uuid references public.profiles(id) on delete set null,
  assigned_at        timestamptz,
  assigned_by        uuid references public.profiles(id) on delete set null,
  eligible_amount    numeric(15,2),
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create or replace function public.set_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := 'RN-REF-' || lpad(nextval('public.referral_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_set_code on public.referrals;
create trigger referrals_set_code
  before insert on public.referrals
  for each row execute function public.set_referral_code();

create or replace function public.handle_referrals_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists referrals_updated_at on public.referrals;
create trigger referrals_updated_at
  before update on public.referrals
  for each row execute function public.handle_referrals_updated_at();

create index if not exists idx_referrals_partner_id on public.referrals(partner_id);
create index if not exists idx_referrals_status on public.referrals(status);
create index if not exists idx_referrals_assigned_agent on public.referrals(assigned_agent_id);
create index if not exists idx_referrals_type on public.referrals(referral_type);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals
  for select to authenticated using (
    partner_id in (select id from public.partners where user_id = auth.uid())
    or assigned_agent_id = auth.uid()
    or public.is_staff()
  );

-- Deliberately no INSERT/UPDATE policy for partner/agent — all writes go
-- through create_referral / fn_assign_referral / fn_update_referral_status
-- (SECURITY DEFINER), so a partner can never fabricate a referral under
-- someone else's partner_id and an agent can never self-mark completion.
drop policy if exists "referrals_staff_all" on public.referrals;
create policy "referrals_staff_all" on public.referrals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =========================================================
-- B. REFERRAL ACTIVITIES (event timeline, mirrors lead_activities)
-- =========================================================
create table if not exists public.referral_activities (
  id             uuid primary key default gen_random_uuid(),
  referral_id    uuid not null references public.referrals(id) on delete cascade,
  actor_id       uuid references public.profiles(id) on delete set null,
  activity_type  text not null check (activity_type in (
                   'created', 'verified', 'assigned', 'status_changed',
                   'completed', 'commission_generated', 'cancelled', 'rejected'
                 )),
  title          text not null,
  old_value      text,
  new_value      text,
  notes          text,
  is_system      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_referral_activities_referral_id on public.referral_activities(referral_id);

alter table public.referral_activities enable row level security;

drop policy if exists "referral_activities_select_own" on public.referral_activities;
create policy "referral_activities_select_own" on public.referral_activities
  for select to authenticated using (
    exists (
      select 1 from public.referrals r
      where r.id = referral_activities.referral_id
        and (
          r.partner_id in (select id from public.partners where user_id = auth.uid())
          or r.assigned_agent_id = auth.uid()
        )
    )
    or public.is_staff()
  );

drop policy if exists "referral_activities_staff_all" on public.referral_activities;
create policy "referral_activities_staff_all" on public.referral_activities
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =========================================================
-- C. COMMISSION RULES
-- =========================================================
create table if not exists public.commission_rules (
  id               uuid primary key default gen_random_uuid(),
  rule_name        text not null,
  referral_type    text not null check (referral_type in ('customer', 'property', 'service')),
  category         text,
  commission_type  text not null check (commission_type in ('percentage', 'fixed', 'tiered')),
  percentage       numeric(5,2),
  fixed_amount     numeric(15,2),
  tier_config      jsonb,
  min_amount       numeric(15,2),
  max_amount       numeric(15,2),
  effective_from   date not null default current_date,
  effective_to     date,
  active           boolean not null default true,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace function public.handle_commission_rules_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists commission_rules_updated_at on public.commission_rules;
create trigger commission_rules_updated_at
  before update on public.commission_rules
  for each row execute function public.handle_commission_rules_updated_at();

create index if not exists idx_commission_rules_lookup on public.commission_rules(referral_type, category, active);

alter table public.commission_rules enable row level security;

-- Rate transparency: any authenticated user (incl. partners) can see active rules.
drop policy if exists "commission_rules_select_active" on public.commission_rules;
create policy "commission_rules_select_active" on public.commission_rules
  for select to authenticated using (active = true);

drop policy if exists "commission_rules_admin_all" on public.commission_rules;
create policy "commission_rules_admin_all" on public.commission_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- D. PARTNER COMMISSIONS
-- =========================================================
create sequence if not exists public.commission_code_seq start 1;

create table if not exists public.partner_commissions (
  id                uuid primary key default gen_random_uuid(),
  commission_code   text unique,
  referral_id       uuid not null references public.referrals(id) on delete cascade,
  partner_id        uuid not null references public.partners(id) on delete cascade,
  rule_id           uuid references public.commission_rules(id) on delete set null,
  -- Snapshot of the rule at generation time — NEVER recalculated if the rule changes later.
  rule_name         text not null,
  commission_type   text not null,
  commission_rate   numeric(15,2) not null,
  eligible_amount   numeric(15,2) not null default 0,
  commission_amount numeric(15,2) not null,
  status            text not null default 'pending' check (status in (
                      'created', 'pending', 'approved', 'payable', 'paid', 'rejected', 'on_hold'
                    )),
  approved_by       uuid references public.profiles(id),
  approved_at       timestamptz,
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.set_commission_code()
returns trigger language plpgsql as $$
begin
  if new.commission_code is null then
    new.commission_code := 'RN-COM-' || lpad(nextval('public.commission_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists partner_commissions_set_code on public.partner_commissions;
create trigger partner_commissions_set_code
  before insert on public.partner_commissions
  for each row execute function public.set_commission_code();

create or replace function public.handle_partner_commissions_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists partner_commissions_updated_at on public.partner_commissions;
create trigger partner_commissions_updated_at
  before update on public.partner_commissions
  for each row execute function public.handle_partner_commissions_updated_at();

create index if not exists idx_partner_commissions_partner_id on public.partner_commissions(partner_id);
create index if not exists idx_partner_commissions_referral_id on public.partner_commissions(referral_id);
create index if not exists idx_partner_commissions_status on public.partner_commissions(status);

alter table public.partner_commissions enable row level security;

drop policy if exists "partner_commissions_select_own" on public.partner_commissions;
create policy "partner_commissions_select_own" on public.partner_commissions
  for select to authenticated using (
    partner_id in (select id from public.partners where user_id = auth.uid())
    or public.is_staff()
  );

-- No insert/update policy at all for partner/staff — every write goes through
-- fn_generate_commission / fn_approve_commission / fn_reject_commission /
-- fn_hold_commission (SECURITY DEFINER). Financial values are never
-- client-writable, direct or otherwise.
drop policy if exists "partner_commissions_admin_manage" on public.partner_commissions;
create policy "partner_commissions_admin_manage" on public.partner_commissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- E. create_referral() — partner submits a referral
-- =========================================================
create or replace function public.create_referral(
  p_referral_type  text,
  p_category       text default null,
  p_details        jsonb default '{}'::jsonb,
  p_force          boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id      uuid;
  v_partner_status  text;
  v_referral_id     uuid;
  v_referral_code   text;
  v_mobile          text;
  v_existing_ref    uuid;
  v_existing_enq    uuid;
  v_admin_id        uuid;
begin
  select id, status into v_partner_id, v_partner_status
  from public.partners where user_id = auth.uid();

  if v_partner_id is null then
    raise exception 'Only an approved partner can submit a referral.';
  end if;
  if v_partner_status <> 'active' then
    raise exception 'Your partner account is not active.';
  end if;
  if p_referral_type not in ('customer', 'property', 'service') then
    raise exception 'Invalid referral type.';
  end if;

  if p_referral_type = 'customer' and not p_force then
    v_mobile := p_details->>'mobile';
    if v_mobile is not null then
      select id into v_existing_ref from public.referrals
        where details->>'mobile' = v_mobile
          and status not in ('completed', 'cancelled', 'rejected')
        limit 1;
      if v_existing_ref is not null then
        return jsonb_build_object('success', false, 'code', 'DUPLICATE_REFERRAL', 'existing_referral_id', v_existing_ref);
      end if;

      select id into v_existing_enq from public.enquiries
        where phone = v_mobile and status <> 'closed'
        limit 1;
      if v_existing_enq is not null then
        return jsonb_build_object('success', false, 'code', 'DUPLICATE_LEAD', 'existing_enquiry_id', v_existing_enq);
      end if;
    end if;
  end if;

  insert into public.referrals (partner_id, referral_type, category, details, status)
  values (v_partner_id, p_referral_type, p_category, coalesce(p_details, '{}'::jsonb), 'pending')
  returning id, referral_code into v_referral_id, v_referral_code;

  insert into public.referral_activities (referral_id, actor_id, activity_type, title, is_system)
  values (v_referral_id, auth.uid(), 'created', 'Referral submitted by partner', true);

  for v_admin_id in select id from public.profiles where role in ('admin', 'super_admin') and status = 'active' loop
    perform public.notify_user(v_admin_id, 'referral_submitted',
      'New Referral Submitted',
      'A new ' || p_referral_type || ' referral (' || v_referral_code || ') has been submitted.',
      '/admin/referrals');
  end loop;

  return jsonb_build_object('success', true, 'referral_id', v_referral_id, 'referral_code', v_referral_code);
end;
$$;

grant execute on function public.create_referral(text, text, jsonb, boolean) to authenticated;

-- =========================================================
-- F. fn_assign_referral() — staff assigns a referral to an agent
-- =========================================================
create or replace function public.fn_assign_referral(
  p_referral_id uuid,
  p_agent_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral       record;
  v_partner_user   uuid;
  v_enquiry_id     uuid;
begin
  if not public.is_staff() then
    raise exception 'Unauthorized: Only staff can assign referrals';
  end if;

  select * into v_referral from public.referrals where id = p_referral_id;
  if not found then raise exception 'Referral not found'; end if;

  update public.referrals
  set assigned_agent_id = p_agent_id,
      assigned_by = auth.uid(),
      assigned_at = now(),
      status = case when status = 'pending' then 'assigned' else status end
  where id = p_referral_id;

  if v_referral.referral_type = 'customer' and v_referral.enquiry_id is null then
    insert into public.enquiries (
      name, email, phone, message, property_id, status,
      lead_status, source, assigned_to, agent_id, assigned_at, assigned_by
    ) values (
      v_referral.details->>'name',
      v_referral.details->>'email',
      v_referral.details->>'mobile',
      v_referral.details->>'requirement',
      nullif(v_referral.details->>'property_id', '')::uuid,
      'new', 'assigned', 'referral', p_agent_id, p_agent_id, now(), auth.uid()
    )
    returning id into v_enquiry_id;

    update public.referrals set enquiry_id = v_enquiry_id where id = p_referral_id;
  end if;

  insert into public.referral_activities (referral_id, actor_id, activity_type, title, old_value, new_value, is_system)
  values (p_referral_id, auth.uid(), 'assigned', 'Referral assigned to agent',
    coalesce(v_referral.assigned_agent_id::text, ''), p_agent_id::text, true);

  perform public.notify_user(p_agent_id, 'referral_assigned',
    'New Referral Assigned', 'A referral (' || v_referral.referral_code || ') has been assigned to you.', '/agent/crm');

  select p.user_id into v_partner_user from public.partners p where p.id = v_referral.partner_id;
  if v_partner_user is not null then
    perform public.notify_user(v_partner_user, 'referral_assigned',
      'Referral Assigned', 'Your referral ' || v_referral.referral_code || ' has been assigned to an agent.', '/partner');
  end if;

  return jsonb_build_object('success', true, 'referral_id', p_referral_id, 'agent_id', p_agent_id, 'enquiry_id', v_enquiry_id);
end;
$$;

grant execute on function public.fn_assign_referral(uuid, uuid) to authenticated;

-- =========================================================
-- G. fn_generate_commission() — internal, called on referral completion
-- =========================================================
create or replace function public.fn_generate_commission(p_referral_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral         record;
  v_rule             record;
  v_commission_id    uuid;
  v_commission_code  text;
  v_amount           numeric(15,2);
  v_rate             numeric(15,2);
  v_tier_rate        numeric;
  v_partner_user     uuid;
begin
  select * into v_referral from public.referrals where id = p_referral_id;
  if not found then raise exception 'Referral not found'; end if;

  select * into v_rule from public.commission_rules
  where active = true
    and referral_type = v_referral.referral_type
    and (category = v_referral.category or category is null)
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date)
  order by (category is not null and category = v_referral.category) desc, created_at desc
  limit 1;

  if not found then
    raise exception 'No active commission rule found for referral type % / category %', v_referral.referral_type, v_referral.category;
  end if;

  if v_rule.commission_type = 'percentage' then
    v_rate := v_rule.percentage;
    v_amount := round(coalesce(v_referral.eligible_amount, 0) * coalesce(v_rule.percentage, 0) / 100, 2);
  elsif v_rule.commission_type = 'fixed' then
    v_rate := v_rule.fixed_amount;
    v_amount := v_rule.fixed_amount;
  elsif v_rule.commission_type = 'tiered' then
    select (tier->>'rate')::numeric into v_tier_rate
    from jsonb_array_elements(coalesce(v_rule.tier_config, '[]'::jsonb)) as tier
    where coalesce(v_referral.eligible_amount, 0) >= (tier->>'min')::numeric
      and (tier->>'max' is null or coalesce(v_referral.eligible_amount, 0) <= (tier->>'max')::numeric)
    limit 1;
    if v_tier_rate is null then
      raise exception 'No matching commission tier for eligible amount %', v_referral.eligible_amount;
    end if;
    v_rate := v_tier_rate;
    v_amount := round(coalesce(v_referral.eligible_amount, 0) * v_tier_rate / 100, 2);
  else
    raise exception 'Unknown commission_type on rule %', v_rule.id;
  end if;

  if v_rule.min_amount is not null and v_amount < v_rule.min_amount then v_amount := v_rule.min_amount; end if;
  if v_rule.max_amount is not null and v_amount > v_rule.max_amount then v_amount := v_rule.max_amount; end if;

  insert into public.partner_commissions (
    referral_id, partner_id, rule_id, rule_name, commission_type, commission_rate,
    eligible_amount, commission_amount, status
  ) values (
    p_referral_id, v_referral.partner_id, v_rule.id, v_rule.rule_name, v_rule.commission_type, coalesce(v_rate, 0),
    coalesce(v_referral.eligible_amount, 0), v_amount, 'pending'
  )
  returning id, commission_code into v_commission_id, v_commission_code;

  perform public.fn_log_audit('commission_generated', 'partner_commissions', v_commission_id::text,
    jsonb_build_object('referral_id', p_referral_id, 'rule_id', v_rule.id, 'amount', v_amount), 'info', null);

  insert into public.referral_activities (referral_id, actor_id, activity_type, title, new_value, is_system)
  values (p_referral_id, auth.uid(), 'commission_generated', 'Commission generated', v_commission_code, true);

  select p.user_id into v_partner_user from public.partners p where p.id = v_referral.partner_id;
  if v_partner_user is not null then
    perform public.notify_user(v_partner_user, 'commission_generated',
      'Commission Generated', 'Commission ' || v_commission_code || ' has been generated for your referral.', '/partner');
  end if;

  return v_commission_id;
end;
$$;

revoke all on function public.fn_generate_commission(uuid) from public, anon, authenticated;

-- =========================================================
-- H. fn_update_referral_status() — staff/assigned-agent only; no partner path
-- =========================================================
create or replace function public.fn_update_referral_status(
  p_referral_id      uuid,
  p_new_status       text,
  p_notes            text default null,
  p_eligible_amount  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral    record;
  v_old_status  text;
  v_commission_id uuid;
begin
  select * into v_referral from public.referrals where id = p_referral_id;
  if not found then raise exception 'Referral not found'; end if;

  if not (public.is_staff() or v_referral.assigned_agent_id = auth.uid()) then
    raise exception 'Unauthorized: only staff or the assigned agent can update referral status';
  end if;

  if v_referral.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'Referral is already in a terminal status (%) and cannot be changed', v_referral.status;
  end if;

  if p_new_status not in ('pending', 'verified', 'assigned', 'in_process', 'completed', 'cancelled', 'rejected') then
    raise exception 'Invalid status %', p_new_status;
  end if;

  v_old_status := v_referral.status;

  if p_eligible_amount is not null then
    update public.referrals set eligible_amount = p_eligible_amount where id = p_referral_id;
  end if;

  update public.referrals
  set status = p_new_status,
      notes = coalesce(p_notes, notes),
      completed_at = case when p_new_status = 'completed' then now() else completed_at end
  where id = p_referral_id;

  insert into public.referral_activities (referral_id, actor_id, activity_type, title, old_value, new_value, notes, is_system)
  values (p_referral_id, auth.uid(),
    case p_new_status when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'rejected' then 'rejected' else 'status_changed' end,
    'Referral status changed to ' || p_new_status, v_old_status, p_new_status, p_notes, false);

  if p_new_status = 'completed' then
    v_commission_id := public.fn_generate_commission(p_referral_id);
  end if;

  return jsonb_build_object('success', true, 'referral_id', p_referral_id, 'status', p_new_status, 'commission_id', v_commission_id);
end;
$$;

grant execute on function public.fn_update_referral_status(uuid, text, text, numeric) to authenticated;

-- =========================================================
-- I. Commission approval / rejection / hold — admin only, credits wallet
-- =========================================================
create or replace function public.fn_approve_commission(p_commission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission   record;
  v_partner_user uuid;
  v_wallet_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: only admin can approve commissions';
  end if;

  select * into v_commission from public.partner_commissions where id = p_commission_id;
  if not found then raise exception 'Commission not found'; end if;
  if v_commission.status not in ('created', 'pending') then
    raise exception 'Commission is not in an approvable status (current: %)', v_commission.status;
  end if;

  select p.user_id into v_partner_user from public.partners p where p.id = v_commission.partner_id;
  if v_partner_user is null then raise exception 'Partner account not found for this commission'; end if;

  select id into v_wallet_id from public.wallets where user_id = v_partner_user;
  if v_wallet_id is null then raise exception 'Wallet not found for partner'; end if;

  update public.partner_commissions
  set status = 'payable', approved_by = auth.uid(), approved_at = now()
  where id = p_commission_id;

  update public.wallets set balance = balance + v_commission.commission_amount where id = v_wallet_id;

  insert into public.wallet_transactions (wallet_id, transaction_type, amount, description, reference_id, reference_type)
  values (v_wallet_id, 'credit', v_commission.commission_amount,
    'Commission ' || v_commission.commission_code, p_commission_id, 'commission');

  perform public.fn_log_audit('commission_approved', 'partner_commissions', p_commission_id::text,
    jsonb_build_object('approved_by', auth.uid(), 'amount', v_commission.commission_amount), 'info', null);

  perform public.notify_user(v_partner_user, 'commission_approved',
    'Commission Approved', 'Commission ' || v_commission.commission_code || ' has been approved and credited to your wallet.', '/partner');

  return jsonb_build_object('success', true, 'commission_id', p_commission_id, 'amount', v_commission.commission_amount);
end;
$$;

grant execute on function public.fn_approve_commission(uuid) to authenticated;

create or replace function public.fn_reject_commission(p_commission_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission   record;
  v_partner_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: only admin can reject commissions';
  end if;

  select * into v_commission from public.partner_commissions where id = p_commission_id;
  if not found then raise exception 'Commission not found'; end if;
  if v_commission.status in ('paid', 'rejected') then
    raise exception 'Commission cannot be rejected from status %', v_commission.status;
  end if;

  update public.partner_commissions
  set status = 'rejected', notes = coalesce(p_reason, notes)
  where id = p_commission_id;

  perform public.fn_log_audit('commission_rejected', 'partner_commissions', p_commission_id::text,
    jsonb_build_object('rejected_by', auth.uid(), 'reason', p_reason), 'warning', null);

  select p.user_id into v_partner_user from public.partners p where p.id = v_commission.partner_id;
  if v_partner_user is not null then
    perform public.notify_user(v_partner_user, 'commission_rejected',
      'Commission Rejected', 'Commission ' || v_commission.commission_code || ' was rejected.' ||
        case when p_reason is not null then ' Reason: ' || p_reason else '' end, '/partner');
  end if;

  return jsonb_build_object('success', true, 'commission_id', p_commission_id);
end;
$$;

grant execute on function public.fn_reject_commission(uuid, text) to authenticated;

create or replace function public.fn_hold_commission(p_commission_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission record;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: only admin can hold commissions';
  end if;

  select * into v_commission from public.partner_commissions where id = p_commission_id;
  if not found then raise exception 'Commission not found'; end if;
  if v_commission.status in ('paid', 'rejected') then
    raise exception 'Commission cannot be put on hold from status %', v_commission.status;
  end if;

  update public.partner_commissions
  set status = 'on_hold', notes = coalesce(p_reason, notes)
  where id = p_commission_id;

  perform public.fn_log_audit('commission_on_hold', 'partner_commissions', p_commission_id::text,
    jsonb_build_object('held_by', auth.uid(), 'reason', p_reason), 'warning', null);

  return jsonb_build_object('success', true, 'commission_id', p_commission_id);
end;
$$;

grant execute on function public.fn_hold_commission(uuid, text) to authenticated;
