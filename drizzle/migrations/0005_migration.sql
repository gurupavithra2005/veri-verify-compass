-- Phase B/C extensions for SIH26261 implementation.

-- 1) Documents: per-field extraction evidence, extraction method, and reviewed corrections.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS extraction_evidence jsonb,
  ADD COLUMN IF NOT EXISTS field_corrections jsonb;

COMMENT ON COLUMN public.documents.extraction_method IS 'How text was obtained: pdf_text, ocr_image or ocr_pdf';
COMMENT ON COLUMN public.documents.extraction_evidence IS 'Per-field extraction metadata: value, source passage, confidence, method';
COMMENT ON COLUMN public.documents.field_corrections IS 'Human corrections to extracted fields, keeping the original extraction';

-- 2) Verification runs: which rule version and rule configuration produced the result.
ALTER TABLE public.verification_runs
  ADD COLUMN IF NOT EXISTS rules_version text,
  ADD COLUMN IF NOT EXISTS rules_snapshot jsonb;

COMMENT ON COLUMN public.verification_runs.rules_version IS 'Prototype rule-set version applied during this run';
COMMENT ON COLUMN public.verification_runs.rules_snapshot IS 'Snapshot of the requirements/checks configuration applied';

-- 3) Institutional records registry (admin-managed; synthetic demo records are clearly labelled).
CREATE TABLE public.institution_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name text NOT NULL,
  registration_number text,
  record_type text NOT NULL DEFAULT 'other',
  record_status text NOT NULL DEFAULT 'active',
  academic_year text,
  valid_from date,
  valid_until date,
  details jsonb,
  source_type text NOT NULL DEFAULT 'synthetic_demo',
  source_reference text,
  active boolean NOT NULL DEFAULT true,
  imported_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.institution_records IS 'Prototype institutional records registry. source_type=synthetic_demo rows are demonstration data, never official government records.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_records TO authenticated;
GRANT ALL ON public.institution_records TO service_role;
ALTER TABLE public.institution_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view institution records"
  ON public.institution_records FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins manage institution records"
  ON public.institution_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4) Authorized verification sources (admin-configured connectors; configured=false means Not Configured).
CREATE TABLE public.verification_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'authorized_api',
  base_domain text NOT NULL,
  endpoint_path text NOT NULL DEFAULT '/',
  lookup_param text NOT NULL DEFAULT 'ref',
  configured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.verification_sources IS 'Prototype connector registry for authorized external verification sources. Rows must only be added once a real, authorized integration exists.';
GRANT SELECT ON public.verification_sources TO authenticated;
GRANT ALL ON public.verification_sources TO service_role;
ALTER TABLE public.verification_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view verification sources"
  ON public.verification_sources FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins manage verification sources"
  ON public.verification_sources FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5) External verification attempts and outcomes (evidence record; never a fabricated success).
CREATE TABLE public.external_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id),
  document_id uuid REFERENCES public.documents(id),
  source_id uuid REFERENCES public.verification_sources(id),
  source_name text NOT NULL,
  source_domain text,
  lookup_field text,
  lookup_value text,
  status text NOT NULL DEFAULT 'not_configured',
  request_summary text,
  response_summary text,
  http_status integer,
  executed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.external_verifications IS 'Evidence of every external-source verification attempt, including explicit Not Configured / Source Unavailable states.';
GRANT SELECT, INSERT ON public.external_verifications TO authenticated;
GRANT ALL ON public.external_verifications TO service_role;
ALTER TABLE public.external_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view external verification attempts"
  ON public.external_verifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = external_verifications.application_id
      AND (a.created_by = auth.uid() OR is_staff(auth.uid()))
  ));
CREATE POLICY "Participants can record external verification attempts"
  ON public.external_verifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = external_verifications.application_id
      AND (a.created_by = auth.uid() OR is_staff(auth.uid()))
  ));

-- 6) Complete audit trail (service-role writes only; users can never insert, edit or delete events).
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id),
  actor_id uuid,
  actor_role text,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  previous_value text,
  new_value text,
  outcome text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.audit_events IS 'Append-only audit trail written by trusted backend code via the service-role client; not writable by end users.';
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = audit_events.application_id
      AND (a.created_by = auth.uid() OR is_staff(auth.uid()))
  ));

-- 7) Reuse the existing updated_at trigger helper for the new admin-managed tables.
CREATE TRIGGER institution_records_set_updated_at BEFORE UPDATE ON public.institution_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER verification_sources_set_updated_at BEFORE UPDATE ON public.verification_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();