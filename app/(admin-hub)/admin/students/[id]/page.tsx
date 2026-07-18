'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Loader2, User, GraduationCap, Target, BookOpen,
  MessageSquare, TrendingUp, Brain, Clock, BarChart2,
} from 'lucide-react';

interface Profile {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  grade_level: number | null;
  target_sat_score: number | null;
  preferred_subjects: string[] | null;
  bio: string | null;
  created_at: string;
}

interface LearningProfile {
  preferred_learning_style: string | null;
  hint_frequency: string | null;
  explanation_depth: string | null;
  total_questions_asked: number | null;
  total_human_help_requests: number | null;
  total_study_sessions: number | null;
  weakness_areas: string[] | null;
}

interface StudentQuestion {
  id: string;
  title: string | null;
  content: string | null;
  status: string;
  created_at: string;
  student_notes: string | null;
}

interface PracticeStats {
  totalSessions: number;
  totalAnswered: number;
  accuracy: number;
}

export default function AdminStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const studentId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [practiceStats, setPracticeStats] = useState<PracticeStats>({ totalSessions: 0, totalAnswered: 0, accuracy: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !studentId) return;
    const load = async () => {
      try {
        const [profileRes, lpRes, questionsRes, sessRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', studentId).maybeSingle(),
          supabase.from('user_learning_profiles').select('*').eq('user_id', studentId).maybeSingle(),
          supabase.from('questions').select('id, title, content, status, created_at, student_notes').eq('user_id', studentId).order('created_at', { ascending: false }).limit(20),
          supabase.from('practice_sessions').select('id, correct_answers, total_questions, status').eq('user_id', studentId).eq('status', 'completed').limit(100),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (!profileRes.data) { router.push('/admin/team'); return; }

        setProfile(profileRes.data);
        setLearningProfile(lpRes.data);
        setQuestions(questionsRes.data ?? []);

        const sessions = sessRes.data ?? [];
        const totalAnswered = sessions.reduce((sum: number, s: any) => sum + (s.total_questions ?? 0), 0);
        const totalCorrect = sessions.reduce((sum: number, s: any) => sum + (s.correct_answers ?? 0), 0);
        setPracticeStats({
          totalSessions: sessions.length,
          totalAnswered,
          accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
        });
      } catch (err) {
        console.error('Error loading student profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user, studentId, router]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Student not found</p>
      <Button className="mt-4" variant="outline" asChild>
        <Link href="/admin/team"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
      </Button>
    </div>
  );

  const initials = (profile.full_name ?? profile.email ?? 'S')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const statusColor: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    ai_ready: 'bg-info/10 text-info',
    human_requested: 'bg-warning/10 text-warning',
    claimed: 'bg-purple/10 text-purple',
    human_ready: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Student Profile</h1>
          <p className="text-muted-foreground text-sm">Full academic profile and history</p>
        </div>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{profile.full_name || 'Unnamed Student'}</h2>
                <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
              {profile.bio && <p className="text-sm mt-2 text-muted-foreground">{profile.bio}</p>}
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                {profile.grade_level && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />Grade {profile.grade_level}
                  </span>
                )}
                {profile.target_sat_score && (
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />Target: {profile.target_sat_score}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />Joined {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
              {profile.preferred_subjects && profile.preferred_subjects.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.preferred_subjects.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-bold">{questions.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Questions Asked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-bold">{practiceStats.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Practice Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-bold">{practiceStats.accuracy}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">Practice Accuracy</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="questions">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="questions">Question History</TabsTrigger>
          <TabsTrigger value="learning">Learning Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-3 mt-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No questions submitted yet
            </div>
          ) : (
            questions.map((q) => (
              <Card key={q.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{q.title || 'Untitled'}</p>
                      {q.content && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{q.content}</p>
                      )}
                      {q.student_notes && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic line-clamp-1">
                          Notes: {q.student_notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[q.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {q.status.replace(/_/g, ' ')}
                      </span>
                      <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                        <Link href={`/admin/respond/${q.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          {!learningProfile ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No learning data available yet
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" />Learning Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {learningProfile.preferred_learning_style && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Learning Style</span>
                      <span className="font-medium capitalize">{learningProfile.preferred_learning_style}</span>
                    </div>
                  )}
                  {learningProfile.explanation_depth && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Explanation Depth</span>
                      <span className="font-medium capitalize">{learningProfile.explanation_depth}</span>
                    </div>
                  )}
                  {learningProfile.hint_frequency && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hint Frequency</span>
                      <span className="font-medium capitalize">{learningProfile.hint_frequency}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />Activity Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {learningProfile.total_questions_asked != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Questions</span>
                      <span className="font-medium">{learningProfile.total_questions_asked}</span>
                    </div>
                  )}
                  {learningProfile.total_human_help_requests != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Human Help Requests</span>
                      <span className="font-medium">{learningProfile.total_human_help_requests}</span>
                    </div>
                  )}
                  {learningProfile.total_study_sessions != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Study Sessions</span>
                      <span className="font-medium">{learningProfile.total_study_sessions}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              {learningProfile.weakness_areas && (learningProfile.weakness_areas as any[]).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {(learningProfile.weakness_areas as string[]).map((area) => (
                        <Badge key={area} variant="outline" className="text-xs">{area}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
