'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getRoleDashboard } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * `/dashboard` — universal post-login landing point.
 *
 * Waits for auth + profile to fully resolve, then sends the user to the
 * correct hub based on their role and onboarding state.  Never routes while
 * isLoading is true so profile?.role is always accurate when we decide.
 */
export default function DashboardRouter() {
  const { user, profile, isLoading, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;                          // wait for profile to load
    if (!user) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
    router.replace(getRoleDashboard(profile?.role));
  }, [user, profile, isLoading, isOnboarded, router]);

  // Always show a spinner — this page never renders visible content.
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
