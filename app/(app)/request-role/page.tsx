'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2, Shield, BookOpen, ArrowLeft, CheckCircle2, XCircle,
  Clock, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Database } from '@/lib/supabase';

type RoleRequest = Database['public']['Tables']['role_requests']['Row'];

export default function RequestRolePage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<RoleRequest | null>(null);
  const [requestedRole, setRequestedRole] = useState<'creator' | 'admin'>('creator');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!user) return;
    loadExistingRequest();
  }, [user]);

  const loadExistingRequest = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('role_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setExistingRequest(data);
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('role_requests')
        .insert({
          user_id: user.id,
          existing_role: profile.role,
          requested_role: requestedRole,
          reason: reason || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('You already have a pending request');
        } else if (error.message?.includes('valid_role_change')) {
          toast.error('You cannot request this role from your current role');
        } else {
          throw error;
        }
      } else {
        toast.success('Role request submitted');
        loadExistingRequest();
      }
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(`Failed to submit request: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!existingRequest) return;

    try {
      const { error } = await supabase
        .from('role_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', existingRequest.id);

      if (error) throw error;
      toast.success('Request cancelled');
      setExistingRequest(null);
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      toast.error(`Failed to cancel request: ${error?.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (profile.role === 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>You are an Admin</CardTitle>
            <CardDescription>Your account already has admin privileges.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/admin/dashboard">Go to Admin Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (profile.role === 'creator') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>You are a Creator</CardTitle>
            <CardDescription>Your account has creator/tutor privileges.</CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-3">
            <Button asChild>
              <Link href="/creator/dashboard">Go to Creator Dashboard</Link>
            </Button>
            <Button variant="outline" onClick={() => { setRequestedRole('admin'); setExistingRequest(null); }}>
              Request Admin Access
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; title: string; description: string }> = {
    pending: {
      icon: <Clock className="h-5 w-5" />,
      color: 'bg-warning/10 text-warning',
      title: 'Request Pending',
      description: 'Your request is being reviewed by an administrator.',
    },
    approved: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-success/10 text-success',
      title: 'Request Approved',
      description: 'Your role has been updated. Please refresh the page.',
    },
    rejected: {
      icon: <XCircle className="h-5 w-5" />,
      color: 'bg-destructive/10 text-destructive',
      title: 'Request Rejected',
      description: 'Your request was not approved. You can submit a new request.',
    },
  };

  if (existingRequest && existingRequest.status !== 'cancelled') {
    const config = statusConfig[existingRequest.status] || statusConfig.pending;
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/student/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              {config.icon}
              <Badge className={config.color}>{existingRequest.status}</Badge>
            </div>
            <CardTitle>{config.title}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Role</p>
                <p className="font-medium capitalize">{existingRequest.existing_role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requested Role</p>
                <p className="font-medium capitalize">{existingRequest.requested_role}</p>
              </div>
            </div>
            {existingRequest.reason && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Your Reason</p>
                <p className="text-sm bg-muted p-3 rounded-lg">{existingRequest.reason}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="text-sm">{new Date(existingRequest.created_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
          {existingRequest.status === 'pending' && (
            <CardFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancel Request
              </Button>
            </CardFooter>
          )}
          {existingRequest.status === 'approved' && (
            <CardFooter>
              <Button asChild>
                <Link href={requestedRole === 'admin' ? '/admin/dashboard' : '/creator/dashboard'}>
                  Go to {requestedRole === 'admin' ? 'Admin' : 'Creator'} Dashboard
                </Link>
              </Button>
            </CardFooter>
          )}
          {existingRequest.status === 'rejected' && (
            <CardFooter>
              <Button onClick={() => setExistingRequest(null)}>
                Submit New Request
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/student/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Request Elevated Access</CardTitle>
          <CardDescription>
            Submit a request to become a Creator or Admin. An administrator will review your request.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Access requests are reviewed by the Cognify team. If you&apos;re a team member, ensure your email has been whitelisted by an admin before requesting.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Request Role</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestedRole('creator')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    requestedRole === 'creator'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-warning" />
                    </div>
                    <span className="font-semibold">Creator / Tutor</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Help students by providing expert explanations to their questions.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestedRole('admin')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    requestedRole === 'admin'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-destructive" />
                    </div>
                    <span className="font-semibold">Admin</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Full platform access: manage users, approve requests, and oversee operations.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional but recommended)</Label>
              <Textarea
                id="reason"
                placeholder="Tell us why you'd like this role and any relevant experience..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}