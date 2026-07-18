'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { AuthShell } from '@/components/layout/auth-shell';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // If already logged in, redirect to the correct hub.
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace('/dashboard');
  }, [user, authLoading, router]);

  if (authLoading || user) return null;

  const passwordChecks = [
    { label: '8+ characters',    ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Number',           ok: /[0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    const failed = passwordChecks.find((c) => !c.ok);
    if (failed) { setError(`Password must include: ${failed.label}`); return; }

    setIsSubmitting(true);

    const { error: signUpError } = await signUp(email, password, fullName);

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'An account with this email already exists. Try signing in instead.'
          : signUpError.message
      );
      setIsSubmitting(false);
      return;
    }

    // Redirect immediately — the trigger will create the profile row,
    // and onboarding has a SECURITY DEFINER fallback if the trigger races.
    router.push('/onboarding');
  };

  const strengthCount = passwordChecks.filter((c) => c.ok).length;
  const strengthColors = ['bg-destructive', 'bg-warning', 'bg-warning', 'bg-success'];

  return (
    <AuthShell>
      <div className="space-y-1 mb-6">
        <h2 className="font-display text-2xl font-semibold">Create your account</h2>
        <p className="text-muted-foreground text-sm">Start your SAT prep journey today</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="new-password"
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
          {password && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      i < strengthCount ? strengthColors[strengthCount - 1] : 'bg-muted'
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {passwordChecks.map((c) => (
                  <span
                    key={c.label}
                    className={cn('text-xs flex items-center gap-1', c.ok ? 'text-success' : 'text-muted-foreground')}
                  >
                    <CheckCircle2 className={cn('h-3 w-3', c.ok ? 'text-success' : 'opacity-30')} />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="new-password"
            className={cn(confirmPassword && password !== confirmPassword && 'border-destructive')}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords don&apos;t match</p>
          )}
        </div>
        <div className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90"
            disabled={isSubmitting || (confirmPassword.length > 0 && password !== confirmPassword)}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
            ) : (
              'Create account'
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
