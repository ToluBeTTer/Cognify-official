-- The admin Settings page has toggles for "Auto-approve whitelisted emails"
-- and "Require approval for creator applications" — both rendered as
-- `<Switch defaultChecked />` with no state, no onCheckedChange, and nothing
-- reading or writing any backend value. An admin could flip either one and
-- nothing would happen; the actual behavior was hardcoded regardless. This
-- creates a real place for these to live and wires both into the actual
-- mechanisms they claim to control.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- singleton row
  auto_approve_whitelisted_emails boolean NOT NULL DEFAULT true,
  require_creator_approval boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_select_admin" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "platform_settings_update_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_update_admin" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');


-- === Gate 1: auto-approve whitelisted emails ===
-- Same function as before, with one added check at the top. Everything
-- past that point is untouched from the original migration.
CREATE OR REPLACE FUNCTION public.handle_whitelisted_email_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_email public.approved_team_emails;
  v_profile public.profiles;
  v_auto_approve boolean;
BEGIN
  SELECT auto_approve_whitelisted_emails INTO v_auto_approve
  FROM public.platform_settings WHERE id = true;

  IF v_auto_approve IS FALSE THEN
    -- Toggled off platform-wide: leave the new user as a regular student.
    -- An admin can still promote them by hand via promote_whitelisted_user().
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = NEW.id LIMIT 1;

  SELECT * INTO v_approved_email
  FROM public.approved_team_emails
  WHERE email = NEW.email
    AND (is_used = false OR is_used IS NULL);

  IF FOUND THEN
    UPDATE public.profiles
    SET role = v_approved_email.intended_role,
        role_approved_at = now(),
        role_approved_by = NEW.id,
        updated_at = now()
    WHERE user_id = NEW.id;

    IF v_approved_email.intended_role = 'creator' THEN
      INSERT INTO public.creator_profiles (profile_id, approved_at)
      SELECT id, now() FROM public.profiles WHERE user_id = NEW.id
      ON CONFLICT (profile_id) DO UPDATE SET approved_at = now();
    END IF;

    UPDATE public.approved_team_emails
    SET is_used = true,
        used_at = now(),
        used_by = NEW.id,
        updated_at = now()
    WHERE id = v_approved_email.id;

    INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
    VALUES (
      NEW.id,
      'role_changed',
      NEW.id,
      jsonb_build_object('role', 'student'),
      jsonb_build_object('role', v_approved_email.intended_role),
      jsonb_build_object('source', 'whitelisted_email', 'email', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;


-- === Gate 2: require approval for creator applications ===
-- When this is switched off, a submitted role_request is immediately routed
-- through the exact same approve_role_request() RPC an admin would call by
-- hand — reusing that single source of truth rather than duplicating its
-- logic here, so "auto-approved" and "admin-approved" always behave
-- identically.
CREATE OR REPLACE FUNCTION public.maybe_auto_approve_role_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_require_approval boolean;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT require_creator_approval INTO v_require_approval
  FROM public.platform_settings WHERE id = true;

  IF v_require_approval IS FALSE THEN
    PERFORM public.approve_role_request(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maybe_auto_approve_role_request ON public.role_requests;
CREATE TRIGGER trg_maybe_auto_approve_role_request
  AFTER INSERT ON public.role_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_auto_approve_role_request();
