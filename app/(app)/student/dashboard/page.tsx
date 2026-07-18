'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  HelpCircle, Flame, TrendingUp, Clock, CheckCircle2, ArrowRight, Loader2, CalendarClock,
} from 'lucide-react';

interface Stats {
  totalQuestions: number;
  answeredQuestions: number;
  practiceAccuracy: number;
  streak: number;
  estimatedScore: number;
}

interface RecentQuestion {
  id: string;
  title: string | null;
  content: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-success/10 text-success',
  human_ready: 'bg-success/10 text-success',
  ai_ready: 'bg-info/10 text-info',
  human_requested: 'bg-warning/10 text-warning',
  pending: 'bg-muted text-muted-foreground',
  processing: 'bg-muted text-muted-foreground',
};

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([]);
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
      const [questionsRes, sessionRes, progressRes, recentRes, answeredStatesRes] = await Promise.all([
        supabase.from('questions').select('id, status').eq('user_id', user.id).is('deleted_at', null),
        supabase.from('practice_sessions').select('correct_answers, total_questions').eq('user_id', user.id).not('completed_at', 'is', null).limit(20),
        supabase.from('user_progress').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(30),
        supabase.from('questions').select('id, title, content, status, created_at').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
        // Needed for a difficulty-weighted score estimate instead of the old
        // flat accuracy-only formula (see estimatedScore below).
        supabase
          .from('session_question_states')
          .select('is_correct, practice_sessions!inner(user_id), question_bank!inner(difficulty)')
          .eq('practice_sessions.user_id', user.id)
          .eq('state', 'answered')
          .order('answered_at', { ascending: false })
          .limit(150),
      ]);

      const questions = questionsRes.data || [];
      const answered = questions.filter((q) => ['ai_ready', 'human_ready', 'completed'].includes(q.status)).length;

      const sessions = sessionRes.data || [];
      const totalCorrect = sessions.reduce((s, r) => s + (r.correct_answers || 0), 0);
      const totalQ = sessions.reduce((s, r) => s + (r.total_questions || 0), 0);
      const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

      // Difficulty-weighted estimate on the real SAT scale (400-1600, not
      // 400-1200 — the previous formula's cap was simply wrong). Weighting by
      // difficulty means getting every Hard question right counts for more
      // than an all-Easy streak, which the flat-accuracy version couldn't
      // distinguish between at all. Still a rough self-referential estimate,
      // not a calibrated prediction — the UI below labels it that way rather
      // than presenting it with false precision.
      const DIFFICULTY_WEIGHT: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
      const answeredStates = (answeredStatesRes.data || []) as any[];
      let weightedCorrect = 0;
      let weightedTotal = 0;
      for (const s of answeredStates) {
        const w = DIFFICULTY_WEIGHT[s.question_bank?.difficulty as string] ?? 2;
        weightedTotal += w;
        if (s.is_correct) weightedCorrect += w;
      }
      const MIN_ANSWERED_FOR_ESTIMATE = 10;
      const hasEnoughData = answeredStates.length >= MIN_ANSWERED_FOR_ESTIMATE;
      const weightedAccuracy = weightedTotal > 0 ? weightedCorrect / weightedTotal : 0;
      const estimatedScore = hasEnoughData ? Math.round(400 + weightedAccuracy * 1200) : 0;

      let streak = 0;
      const days = (progressRes.data || []).map((d) => d.date).sort().reverse();
      for (let i = 0; i < days.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        if (days[i] === expected) streak++;
        else break;
      }

      setStats({ totalQuestions: questions.length, answeredQuestions: answered, practiceAccuracy: accuracy, streak, estimatedScore });
      setRecentQuestions(recentRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const targetScore = profile?.target_sat_score;
  const scoreProgress = targetScore && stats?.estimatedScore
    ? Math.min(100, Math.round(((stats.estimatedScore - 400) / (targetScore - 400)) * 100))
    : 0;

  const daysUntilTest = profile?.test_date
    ? Math.ceil((new Date(profile.test_date + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground">Here&apos;s your SAT prep overview.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-card to-muted/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalQuestions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Questions asked</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-muted/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.answeredQuestions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Answered</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-muted/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Flame className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.streak ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Day streak</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-muted/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.practiceAccuracy ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Practice accuracy</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Progress + Test Countdown */}
          {((targetScore && stats?.estimatedScore != null && stats.estimatedScore > 0) || daysUntilTest !== null) && (
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              {targetScore && stats?.estimatedScore != null && stats.estimatedScore > 0 && (
                <Card className="overflow-hidden border-0 bg-gradient-primary text-white">
                  <CardContent className="pt-6 pb-6">
                    <p className="text-sm text-white/80 mb-4">Score Progress</p>
                    <div className="flex items-end gap-6 mb-4">
                      <div>
                        <p className="font-numeric text-4xl font-bold leading-none">{stats.estimatedScore}</p>
                        <p className="text-xs text-white/70 mt-1">Estimated</p>
                      </div>
                      <div className="text-2xl text-white/50 pb-1">/</div>
                      <div>
                        <p className="font-numeric text-4xl font-bold leading-none">{targetScore}</p>
                        <p className="text-xs text-white/70 mt-1">Your Goal</p>
                      </div>
                    </div>
                    <Progress value={scoreProgress} className="h-2 bg-white/20" />
                    <p className="text-xs text-white/70 mt-2">
                      {scoreProgress}% of the way there · rough estimate, weighted by question difficulty
                    </p>
                  </CardContent>
                </Card>
              )}

              {daysUntilTest !== null && (
                <Card className="overflow-hidden border-0 bg-gradient-milo text-milo-foreground">
                  <CardContent className="pt-6 pb-6 flex flex-col justify-between h-full">
                    <div className="flex items-center gap-2 text-sm text-milo-foreground/80 mb-2">
                      <CalendarClock className="h-4 w-4" />
                      <span>{daysUntilTest >= 0 ? 'Time until your SAT' : 'Test date has passed'}</span>
                    </div>
                    {daysUntilTest >= 0 ? (
                      <>
                        <p className="font-numeric text-4xl font-bold leading-none">{daysUntilTest}</p>
                        <p className="text-xs text-milo-foreground/70 mt-1">
                          day{daysUntilTest === 1 ? '' : 's'} · {new Date(profile!.test_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-milo-foreground/80">
                        Update your test date in Settings once you've registered for your next one.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Recent Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Recent Questions</h2>
              <Link href="/questions" className="text-sm text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {recentQuestions.length === 0 ? (
              <Card className="bg-gradient-to-br from-card to-muted/30">
                <CardContent className="pt-10 pb-10 text-center">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">No questions yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Ask your first SAT question to get started</p>
                  <Button asChild size="sm" className="mt-5">
                    <Link href="/questions/new">Ask a Question</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentQuestions.map((q) => (
                  <Link key={q.id} href={`/questions/${q.id}`}>
                    <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer bg-gradient-to-br from-card to-muted/20">
                      <CardContent className="py-3.5 px-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {q.title || q.content.substring(0, 80)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${statusColors[q.status] || ''}`}>
                              {q.status.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(q.created_at).toLocaleDateString()}
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
        </>
      )}
    </div>
  );
}
