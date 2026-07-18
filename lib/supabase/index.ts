export { supabase } from './client';
export type { Database, Json } from './client';
export { AuthProvider, useAuth } from './auth-context';

/** Returns the home route for each role after login/onboarding. */
export function getRoleDashboard(role: string | null | undefined): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'creator') return '/creator/dashboard';
  return '/student/dashboard';
}
