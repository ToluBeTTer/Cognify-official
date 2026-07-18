'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getRoleDashboard } from '@/lib/supabase';
import { CreatorSidebar } from '@/components/layout/creator-sidebar';
import { CreatorHeader } from '@/components/layout/creator-header';
import { Loader2 } from 'lucide-react';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
    // Wrong role — send directly to their own hub, no /dashboard round-trip.
    if (profile && profile.role !== 'creator' && profile.role !== 'admin') {
      router.replace(getRoleDashboard(profile.role));
    }
  }, [user, profile, isLoading, isOnboarded, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isOnboarded || (profile && profile.role !== 'creator' && profile.role !== 'admin')) return null;

  return (
    <div className="min-h-screen bg-background">
      <CreatorSidebar />
      <div className="lg:pl-64 min-h-screen">
        <CreatorHeader />
        <main className="p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
