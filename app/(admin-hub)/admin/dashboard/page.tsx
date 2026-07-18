'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  Users, Inbox, CheckSquare, Clock, TrendingUp,
  ArrowRight, Loader2, AlertTriangle, FileCheck,
  BarChart3,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalCreators: number;
  openRequests: number;
  pendingApprovals: number;
  completedResponses: number;
  totalQuestions: number;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [usersRes, creatorsRes, openReqRes, pendingRes, completedRes, questionsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'creator'),
        supabase.from('questions').select('id', { count: 'exact' }).in('status', ['human_requested']).is('deleted_at', null),
        supabase.from('human_responses').select('id', { count: 'exact' }).eq('is_approved', false).eq('status', 'ready'),
        supabase.from('human_responses').select('id', { count: 'exact' }).eq('is_approved', true),
        supabase.from('questions').select('id', { count: 'exact' }).is('deleted_at', null),
      ]);

      setStats({
        totalUsers: usersRes.count ?? 0,
        totalCreators: creatorsRes.count ?? 0,
        openRequests: openReqRes.count ?? 0,
        pendingApprovals: pendingRes.count ?? 0,
        completedResponses: completedRes.count ?? 0,
        totalQuestions: questionsRes.count ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Admin Dashboard" subtitle="Platform overview and management tools." />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Alerts */}
          {stats && stats.pendingApprovals > 0 && (
            <Card className="border-warning/25 bg-warning/10">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                    <p className="text-sm font-medium text-warning">
                      {stats.pendingApprovals} response{stats.pendingApprovals !== 1 ? 's' : ''} waiting for your approval
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="border-warning/25 text-warning hover:bg-warning/10">
                    <Link href="/admin/completed">Review Now <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total users</p>
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
                    <p className="text-2xl font-bold">{stats?.totalCreators ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Active tutors</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <Inbox className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.openRequests ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Open requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.pendingApprovals ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Pending approvals</p>
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
                    <p className="text-2xl font-bold">{stats?.completedResponses ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Approved responses</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-purple" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalQuestions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/queue">
                <Inbox className="h-5 w-5 text-destructive" />
                <span className="font-medium">Request Queue</span>
                <span className="text-xs text-muted-foreground">{stats?.openRequests ?? 0} open</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/completed">
                <CheckSquare className="h-5 w-5 text-warning" />
                <span className="font-medium">Approvals</span>
                <span className="text-xs text-muted-foreground">{stats?.pendingApprovals ?? 0} pending</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/creators">
                <Users className="h-5 w-5 text-info" />
                <span className="font-medium">Manage Tutors</span>
                <span className="text-xs text-muted-foreground">{stats?.totalCreators ?? 0} tutors</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/claims">
                <FileCheck className="h-5 w-5 text-success" />
                <span className="font-medium">All Claims</span>
                <span className="text-xs text-muted-foreground">Track activity</span>
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
