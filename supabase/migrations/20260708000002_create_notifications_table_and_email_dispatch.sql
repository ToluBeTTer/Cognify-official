-- The `notifications` table has been inserted into (see the
-- notify_student_human_response trigger and several frontend mutations)
-- and read from (hooks/use-notifications.ts) since early in this project,
-- but it was never actually created in any migration. It must currently
-- exist only because someone created it by hand in the Supabase dashboard —
-- meaning this migration history could not rebuild the current schema from
-- scratch. This creates it properly (idempotent, so safe to run whether or
-- not it already exists in your live project).

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  human_response_id uuid REFERENCES public.human_responses(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_unread_idx
  ON public.notifications (user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts happen from SECURITY DEFINER trigger functions and from
-- authenticated admin/creator actions on behalf of a student, so allow any
-- authenticated caller to insert (the row's own user_id is what governs
-- visibility via the SELECT policy above).
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- === Real email delivery ===
--
-- This does NOT send email by itself — it calls out to a Supabase Edge
-- Function (supabase/functions/send-notification-email) via pg_net, which
-- is what actually talks to an email provider. Setup required after
-- deploying that function (see the function's own comments for the
-- one-time setup commands):
--
--   1. supabase functions deploy send-notification-email
--   2. supabase secrets set RESEND_API_KEY=...
--   3. Run once, from the SQL editor, with your own project values:
--        alter database postgres set app.settings.supabase_url = 'https://<project-ref>.supabase.co';
--        alter database postgres set app.settings.service_role_key = '<service-role-key>';
--
-- Until that's done, this trigger safely no-ops (wrapped in EXCEPTION so a
-- misconfigured or not-yet-deployed webhook can never block or roll back
-- the actual notification insert — the in-app notification always lands
-- either way).

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_notification_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);

    IF v_url IS NOT NULL AND v_key IS NOT NULL AND v_url <> '' AND v_key <> '' THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object(
          'notification_id', NEW.id,
          'user_id', NEW.user_id,
          'type', NEW.type,
          'title', NEW.title,
          'message', NEW.message
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never let an email-dispatch problem block the notification itself.
    RAISE WARNING 'dispatch_notification_email failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_notification_email ON public.notifications;
CREATE TRIGGER trg_dispatch_notification_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_notification_email();
