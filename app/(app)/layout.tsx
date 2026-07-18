'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth, getRoleDashboard } from '@/lib/supabase';
import { StudentSidebar } from '@/components/layout/student-sidebar';
import { AppHeader } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';

// Lazy load Milo — it's a heavy component not needed for initial render
const FloatingMilo = dynamic(
  () => import('@/components/mascot/floating-milo').then((mod) => mod.FloatingMilo),
  { ssr: false }
);

/**
 * Shell for the student authenticated routes.
 * Creators and admins have their own dedicated hubs at /creator and /admin
 * and should be redirected there when accessing student routes.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
    if (profile && profile.role !== 'student') {
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

  if (!user || !isOnboarded) return null;
  if (profile && profile.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-background">
      <StudentSidebar />
      <div className="lg:pl-64">
        <AppHeader />
        <main className="p-6 lg:p-8 pb-24">{children}</main>
      </div>
      <FloatingMilo />
    </div>
  );
}
