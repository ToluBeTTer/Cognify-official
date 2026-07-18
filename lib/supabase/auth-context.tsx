'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from './client';
import type { Database } from './client';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  /**
   * True until the initial session check AND the profile load are both complete.
   * Safe to use as a single "app is still initializing" gate.
   */
  isLoading: boolean;
  isOnboarded: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Load profile for a user.  If no row exists yet (DB trigger race), calls
 * the SECURITY DEFINER ensure_profile_exists RPC to create it deterministically.
 */
async function loadProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[auth] loadProfile select error:', error);
    return null;
  }

  if (data) return data;

  // No row yet — create it via the SECURITY DEFINER fallback.
  const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_profile_exists', {
    p_email: user.email ?? '',
    p_full_name: (user.user_metadata?.full_name as string) ?? null,
  });

  if (rpcError) {
    console.error('[auth] ensure_profile_exists error:', rpcError);
    return null;
  }

  return rpcData as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  /**
   * isLoading stays true until BOTH:
   *   1. the initial getSession() call resolves, AND
   *   2. the profile fetch (if there was a session) resolves.
   *
   * This means consumers can safely read `profile` once `isLoading === false`
   * without worrying about a profile-still-loading race.
   */
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return null;
    const p = await loadProfile(currentUser);
    setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Resolve the current session and immediately fetch the profile so that
    //    isLoading only clears after we have the full picture.
    const initialize = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const p = await loadProfile(currentSession.user);
        if (mounted) setProfile(p);
      }

      // Only now is the app ready to make routing decisions.
      if (mounted) setIsLoading(false);
    };

    initialize();

    // 2. Subscribe to future auth events (sign-in after initial load, sign-out,
    //    token refresh, etc.).  We do NOT touch isLoading here — it is only ever
    //    used as an "initial bootstrap" gate and must not flip back to true after
    //    initialization, which would break pages that already rendered.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' && newSession?.user) {
        // Must wrap in async IIFE — Supabase deadlocks if you await inside
        // onAuthStateChange directly.
        (async () => {
          const p = await loadProfile(newSession.user!);
          if (mounted) setProfile(p);
        })();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        (async () => {
          const p = await loadProfile(newSession.user!);
          if (mounted) setProfile(p);
        })();
      }
    });

    // 3. Watch for profile row changes (e.g. role updated by admin) so the user's
    //    UI updates automatically without requiring a page reload.
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    const startProfileWatch = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || !mounted) return;
      profileChannel = supabase
        .channel(`profile-${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${currentUser.id}` },
          async () => {
            if (!mounted) return;
            const p = await loadProfile(currentUser);
            if (mounted) setProfile(p);
          }
        )
        .subscribe();
    };
    startProfileWatch();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      profileChannel?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return { error };
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    router.push('/login');
  }, [router]);

  const isOnboarded = profile?.onboarding_completed ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isOnboarded,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
