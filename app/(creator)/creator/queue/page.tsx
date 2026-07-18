'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Clock, Loader2, CheckCircle2, Image as ImageIcon, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

type Question = Database['public']['Tables']['questions']['Row'];

interface QueueQuestion extends Question {
  student_name?: string | null;
  student_grade?: number | null;
  attachment_count?: number;
}

export default function CreatorQueuePage() {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<QueueQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || (profile?.role !== 'creator' && profile?.role !== 'admin')) return;
    const fetchData = async () => {
      try {
        const [questionsRes, claimsRes] = await Promise.all([
          supabase.from('questions').select(`*, profiles!questions_user_id_fkey(full_name, grade_level)`).eq('human_requested', true).in('status', ['human_requested', 'claimed']).is('deleted_at', null).order('created_at', { ascending: true }).limit(200),
          supabase.from('question_claims').select('question_id').eq('creator_id', user.id).in('status', ['claimed', 'in_progress']),
        ]);
        if (questionsRes.error) throw questionsRes.error;

        // Get attachment counts
        const questionIds = (questionsRes.data || []).map(q => q.id);
        const { data: attachments } = await supabase.from('attachments').select('question_id').in('question_id', questionIds);
        const attachmentCounts = (attachments || []).reduce((acc, att) => { acc[att.question_id] = (acc[att.question_id] || 0) + 1; return acc; }, {} as Record<string, number>);

        const enriched: QueueQuestion[] = (questionsRes.data || []).map(q => ({
          ...q,
          student_name: (q.profiles as any)?.full_name || null,
          student_grade: (q.profiles as any)?.grade_level || null,
          attachment_count: attachmentCounts[q.id] || 0,
        }));

        setQuestions(enriched);
        setClaimedIds(claimsRes.data?.map((c) => c.question_id) || []);
      } catch (error) {
        console.error('Error fetching queue:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    channelRef.current = supabase.channel('creator-queue')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, async () => {
        if (profile?.role === 'creator' || profile?.role === 'admin') {
          const { data } = await supabase.from('questions').select(`*, profiles!questions_user_id_fkey(full_name, grade_level)`).eq('human_requested', true).in('status', ['human_requested', 'claimed']).is('deleted_at', null).order('created_at', { ascending: true })
            .limit(200);
          if (data) {
            const questionIds = data.map(q => q.id);
            const { data: attachments } = await supabase.from('attachments').select('question_id').in('question_id', questionIds);
            const attachmentCounts = (attachments || []).reduce((acc, att) => { acc[att.question_id] = (acc[att.question_id] || 0) + 1; return acc; }, {} as Record<string, number>);
            const enriched: QueueQuestion[] = data.map(q => ({
              ...q,
              student_name: (q.profiles as any)?.full_name || null,
              student_grade: (q.profiles as any)?.grade_level || null,
              attachment_count: attachmentCounts[q.id] || 0,
            }));
            setQuestions(enriched);
          }
        }
      }).subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [user, profile]);

  const handleClaim = async (questionId: string) => {
    if (!user) return;
    try {
      const { error: claimError } = await supabase.from('question_claims').insert({ question_id: questionId, creator_id: user.id, status: 'claimed' });
      if (claimError) {
        // Postgres unique_violation — someone else's claim landed first.
        if (claimError.code === '23505') {
          toast.error('Another tutor just claimed this question.');
          setQuestions((prev) => prev.filter((q) => q.id !== questionId));
          return;
        }
        throw claimError;
      }
      const { error: updateError } = await supabase.from('questions').update({ status: 'claimed' }).eq('id', questionId);
      if (updateError) throw updateError;
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, status: 'claimed' } : q)));
      setClaimedIds((prev) => [...prev, questionId]);
      toast.success('Question claimed! You can now write your response.');
    } catch (error: any) {
      console.error('Error claiming question:', error);
      toast.error(`Failed to claim question: ${error?.message || 'Unknown error'}`);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const unclaimed = questions.filter((q) => q.status === 'human_requested');
  const claimedByMe = questions.filter((q) => claimedIds.includes(q.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Request Queue</h1>
        <p className="text-muted-foreground mt-2">Questions waiting for expert explanations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Available</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{unclaimed.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">My Claims</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{claimedByMe.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Queue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{questions.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">Available ({unclaimed.length})</TabsTrigger>
          <TabsTrigger value="claimed">My Claims ({claimedByMe.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4 mt-6">
          {unclaimed.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12"><CheckCircle2 className="h-12 w-12 text-success mb-4" /><p className="text-lg font-medium">Queue is empty</p><p className="text-muted-foreground">All questions have been claimed</p></CardContent></Card>
          ) : (
            unclaimed.map((q) => <QueueCard key={q.id} question={q} canClaim onClaim={() => handleClaim(q.id)} />)
          )}
        </TabsContent>

        <TabsContent value="claimed" className="space-y-4 mt-6">
          {claimedByMe.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12"><MessageSquare className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-lg font-medium">No claimed questions</p><p className="text-muted-foreground">Claim questions from the available tab</p></CardContent></Card>
          ) : (
            claimedByMe.map((q) => <QueueCard key={q.id} question={q} isClaimed />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QueueCard({ question, canClaim = false, isClaimed = false, onClaim }: { question: QueueQuestion; canClaim?: boolean; isClaimed?: boolean; onClaim?: () => void }) {
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const initials = (question.student_name || 'S').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Card className={isClaimed ? 'border-primary/30' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Top row: status badges + student info */}
            <div className="flex items-center flex-wrap gap-2 mb-3">
              {isClaimed ? (
                <Badge className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Claimed by you</Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" />Waiting</Badge>
              )}
              <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
                {question.student_name && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{initials}</AvatarFallback></Avatar>
                    <span>{question.student_name}</span>
                  </div>
                )}
                {question.student_grade && (
                  <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />Gr {question.student_grade}</span>
                )}
              </div>
            </div>

            <h3 className="font-medium mb-2">{question.title || 'Untitled Question'}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{question.content}</p>

            {question.ocr_extracted_text && (
              <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground mb-3 line-clamp-2">
                <span className="font-medium">OCR:</span> {question.ocr_extracted_text}
              </div>
            )}

            {/* Bottom row: metadata */}
            <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="capitalize">{question.subject_id?.replace(/-/g, ' ') || 'General'}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{getRelativeTime(question.created_at)}</span>
              {question.attachment_count && question.attachment_count > 0 && (
                <span className="flex items-center gap-1 text-primary"><ImageIcon className="h-3.5 w-3.5" />{question.attachment_count} {question.attachment_count === 1 ? 'image' : 'images'}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isClaimed ? (
              <Button asChild><Link href={`/creator/respond/${question.id}`}>Create Response</Link></Button>
            ) : canClaim ? (
              <Button onClick={onClaim}>Claim</Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
