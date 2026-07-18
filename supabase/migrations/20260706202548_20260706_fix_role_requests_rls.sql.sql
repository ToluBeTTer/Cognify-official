-- Fix RLS policies that compare user_role correctly

-- Fix role_requests admin policies  
DROP POLICY IF EXISTS role_requests_admin_select ON role_requests;
DROP POLICY IF EXISTS role_requests_admin_update ON role_requests;

CREATE POLICY "role_requests_admin_select" ON role_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

CREATE POLICY "role_requests_admin_update" ON role_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );
