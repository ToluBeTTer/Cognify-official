/*
  Fix creator_profiles INSERT policy for admin role changes
  
  The creator_profiles_admin_all policy with polcmd='*' was not properly
  allowing INSERT operations when admins change users to creator role.
  This adds an explicit INSERT policy for admins.
*/

-- Drop the old policies that will conflict
DROP POLICY IF EXISTS creator_profiles_admin_all ON public.creator_profiles;
DROP POLICY IF EXISTS creator_profiles_select_own ON public.creator_profiles;

-- Create explicit policies for each operation

-- SELECT: Admins can see all
CREATE POLICY "creator_profiles_select_admin" ON public.creator_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  ));

-- SELECT: Users can see their own creator profile
CREATE POLICY "creator_profiles_select_own" ON public.creator_profiles
  FOR SELECT TO authenticated
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- INSERT: Admins can insert (for role changes)
CREATE POLICY "creator_profiles_insert_admin" ON public.creator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  ));

-- UPDATE: Admins can update
CREATE POLICY "creator_profiles_update_admin" ON public.creator_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  ));

-- DELETE: Admins can delete
CREATE POLICY "creator_profiles_delete_admin" ON public.creator_profiles
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  ));