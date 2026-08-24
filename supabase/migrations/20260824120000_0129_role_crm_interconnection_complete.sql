-- =============================================================================
-- Migration: 20260824120000_0129_role_crm_interconnection_complete.sql
-- Description: Multi-Role Interconnected CRM Backend & Real-Time Data Architecture
--              Agent <-> Builder <-> Partner <-> Business Partner <-> Admin
-- =============================================================================

-- ============================================================
-- 1. B2B OPPORTUNITIES TABLE (Business Partner / Enterprise CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.b2b_opportunities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  company_name        TEXT NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT,
  contact_phone       TEXT,
  deal_size           NUMERIC(15,2) NOT NULL DEFAULT 0,
  stage               TEXT NOT NULL DEFAULT 'discovery' CHECK (
                        stage IN ('discovery', 'proposal', 'commercials', 'negotiation', 'won', 'lost')
                      ),
  probability         INTEGER NOT NULL DEFAULT 20 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  assigned_to         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_opps_partner ON public.b2b_opportunities(partner_id);
CREATE INDEX IF NOT EXISTS idx_b2b_opps_stage ON public.b2b_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_b2b_opps_assigned ON public.b2b_opportunities(assigned_to);

ALTER TABLE public.b2b_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "b2b_opps_select" ON public.b2b_opportunities;
CREATE POLICY "b2b_opps_select" ON public.b2b_opportunities
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "b2b_opps_insert" ON public.b2b_opportunities;
CREATE POLICY "b2b_opps_insert" ON public.b2b_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "b2b_opps_update" ON public.b2b_opportunities;
CREATE POLICY "b2b_opps_update" ON public.b2b_opportunities
  FOR UPDATE TO authenticated
  USING (
    public.is_staff()
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR assigned_to = auth.uid()
  )
  WITH CHECK (true);

-- ============================================================
-- 2. B2B DEALS TABLE (High-Value Contracts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.b2b_deals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id      UUID REFERENCES public.b2b_opportunities(id) ON DELETE CASCADE,
  partner_id          UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  deal_value          NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_rate     NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  commission_amount   NUMERIC(15,2) GENERATED ALWAYS AS (deal_value * commission_rate / 100) STORED,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (
                        status IN ('draft', 'under_review', 'signed', 'invoiced', 'completed', 'cancelled')
                      ),
  payment_terms       TEXT DEFAULT 'Milestone-based 30/70 split upon handover',
  closed_date         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_deals_opp ON public.b2b_deals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_b2b_deals_partner ON public.b2b_deals(partner_id);

ALTER TABLE public.b2b_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "b2b_deals_select" ON public.b2b_deals;
CREATE POLICY "b2b_deals_select" ON public.b2b_deals
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "b2b_deals_all_staff" ON public.b2b_deals;
CREATE POLICY "b2b_deals_all_staff" ON public.b2b_deals
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 3. PROPERTY ASSIGNMENTS TABLE (Agent <-> Property Allocation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_assignments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_type           TEXT NOT NULL DEFAULT 'exclusive' CHECK (
                              assignment_type IN ('exclusive', 'open', 'lead_handler', 'primary_rm')
                            ),
  commission_split_percent  NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (
                              status IN ('active', 'paused', 'completed', 'revoked')
                            ),
  notes                     TEXT,
  assigned_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prop_assign_prop ON public.property_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_prop_assign_agent ON public.property_assignments(agent_id);

ALTER TABLE public.property_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prop_assign_select" ON public.property_assignments;
CREATE POLICY "prop_assign_select" ON public.property_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR agent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "prop_assign_staff" ON public.property_assignments;
CREATE POLICY "prop_assign_staff" ON public.property_assignments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 4. PROJECT APPROVALS TABLE (Builder Projects Approval Queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL,
  builder_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_name    TEXT NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (
                    status IN ('pending', 'under_review', 'approved', 'rejected', 'changes_requested')
                  ),
  reviewer_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proj_appr_project ON public.project_approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_appr_status ON public.project_approvals(status);

ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proj_appr_select" ON public.project_approvals;
CREATE POLICY "proj_appr_select" ON public.project_approvals
  FOR SELECT TO authenticated
  USING (public.is_staff() OR builder_id = auth.uid());

DROP POLICY IF EXISTS "proj_appr_staff" ON public.project_approvals;
CREATE POLICY "proj_appr_staff" ON public.project_approvals
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 5. ROLE COMPLIANCE DOCUMENTS TABLE (Multi-Role KYC & Legal)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_compliance_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_type             TEXT NOT NULL CHECK (role_type IN ('agent', 'builder', 'partner', 'business-partner')),
  entity_id             UUID,
  user_id               UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type         TEXT NOT NULL CHECK (
                          document_type IN (
                            'rera_certificate', 'aadhaar_pan', 'gst_certificate',
                            'fire_noc', 'land_title', 'sanction_plan',
                            'mou_agreement', 'cancelled_cheque', 'other'
                          )
                        ),
  title                 TEXT NOT NULL,
  file_url              TEXT NOT NULL,
  verification_status   TEXT NOT NULL DEFAULT 'pending' CHECK (
                          verification_status IN ('pending', 'verified', 'rejected')
                        ),
  verified_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_docs_role ON public.role_compliance_documents(role_type);
CREATE INDEX IF NOT EXISTS idx_role_docs_status ON public.role_compliance_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_role_docs_user ON public.role_compliance_documents(user_id);

ALTER TABLE public.role_compliance_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_docs_select" ON public.role_compliance_documents;
CREATE POLICY "role_docs_select" ON public.role_compliance_documents
  FOR SELECT TO authenticated
  USING (public.is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "role_docs_all_staff" ON public.role_compliance_documents;
CREATE POLICY "role_docs_all_staff" ON public.role_compliance_documents
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 6. STORED PROCEDURES & CANONICAL RPCs
-- ============================================================

-- RPC: Assign Property to Agent
CREATE OR REPLACE FUNCTION public.fn_assign_property_agent(
  p_property_id UUID,
  p_agent_id UUID,
  p_assignment_type TEXT DEFAULT 'exclusive',
  p_commission_split NUMERIC DEFAULT 50.0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only staff can assign properties to agents.';
  END IF;

  -- Update properties table assigned_agent_id
  UPDATE public.properties
  SET assigned_agent_id = p_agent_id, updated_at = now()
  WHERE id = p_property_id;

  -- Upsert into property_assignments
  INSERT INTO public.property_assignments (
    property_id, agent_id, assigned_by, assignment_type,
    commission_split_percent, status, notes, assigned_at
  ) VALUES (
    p_property_id, p_agent_id, auth.uid(), p_assignment_type,
    p_commission_split, 'active', p_notes, now()
  )
  RETURNING id INTO v_assignment_id;

  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id);
END;
$$;

-- RPC: Review Project Approval
CREATE OR REPLACE FUNCTION public.fn_review_project_approval(
  p_approval_id UUID,
  p_status TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only staff can review project approvals.';
  END IF;

  UPDATE public.project_approvals
  SET
    status = p_status,
    reviewer_id = auth.uid(),
    review_notes = p_review_notes,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_approval_id
  RETURNING project_id INTO v_project_id;

  IF v_project_id IS NOT NULL THEN
    -- If project exists in builder_projects or properties, update status
    UPDATE public.builder_projects
    SET status = CASE WHEN p_status = 'approved' THEN 'active' ELSE 'pending_approval' END
    WHERE id = v_project_id;

    UPDATE public.properties
    SET status = CASE WHEN p_status = 'approved' THEN 'approved' ELSE 'changes_requested' END
    WHERE id = v_project_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- RPC: Review Compliance Document
CREATE OR REPLACE FUNCTION public.fn_review_compliance_doc(
  p_doc_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only staff can verify compliance documents.';
  END IF;

  UPDATE public.role_compliance_documents
  SET
    verification_status = p_status,
    verified_by = auth.uid(),
    verified_at = now(),
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_doc_id;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- RPC: Process Payout Approval
CREATE OR REPLACE FUNCTION public.fn_process_payout_approval(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_tx_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only staff can process payout requests.';
  END IF;

  UPDATE public.withdrawal_requests
  SET
    status = p_status,
    transaction_ref = p_tx_reference,
    notes = p_notes,
    processed_at = now()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- ============================================================
-- 7. REALTIME PUBLICATION
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_opportunities;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_deals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.property_assignments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_approvals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.role_compliance_documents;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
