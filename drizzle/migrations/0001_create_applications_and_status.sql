-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE,
  institution_name TEXT NOT NULL,
  institution_type TEXT,
  institution_address TEXT,
  state TEXT,
  district TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  institution_registration_number TEXT,
  application_title TEXT NOT NULL,
  external_reference_number TEXT,
  academic_year TEXT,
  application_category TEXT,
  description TEXT,
  additional_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','processing','action_required','manual_review','verified','rejected')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ,
  assigned_reviewer_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.application_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_application_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
    NEW.application_number := 'VER-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.application_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_set_number
BEFORE INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_application_number();

CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Status-transition guard: only admins record verified/rejected; institutions can only
-- submit (draft->submitted, action_required->submitted); reviewers only act on assigned apps.
CREATE OR REPLACE FUNCTION public.guard_application_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated update rejected';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Application ownership cannot be changed';
  END IF;

  IF NEW.assigned_reviewer_id IS DISTINCT FROM OLD.assigned_reviewer_id
     AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign reviewers';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('verified', 'rejected') THEN
      IF NOT public.has_role(v_uid, 'admin') THEN
        RAISE EXCEPTION 'Only authorized admins can record final decisions';
      END IF;
    ELSIF public.has_role(v_uid, 'admin') THEN
      NULL; -- admins may set any workflow status
    ELSIF public.has_role(v_uid, 'reviewer') THEN
      IF OLD.assigned_reviewer_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Reviewers can only update applications assigned to them';
      END IF;
      IF NEW.status NOT IN ('processing', 'action_required', 'manual_review') THEN
        RAISE EXCEPTION 'Reviewers cannot set this status';
      END IF;
    ELSIF OLD.created_by = v_uid THEN
      IF NOT (
        (OLD.status = 'draft' AND NEW.status = 'submitted') OR
        (OLD.status = 'action_required' AND NEW.status = 'submitted')
      ) THEN
        RAISE EXCEPTION 'Institution users can only submit applications for verification';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not permitted to update this application';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_guard_update
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_application_update();

-- Status history
CREATE TABLE public.application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_application ON public.application_status_history(application_id, created_at);

CREATE OR REPLACE FUNCTION public.record_status_history()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.application_status_history (application_id, previous_status, new_status, changed_by)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_status_history_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.application_status_history (application_id, previous_status, new_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_status_history_update
AFTER UPDATE ON public.applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.record_status_history();

CREATE TRIGGER applications_status_history_insert
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.record_status_history_created();

-- Review comments (visibility: 'institution' visible to applicant, 'internal' staff-only)
CREATE TABLE public.review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'institution' CHECK (visibility IN ('institution','internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_comments_application ON public.review_comments(application_id, created_at);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'general',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- Indexes
CREATE INDEX idx_applications_created_by ON public.applications(created_by, updated_at DESC);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_reviewer ON public.applications(assigned_reviewer_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT ON public.application_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.review_comments TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.applications TO service_role;
GRANT ALL ON public.application_status_history TO service_role;
GRANT ALL ON public.review_comments TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.application_number_seq TO authenticated;

-- RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view application"
ON public.applications FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Owner can create application"
ON public.applications FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or staff can update application"
ON public.applications FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Owner can delete draft application"
ON public.applications FOR DELETE TO authenticated
USING (created_by = auth.uid() AND status = 'draft');

CREATE POLICY "Participants can view status history"
ON public.application_status_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = application_id
    AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
));

CREATE POLICY "Participants can comment"
ON public.review_comments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_id
      AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
  )
  AND (visibility = 'internal' OR public.is_staff(auth.uid()) OR
       EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.created_by = auth.uid()))
);

CREATE POLICY "Institution sees only institution-visible comments"
ON public.review_comments FOR SELECT TO authenticated
USING (
  visibility = 'institution'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_id AND a.created_by = auth.uid()
  )
  OR public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_id
      AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
      AND visibility = 'institution'
  )
);

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());