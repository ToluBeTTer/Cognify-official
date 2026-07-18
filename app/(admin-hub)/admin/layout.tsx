'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getRoleDashboard } from '@/lib/supabase';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
    // Wrong role — send directly to their own hub, no /dashboard round-trip.
    if (profile && profile.role !== 'admin') {
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

  if (!user || !isOnboarded || (profile && profile.role !== 'admin')) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64 min-h-screen">
        <AdminHeader />
        <main className="p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
