-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  document_category TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  sha256_hash TEXT,
  ocr_status TEXT NOT NULL DEFAULT 'not_processed'
    CHECK (ocr_status IN ('not_processed','processing','completed','needs_review','failed')),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','passed','issues','failed')),
  extracted_text TEXT,
  extracted_fields JSONB,
  extraction_confidence NUMERIC(4,3),
  extraction_error TEXT,
  pages_processed INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_application ON public.documents(application_id, is_current);
CREATE INDEX idx_documents_hash ON public.documents(application_id, sha256_hash);

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Configurable required-document categories (prototype rules, not official AICTE checklist)
CREATE TABLE public.document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_category TEXT NOT NULL UNIQUE,
  requirement_name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER document_requirements_set_updated_at
BEFORE UPDATE ON public.document_requirements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verification runs
CREATE TABLE public.verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  run_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  checks_performed INTEGER NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  findings_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  executed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_verification_runs_application ON public.verification_runs(application_id, run_number DESC);

-- Verification findings
CREATE TABLE public.verification_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_run_id UUID NOT NULL REFERENCES public.verification_runs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  rule_code TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('missing_document','missing_information','information_mismatch','date_inconsistency','ocr_review_required','duplicate_file')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  field_name TEXT,
  application_value TEXT,
  document_value TEXT,
  explanation TEXT NOT NULL,
  recommended_action TEXT,
  finding_status TEXT NOT NULL DEFAULT 'open' CHECK (finding_status IN ('open','resolved')),
  resolution_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_findings_application ON public.verification_findings(application_id, finding_status);
CREATE INDEX idx_findings_run ON public.verification_findings(verification_run_id);

-- Report history
CREATE TABLE public.report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES public.profiles(id),
  report_type TEXT NOT NULL DEFAULT 'verification_report',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_history_application ON public.report_history(application_id, generated_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT ON public.document_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.verification_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.verification_findings TO authenticated;
GRANT SELECT, INSERT ON public.report_history TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.document_requirements TO service_role;
GRANT ALL ON public.verification_runs TO service_role;
GRANT ALL ON public.verification_findings TO service_role;
GRANT ALL ON public.report_history TO service_role;

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view documents"
ON public.documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Application owner can upload documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id AND a.created_by = auth.uid()
));

CREATE POLICY "Participants can update documents"
ON public.documents FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Application owner can delete documents"
ON public.documents FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id AND a.created_by = auth.uid()
));

CREATE POLICY "Authenticated users can view document requirements"
ON public.document_requirements FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "Admins manage document requirements"
ON public.document_requirements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants can view verification runs"
ON public.verification_runs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Participants can start verification runs"
ON public.verification_runs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Participants can update verification runs"
ON public.verification_runs FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Participants can view findings"
ON public.verification_findings FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Run executor can create findings"
ON public.verification_findings FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Staff can resolve findings"
ON public.verification_findings FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Participants can view report history"
ON public.report_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Participants can record report generation"
ON public.report_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));