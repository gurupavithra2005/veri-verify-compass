-- Trusted backend operations (service_role, used only by server-side verification
-- engine code) may update workflow statuses; end users remain restricted.
CREATE OR REPLACE FUNCTION public.guard_application_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Service-role (trusted backend) requests carry no user id; allow them.
  IF v_uid IS NULL THEN
    RETURN NEW;
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