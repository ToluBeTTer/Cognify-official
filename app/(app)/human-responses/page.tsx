'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  HelpCircle,
  MessageSquare,
  Video,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Question = Database['public']['Tables']['questions']['Row'];
type HumanResponse = Database['public']['Tables']['human_responses']['Row'];

interface HumanHelpItem {
  question: Question;
  response: HumanResponse | null;
}

export default function HumanResponsesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<HumanHelpItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('user_id', user.id)
        .eq('human_requested', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!questions?.length) { setItems([]); setIsLoading(false); return; }

      const questionIds = questions.map((q) => q.id);
      const { data: responses } = await supabase
        .from('human_responses')
        .select('*')
        .in('question_id', questionIds);

      const responseMap = new Map((responses || []).map((r) => [r.question_id, r]));
      setItems(questions.map((q) => ({ question: q, response: responseMap.get(q.id) || null })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Real-time: update when a human response is inserted or updated
  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase
      .channel('human-responses-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'human_responses' },
        (payload) => {
          const newResp = payload.new as HumanResponse;
          setItems((prev) =>
            prev.map((item) =>
              item.question.id === newResp.question_id
                ? { ...item, response: newResp }
                : item
            )
          );
          toast.success('A tutor has answered your question!', { duration: 5000 });
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Question;
          setItems((prev) =>
            prev.map((item) =>
              item.question.id === updated.id
                ? { ...item, question: updated }
                : item
            )
          );
        })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inProgress = items.filter((i) => !i.response);
  const completed = items.filter((i) => !!i.response);

  const statusLabel = (q: Question) => {
    if (q.status === 'claimed') return { label: 'Tutor Claimed', color: 'text-info', bg: 'bg-info/10 border-info/25' };
    if (q.status === 'human_requested') return { label: 'Awaiting Tutor', color: 'text-warning', bg: 'bg-warning/10 border-warning/25' };
    if (q.status === 'human_ready' || q.status === 'completed') return { label: 'Ready', color: 'text-success', bg: 'bg-success/10 border-success/25' };
    return { label: q.status, color: 'text-muted-foreground', bg: 'bg-muted' };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Human Help Requests</h1>
          <p className="text-muted-foreground">Questions where you requested a tutor explanation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/questions/new">
              <HelpCircle className="mr-2 h-4 w-4" />Ask New Question
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{items.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Total requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-warning">{inProgress.length}</div>
            <p className="text-sm text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-success">{completed.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No human help requests</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-sm">
              When you request a human tutor on any question, it will appear here.
            </p>
            <Button asChild>
              <Link href="/questions/new">
                Ask a Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {inProgress.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-3">
                {inProgress.map(({ question }) => {
                  const s = statusLabel(question);
                  return (
                    <Link key={question.id} href={`/questions/${question.id}`} className="block">
                      <Card className={cn('card-hover border', s.bg)}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold">{question.title || 'Question'}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {question.content}
                              </p>
                              <div className="flex items-center gap-3 mt-3">
                                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', s.bg, s.color)}>
                                  {s.label}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(question.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <Clock className="h-8 w-8 text-warning" />
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Completed ({completed.length})
              </h2>
              <div className="space-y-3">
                {completed.map(({ question, response }) => (
                  <Link key={question.id} href={`/questions/${question.id}`} className="block">
                    <Card className="card-hover">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="default" className="flex items-center gap-1 bg-success">
                                <CheckCircle2 className="h-3 w-3" />Answered
                              </Badge>
                              {response?.is_approved && (
                                <Badge variant="outline" className="text-xs border-success text-success">Approved</Badge>
                              )}
                              {(response?.video_url || response?.video_storage_path) && (
                                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                  <Video className="h-3 w-3" />Video
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold">{question.title || 'Question'}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {response?.explanation?.substring(0, 120) ?? question.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(question.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <MessageSquare className="h-8 w-8 text-primary" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {inProgress.length > 0 && (
        <Card className="border-info/25 bg-info/10">
          <CardContent className="p-4 flex items-start gap-3">
            <Bell className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
            <p className="text-sm text-info">
              You'll receive a notification when your tutor responds. Response times are typically 1-24 hours.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
