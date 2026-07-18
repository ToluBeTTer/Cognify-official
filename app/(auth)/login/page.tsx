'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell } from '@/components/layout/auth-shell';

type Mode = 'login' | 'forgot' | 'forgot_sent';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const { signIn, user, isOnboarded, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect once auth + profile are fully resolved.
  // Always go to /dashboard — it reads profile.role and routes to the right hub.
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(isOnboarded ? '/dashboard' : '/onboarding');
  }, [user, isOnboarded, authLoading, router]);

  if (authLoading || user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : signInError.message
      );
      setIsLoading(false);
    }
    // On success auth context will update user → useEffect redirects
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings`,
    });

    setIsLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setMode('forgot_sent');
    }
  };

  if (mode === 'forgot_sent') {
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="font-display text-2xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground">
            We sent a password reset link to <strong>{email}</strong>.
            Check your inbox and follow the link to set a new password.
          </p>
          <Button variant="outline" className="w-full" onClick={() => { setMode('login'); setError(null); }}>
            Back to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthShell>
        <div className="space-y-1 mb-6">
          <h2 className="font-display text-2xl font-semibold">Reset password</h2>
          <p className="text-muted-foreground text-sm">Enter your email and we'll send a reset link</p>
        </div>
        <form onSubmit={handleForgotPassword} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : 'Send Reset Link'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setMode('login'); setError(null); }}>
              Back to sign in
            </Button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-1 mb-6">
        <h2 className="font-display text-2xl font-semibold">Welcome back</h2>
        <p className="text-muted-foreground text-sm">Sign in to continue your SAT prep journey</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => { setMode('forgot'); setError(null); }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : 'Sign in'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
