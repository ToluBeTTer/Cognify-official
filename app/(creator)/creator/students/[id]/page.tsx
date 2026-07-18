'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, GraduationCap, Target, Brain,
  MessageSquare, Clock, ShieldAlert,
} from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string | null;
  grade_level: number | null;
  target_sat_score: number | null;
  preferred_subjects: string[] | null;
  bio: string | null;
}

interface LearningProfile {
  preferred_learning_style: string | null;
  hint_frequency: string | null;
  explanation_depth: string | null;
  total_questions_asked: number | null;
  total_human_help_requests: number | null;
}

interface ClaimedQuestion {
  id: string;
  title: string | null;
  content: string | null;
  status: string;
  created_at: string;
  student_notes: string | null;
  claim_status: string;
}

export default function CreatorStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const studentId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [claimedQuestions, setClaimedQuestions] = useState<ClaimedQuestion[]>([]);
  const [hasActiveClaim, setHasActiveClaim] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!user || !studentId) return;
    const load = async () => {
      try {
        // First check for active claims on this student's questions
        const { data: claims } = await supabase
          .from('question_claims')
          .select('id, status, question_id, questions!inner(id, title, content, status, created_at, student_notes, user_id)')
          .eq('creator_id', user.id)
          .filter('questions.user_id', 'eq', studentId);

        if (!claims || claims.length === 0) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }

        const active = claims.filter((c: any) => ['claimed', 'in_progress'].includes(c.status));
        setHasActiveClaim(active.length > 0);

        if (active.length === 0) {
          // No active claim — can only see questions and basic info (not full profile)
          const claimedQs = claims.map((c: any) => ({
            ...(c.questions as any),
            claim_status: c.status,
          }));
          setClaimedQuestions(claimedQs);
          setIsLoading(false);
          return;
        }

        // Active claim exists — fetch full profile
        const [profileRes, lpRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name, grade_level, target_sat_score, preferred_subjects, bio').eq('user_id', studentId).maybeSingle(),
          supabase.from('user_learning_profiles').select('preferred_learning_style, hint_frequency, explanation_depth, total_questions_asked, total_human_help_requests').eq('user_id', studentId).maybeSingle(),
        ]);

        setProfile(profileRes.data);
        setLearningProfile(lpRes.data);
        setClaimedQuestions(claims.map((c: any) => ({
          ...(c.questions as any),
          claim_status: c.status,
        })));
      } catch (err) {
        console.error('Error loading student profile:', err);
        setAccessDenied(true);
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

  if (accessDenied) return (
    <div className="max-w-md mx-auto text-center py-16 space-y-4">
      <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
      <h2 className="text-xl font-bold">Access Restricted</h2>
      <p className="text-muted-foreground text-sm">
        You can only view a student's profile while you have an active claim on one of their questions.
      </p>
      <Button asChild variant="outline">
        <Link href="/creator/queue"><ArrowLeft className="mr-2 h-4 w-4" />Back to Queue</Link>
      </Button>
    </div>
  );

  const initials = (profile?.full_name ?? 'S')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const claimStatusColor: Record<string, string> = {
    claimed: 'bg-warning/10 text-warning',
    in_progress: 'bg-info/10 text-info',
    completed: 'bg-success/10 text-success',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Student Profile</h1>
          <p className="text-muted-foreground text-sm">
            {hasActiveClaim
              ? 'Viewing during active tutoring session'
              : 'Limited view — no active claims'}
          </p>
        </div>
      </div>

      {!hasActiveClaim && (
        <Card className="border-warning/25 bg-warning/10">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 text-sm text-warning">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            You no longer have an active claim on this student's questions. Full profile access is restricted.
          </CardContent>
        </Card>
      )}

      {/* Profile header — only shown with active claim */}
      {hasActiveClaim && profile && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">{profile.full_name || 'Unnamed Student'}</h2>
                {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  {profile.grade_level && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" />Grade {profile.grade_level}
                    </span>
                  )}
                  {profile.target_sat_score && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />Target SAT: {profile.target_sat_score}
                    </span>
                  )}
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
      )}

      {/* Learning preferences — only with active claim */}
      {hasActiveClaim && learningProfile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />How this student learns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {learningProfile.preferred_learning_style && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prefers</span>
                <span className="font-medium capitalize">{learningProfile.preferred_learning_style} explanations</span>
              </div>
            )}
            {learningProfile.explanation_depth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depth</span>
                <span className="font-medium capitalize">{learningProfile.explanation_depth}</span>
              </div>
            )}
            {learningProfile.hint_frequency && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hints</span>
                <span className="font-medium capitalize">{learningProfile.hint_frequency}</span>
              </div>
            )}
            {learningProfile.total_human_help_requests != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Human help requests</span>
                <span className="font-medium">{learningProfile.total_human_help_requests}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Questions this creator claimed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {hasActiveClaim ? 'Your interactions with this student' : 'Past interactions'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {claimedQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No questions claimed from this student</p>
          ) : (
            claimedQuestions.map((q) => (
              <div key={q.id} className="p-3 rounded-lg border space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-1">{q.title || 'Untitled'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${claimStatusColor[q.claim_status] ?? 'bg-muted text-muted-foreground'}`}>
                    {q.claim_status}
                  </span>
                </div>
                {q.content && <p className="text-xs text-muted-foreground line-clamp-2">{q.content}</p>}
                {q.student_notes && (
                  <p className="text-xs text-muted-foreground/70 italic">Notes: {q.student_notes}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{new Date(q.created_at).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="outline" asChild className="h-6 text-xs">
                    <Link href={`/creator/respond/${q.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
