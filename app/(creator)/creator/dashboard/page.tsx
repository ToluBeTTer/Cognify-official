'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  Inbox, FileCheck, CheckSquare, Star, Clock,
  ArrowRight, Loader2, TrendingUp, AlertCircle,
} from 'lucide-react';

interface CreatorStats {
  queueCount: number;
  activeClaims: number;
  completedTotal: number;
  averageRating: number | null;
}

interface ActiveClaim {
  id: string;
  question_id: string;
  status: string;
  claimed_at: string;
  questions: { title: string | null; content: string } | null;
}

export default function CreatorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [activeClaims, setActiveClaims] = useState<ActiveClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [queueRes, claimsRes, completedRes, creatorProfileRes] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact' }).eq('status', 'human_requested').is('deleted_at', null),
        supabase.from('question_claims').select('id, question_id, status, claimed_at, questions(title, content)').eq('creator_id', user.id).in('status', ['claimed', 'in_progress']),
        supabase.from('question_claims').select('id', { count: 'exact' }).eq('creator_id', user.id).eq('status', 'completed'),
        supabase.from('creator_profiles').select('average_rating').eq('profile_id', profile?.id ?? '').maybeSingle(),
      ]);

      setStats({
        queueCount: queueRes.count ?? 0,
        activeClaims: (claimsRes.data ?? []).length,
        completedTotal: completedRes.count ?? 0,
        averageRating: creatorProfileRes.data?.average_rating ?? null,
      });

      setActiveClaims((claimsRes.data ?? []) as unknown as ActiveClaim[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Tutor Dashboard" subtitle={`Welcome back, ${firstName}. Help students master the SAT.`} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                    <Inbox className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.queueCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Open requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.activeClaims ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Active claims</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckSquare className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.completedTotal ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Star className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {stats?.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Active Claims */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Active Claims</h2>
                <Link href="/creator/claims" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {activeClaims.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center">
                    <FileCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No active claims. Browse the queue to get started.</p>
                    <Button asChild size="sm" className="mt-4">
                      <Link href="/creator/queue">Browse Requests</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeClaims.map((claim) => (
                    <Link key={claim.id} href={`/creator/respond/${claim.question_id}`}>
                      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                        <CardContent className="py-3 px-4 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {claim.questions?.title || claim.questions?.content?.substring(0, 80) || 'Untitled question'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">
                                {claim.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Claimed {new Date(claim.claimed_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="font-semibold text-base">Quick Actions</h2>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Link href="/creator/queue">
                    <Inbox className="h-4 w-4 text-info" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Request Queue</p>
                      <p className="text-xs text-muted-foreground">{stats?.queueCount ?? 0} open requests</p>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Link href="/creator/claims">
                    <FileCheck className="h-4 w-4 text-warning" />
                    <div className="text-left">
                      <p className="text-sm font-medium">My Claims</p>
                      <p className="text-xs text-muted-foreground">Continue your work</p>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Link href="/creator/completed">
                    <CheckSquare className="h-4 w-4 text-success" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-muted-foreground">Review past work</p>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Link href="/profile">
                    <TrendingUp className="h-4 w-4 text-purple" />
                    <div className="text-left">
                      <p className="text-sm font-medium">My Profile</p>
                      <p className="text-xs text-muted-foreground">Update your expertise</p>
                    </div>
                  </Link>
                </Button>
              </div>

              {stats?.queueCount && stats.queueCount > 0 ? (
                <Card className="border-info/25 bg-info/10">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-info">
                        <strong>{stats.queueCount}</strong> student{stats.queueCount !== 1 ? 's' : ''} waiting for help. Claim a request to get started.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
