'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Brain,
  HelpCircle,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Star,
  Trophy,
  Flame,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type UserLearningProfile = Database['public']['Tables']['user_learning_profiles']['Row'];
type UserProgress = Database['public']['Tables']['user_progress']['Row'];

interface TopicMastery {
  topic: string;
  correct: number;
  total: number;
  pct: number;
}

interface WeaknessArea {
  topic: string;
  missed: number;
  correct: number;
  trend: 'improving' | 'declining' | 'stable';
}

export default function ProgressPage() {
  const { user, profile } = useAuth();
  const [learningProfile, setLearningProfile] = useState<UserLearningProfile | null>(null);
  const [recentProgress, setRecentProgress] = useState<UserProgress[]>([]);
  const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([]);
  const [practiceStats, setPracticeStats] = useState({ sessions: 0, correct: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [profileRes, progressRes, attemptsRes, sessionsRes] = await Promise.all([
          supabase.from('user_learning_profiles').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_progress').select('*').eq('user_id', user.id)
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: false }),
          supabase.from('practice_attempts').select('topic_id, is_correct').eq('user_id', user.id),
          supabase.from('practice_sessions').select('id, correct_answers, total_questions').eq('user_id', user.id),
        ]);

        setLearningProfile(profileRes.data);
        setRecentProgress(progressRes.data || []);

        // Build mastery from practice_attempts
        if (attemptsRes.data?.length) {
          const grouped: Record<string, { correct: number; total: number }> = {};
          attemptsRes.data.forEach((a) => {
            if (!grouped[a.topic_id]) grouped[a.topic_id] = { correct: 0, total: 0 };
            grouped[a.topic_id].total++;
            if (a.is_correct) grouped[a.topic_id].correct++;
          });
          const mastery = Object.entries(grouped).map(([topic, d]) => ({
            topic,
            ...d,
            pct: Math.round((d.correct / d.total) * 100),
          })).sort((a, b) => a.pct - b.pct);
          setTopicMastery(mastery);
        }

        // Practice stats
        if (sessionsRes.data?.length) {
          const totalC = sessionsRes.data.reduce((s, r) => s + (r.correct_answers || 0), 0);
          const totalQ = sessionsRes.data.reduce((s, r) => s + (r.total_questions || 0), 0);
          setPracticeStats({ sessions: sessionsRes.data.length, correct: totalC, total: totalQ });
        }
      } catch (error) {
        console.error('Error fetching progress data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalQuestions = recentProgress.reduce((sum, p) => sum + p.questions_asked, 0);
  const totalCorrect = recentProgress.reduce((sum, p) => sum + p.questions_answered_correctly, 0);
  const accuracy = practiceStats.total > 0
    ? Math.round((practiceStats.correct / practiceStats.total) * 100)
    : totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const totalStudyTime = recentProgress.reduce((sum, p) => sum + p.study_time_minutes, 0);

  const weaknesses: WeaknessArea[] = (
    (learningProfile?.weakness_areas as unknown as WeaknessArea[]) ||
    topicMastery.filter((t) => t.pct < 70).map((t) => ({
      topic: t.topic.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      missed: t.total - t.correct,
      correct: t.correct,
      trend: 'stable' as const,
    }))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress & Analytics</h1>
        <p className="text-muted-foreground mt-2">Track your SAT preparation journey</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Practice Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{accuracy}%</div>
            <Progress value={accuracy} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-info" />
              Practice Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{practiceStats.sessions || totalQuestions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {practiceStats.sessions > 0 ? `${practiceStats.total} questions answered` : 'This month'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-success" />
              Study Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.floor(totalStudyTime / 60)}h</div>
            <p className="text-xs text-muted-foreground mt-1">{totalStudyTime % 60}m this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Topics Practiced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{topicMastery.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Distinct topics</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mastery">
        <TabsList>
          <TabsTrigger value="mastery">Topic Mastery</TabsTrigger>
          <TabsTrigger value="weaknesses">Weak Areas</TabsTrigger>
          <TabsTrigger value="history">Study History</TabsTrigger>
          <TabsTrigger value="learning">Learning Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="mastery" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                SAT Topic Mastery
              </CardTitle>
              <CardDescription>Based on your practice attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {topicMastery.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium">No practice data yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Complete some practice sets to see your mastery</p>
                  <Button asChild>
                    <Link href="/question-bank">
                      Go to Question Bank
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {topicMastery.map((t) => (
                    <div key={t.topic}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {t.topic.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className={cn(
                          'text-sm font-medium',
                          t.pct >= 80 ? 'text-success' : t.pct >= 60 ? 'text-warning' : 'text-destructive'
                        )}>
                          {t.pct}%
                        </span>
                      </div>
                      <Progress value={t.pct} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-0.5">{t.correct}/{t.total} correct</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weaknesses" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Areas Needing Focus
              </CardTitle>
              <CardDescription>Topics where you need more practice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weaknesses.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                  <p className="font-medium">No significant weaknesses detected!</p>
                  <p className="text-sm text-muted-foreground">Keep up the great work</p>
                </div>
              ) : (
                weaknesses.map((area) => (
                  <div key={area.topic} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{area.topic}</p>
                      <p className="text-sm text-muted-foreground">
                        {area.missed + area.correct} questions attempted
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {Math.round((area.correct / (area.missed + area.correct)) * 100)}% accuracy
                        </p>
                        <Badge
                          variant={
                            area.trend === 'improving' ? 'default'
                              : area.trend === 'declining' ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {area.trend === 'improving' && <TrendingUp className="h-3 w-3 mr-1" />}
                          {area.trend}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {weaknesses.length > 0 && (
            <Card className="border-warning/25 bg-warning/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Lightbulb className="h-5 w-5" />
                  Recommended Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-warning text-sm">
                  Based on your performance, focus on{' '}
                  <strong>{weaknesses[0].topic}</strong>. This area needs the most attention.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/question-bank">Practice this topic</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentProgress.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium">No activity yet</p>
                  <p className="text-sm text-muted-foreground">Start studying to see your progress</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentProgress.slice(0, 10).map((day) => (
                    <div key={day.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <p className="font-medium text-sm">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{day.questions_asked} questions</span>
                        <span>{day.study_time_minutes}m studied</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Your Learning Profile
              </CardTitle>
              <CardDescription>Milo adapts to your unique learning style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Preferred Learning Style</h4>
                <div className="flex gap-2 flex-wrap">
                  {(['visual', 'verbal', 'kinesthetic'] as const).map((style) => (
                    <Badge
                      key={style}
                      variant={learningProfile?.preferred_learning_style === style ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
                {!learningProfile?.preferred_learning_style && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Keep using Milo to help us understand your learning style
                  </p>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Explanation Preference</h4>
                <div className="flex gap-2 flex-wrap">
                  {(['concise', 'balanced', 'thorough'] as const).map((depth) => (
                    <Badge
                      key={depth}
                      variant={learningProfile?.explanation_depth === depth ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {depth}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">All-Time Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{learningProfile?.total_ai_interactions || 0}</p>
                    <p className="text-sm text-muted-foreground">AI interactions</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{learningProfile?.total_human_help_requests || 0}</p>
                    <p className="text-sm text-muted-foreground">Human help requests</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{practiceStats.sessions}</p>
                    <p className="text-sm text-muted-foreground">Practice sessions</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{practiceStats.total}</p>
                    <p className="text-sm text-muted-foreground">Questions practiced</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <AchievementBadge
                  icon={<Star className="h-8 w-8" />}
                  label="First Question"
                  unlocked
                  color="yellow"
                />
                <AchievementBadge
                  icon={<Flame className="h-8 w-8" />}
                  label="7-Day Streak"
                  unlocked={recentProgress.length >= 7}
                  color="blue"
                />
                <AchievementBadge
                  icon={<Trophy className="h-8 w-8" />}
                  label="100 Questions"
                  unlocked={practiceStats.total >= 100}
                  color="yellow"
                />
                <AchievementBadge
                  icon={<CheckCircle2 className="h-8 w-8" />}
                  label="80% Accuracy"
                  unlocked={accuracy >= 80}
                  color="green"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AchievementBadge({
  icon, label, unlocked, color,
}: {
  icon: React.ReactNode;
  label: string;
  unlocked: boolean;
  color: 'yellow' | 'blue' | 'green';
}) {
  const colorMap = {
    yellow: 'bg-warning/10 border-warning/25 text-warning',
    blue: 'bg-info/10 border-info/25 text-info',
    green: 'bg-success/10 border-success/25 text-success',
  };

  return (
    <div className={cn(
      'text-center p-4 rounded-lg border transition-all',
      unlocked ? colorMap[color] : 'bg-muted opacity-50'
    )}>
      <div className={cn(!unlocked && 'text-muted-foreground')}>
        {icon}
      </div>
      <p className="text-xs font-medium mt-2">{label}</p>
    </div>
  );
}
