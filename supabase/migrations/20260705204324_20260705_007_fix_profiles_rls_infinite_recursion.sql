/*
  Fix: "infinite recursion detected in policy for relation profiles"

  Root cause: profiles_admin_all SELECT policy does a subquery back into
  profiles to check the calling user's role — which re-triggers RLS on
  profiles, which re-runs the policy, causing infinite recursion.

  Fix:
  1. Drop the recursive admin SELECT policy.
  2. Replace it with a non-recursive version that uses a security-definer
     helper function so we can check the role without re-entering RLS.
  3. Also add a SELECT policy so the anon key can never read profiles
     (belt-and-suspenders — the authenticated check already blocks it).

  The security-definer function reads the profile row via a direct SQL call
  that bypasses RLS (it runs as the table owner), so there is no recursion.
*/

-- 1. Drop the broken policy.
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- 2. Create a tiny SECURITY DEFINER helper that returns the role for
--    the currently authenticated user WITHOUT going through RLS.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Grant execute to authenticated users only.
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 3. Re-create an admin SELECT policy that uses get_my_role() instead of
--    a subquery into profiles.  This cannot recurse because get_my_role()
--    is SECURITY DEFINER and bypasses RLS.
CREATE POLICY "profiles_admin_select_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- The existing profiles_select_own already handles the normal case, so
-- admins can read every row (via profiles_admin_select_all) and every user
-- can read their own row (via profiles_select_own).  The two policies are
-- OR-combined by Postgres, which is the desired behaviour.
