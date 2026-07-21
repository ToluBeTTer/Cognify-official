-- This project has hit a documented Supabase/PostgREST bug where schema
-- cache reload notifications aren't reliably delivered after migrations
-- (tracked upstream: supabase/supabase#42183). Manual NOTIFY commands and
-- project restarts have been needed to work around it on every push.
--
-- This event trigger makes that automatic going forward: Postgres itself
-- fires it after every DDL statement (CREATE/ALTER/DROP on tables,
-- functions, etc.), which sends the reload notification without anyone
-- needing to remember to. This does not fix an already-stale cache right
-- now — that still needs a manual reload once — but it should stop this
-- from happening again after future migrations.

CREATE OR REPLACE FUNCTION public.pgrst_watch()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch ON ddl_command_end
  EXECUTE PROCEDURE public.pgrst_watch();
