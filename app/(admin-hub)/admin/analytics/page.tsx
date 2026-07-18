'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  Users,
  FileQuestion,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  BookOpen,
  Loader2,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';

export default function AdminAnalyticsPage() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    students: 0,
    creators: 0,
    admins: 0,
    totalQuestions: 0,
    publishedQuestions: 0,
    totalSessions: 0,
    totalAttempts: 0,
    avgAccuracy: 0,
    pendingRequests: 0,
    pendingResponses: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // All of these used to .select(...) full row sets just to read
        // .length off the result — meaning this page downloaded every
        // profile, every question, every practice session, and every bank
        // attempt on every single visit. { count: 'exact', head: true }
        // gets the same number back with zero rows actually transferred.
        const countOf = (table: string) =>
          supabase.from(table).select('*', { count: 'exact', head: true });

        const [
          totalUsersRes,
          studentsRes,
          creatorsRes,
          adminsRes,
          totalQuestionsRes,
          publishedQuestionsRes,
          totalSessionsRes,
          totalAttemptsRes,
          correctAttemptsRes,
          pendingRequestsRes,
          pendingResponsesRes,
        ] = await Promise.all([
          countOf('profiles'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
          countOf('question_bank'),
          supabase.from('question_bank').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          countOf('practice_sessions'),
          countOf('bank_attempts'),
          supabase.from('bank_attempts').select('*', { count: 'exact', head: true }).eq('is_correct', true),
          supabase.from('role_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('human_responses').select('*', { count: 'exact', head: true }).eq('is_approved', false),
        ]);

        const totalAttempts = totalAttemptsRes.count || 0;
        const correctAttempts = correctAttemptsRes.count || 0;

        setStats({
          totalUsers: totalUsersRes.count || 0,
          students: studentsRes.count || 0,
          creators: creatorsRes.count || 0,
          admins: adminsRes.count || 0,
          totalQuestions: totalQuestionsRes.count || 0,
          publishedQuestions: publishedQuestionsRes.count || 0,
          totalSessions: totalSessionsRes.count || 0,
          totalAttempts,
          avgAccuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
          pendingRequests: pendingRequestsRes.count || 0,
          pendingResponses: pendingResponsesRes.count || 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Analytics" subtitle="Platform overview and metrics" />

      {/* User Stats */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Users
        </h2>
        <div className="grid gap-4 grid-cols-4">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} accentClassName="text-primary/40" />
          <StatCard icon={BookOpen} label="Students" value={stats.students} accentClassName="text-info/40" />
          <StatCard icon={Activity} label="Creators" value={stats.creators} accentClassName="text-warning/40" />
          <StatCard icon={Users} label="Admins" value={stats.admins} accentClassName="text-destructive/40" />
        </div>
      </div>

      {/* Question Bank Stats */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileQuestion className="h-5 w-5" />
          Question Bank
        </h2>
        <div className="grid gap-4 grid-cols-3">
          <StatCard icon={FileQuestion} label="Total Questions" value={stats.totalQuestions} accentClassName="text-primary/40" />
          <StatCard
            icon={CheckCircle2}
            label="Published"
            value={stats.publishedQuestions}
            accentClassName="text-success/40"
          />
          <StatCard
            icon={TrendingUp}
            label="Coverage"
            value={`${stats.totalQuestions > 0 ? Math.round((stats.publishedQuestions / stats.totalQuestions) * 100) : 0}%`}
            accentClassName="text-success/40"
          />
        </div>
      </div>

      {/* Practice Stats */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Practice
        </h2>
        <div className="grid gap-4 grid-cols-4">
          <StatCard icon={Clock} label="Sessions" value={stats.totalSessions} accentClassName="text-primary/40" />
          <StatCard icon={FileQuestion} label="Questions Answered" value={stats.totalAttempts} accentClassName="text-info/40" />
          <StatCard icon={TrendingUp} label="Avg Accuracy" value={`${stats.avgAccuracy}%`} accentClassName="text-success/40" />
          <StatCard
            icon={BarChart3}
            label="Questions/Session"
            value={stats.totalSessions > 0 ? Math.round(stats.totalAttempts / stats.totalSessions) : 0}
            accentClassName="text-purple/40"
          />
        </div>
      </div>

      {/* Queue Stats */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Items
        </h2>
        <div className="grid gap-4 grid-cols-2">
          <StatCard icon={Users} label="Role Requests" value={stats.pendingRequests} accentClassName="text-warning/40" />
          <StatCard icon={FileQuestion} label="Pending Responses" value={stats.pendingResponses} accentClassName="text-warning/40" />
        </div>
      </div>
    </div>
  );
}
