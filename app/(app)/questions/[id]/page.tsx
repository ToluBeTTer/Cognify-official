'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { resolveResponseVideoUrl } from '@/lib/supabase/video-url';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Bot,
  Users,
  Clock,
  CheckCircle2,
  Lightbulb,
  Star,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  FileText,
  AlertCircle,
  AlertTriangle,
  Bookmark,
  Video,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MarkdownContent } from '@/components/ui/markdown-content';

type Question = Database['public']['Tables']['questions']['Row'];
type AIResponse = Database['public']['Tables']['ai_responses']['Row'];
type HumanResponse = Database['public']['Tables']['human_responses']['Row'];
type Attachment = Database['public']['Tables']['attachments']['Row'];

const statusConfig: Record<Question['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  ai_ready: { label: 'AI Ready', variant: 'default' },
  human_requested: { label: 'Human Requested', variant: 'outline' },
  claimed: { label: 'Claimed', variant: 'outline' },
  human_ready: { label: 'Ready', variant: 'default' },
  completed: { label: 'Completed', variant: 'default' },
  archived: { label: 'Archived', variant: 'secondary' },
};

function VideoPlayer({ url }: { url: string }) {
  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const isVimeo = /vimeo\.com/.test(url);
  const isLoom = /loom\.com/.test(url);
  // Detect Supabase storage signed URLs (response-videos bucket)
  const isSupabaseStorage = /supabase\.co\/storage\/v1\/object\/sign\/response-videos/.test(url);

  const getEmbedUrl = () => {
    if (isYouTube) {
      const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (isVimeo) {
      const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (isLoom) {
      const id = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)?.[1];
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    return null;
  };

  const embedUrl = getEmbedUrl();

  if (embedUrl) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden border">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Video explanation"
        />
      </div>
    );
  }

  // Direct video file or Supabase storage signed URL
  if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) || isSupabaseStorage) {
    return (
      <video controls className="w-full rounded-lg border">
        <source src={url} />
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-primary"
    >
      <Video className="h-5 w-5" />
      <span className="text-sm font-medium">Watch video explanation</span>
      <ExternalLink className="h-4 w-4 ml-auto" />
    </a>
  );
}

interface AttachmentWithUrl extends Attachment {
  signedUrl?: string;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const questionId = params.id as string;

  const [question, setQuestion] = useState<Question | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [humanResponse, setHumanResponse] = useState<HumanResponse | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!humanResponse) {
      setResolvedVideoUrl(null);
      return;
    }
    let cancelled = false;
    resolveResponseVideoUrl(humanResponse).then((url) => {
      if (!cancelled) setResolvedVideoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [humanResponse]);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !questionId) return;

      try {
        const { data: questionData, error } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!questionData) { router.push('/questions'); return; }
        setQuestion(questionData);

        const [aiRes, humanRes, attachRes, savedRes] = await Promise.all([
          supabase.from('ai_responses').select('*').eq('question_id', questionId).maybeSingle(),
          supabase.from('human_responses').select('*').eq('question_id', questionId).maybeSingle(),
          supabase.from('attachments').select('*').eq('question_id', questionId),
          supabase.from('saved_explanations').select('id').eq('question_id', questionId).eq('user_id', user.id).maybeSingle(),
        ]);

        setAiResponse(aiRes.data);
        setHumanResponse(humanRes.data);

        // Get signed URLs for attachments
        if (attachRes.data && attachRes.data.length > 0) {
          const withUrls = await Promise.all(
            attachRes.data.map(async (att) => {
              try {
                const bucket = att.storage_bucket || 'question-attachments';
                const { data: urlData } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(att.storage_path, 3600);
                return { ...att, signedUrl: urlData?.signedUrl };
              } catch {
                return att;
              }
            })
          );
          setAttachments(withUrls);
        } else {
          setAttachments([]);
        }

        if (savedRes.data) { setIsSaved(true); setSavedId(savedRes.data.id); }
      } catch (err: any) {
        console.error(err);
        toast.error(`Failed to load question: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, questionId, router]);

  // Real-time subscription: update question status live
  useEffect(() => {
    if (!questionId) return;

    channelRef.current = supabase
      .channel(`question-${questionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions', filter: `id=eq.${questionId}` },
        (payload) => {
          setQuestion((prev) => prev ? { ...prev, ...(payload.new as Question) } : prev);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_responses', filter: `question_id=eq.${questionId}` },
        (payload) => { setAiResponse(payload.new as AIResponse); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'human_responses', filter: `question_id=eq.${questionId}` },
        (payload) => { setHumanResponse(payload.new as HumanResponse); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'human_responses', filter: `question_id=eq.${questionId}` },
        (payload) => { setHumanResponse((prev) => prev ? { ...prev, ...(payload.new as HumanResponse) } : prev); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [questionId]);

  const handleSubmitRating = async () => {
    if (!aiResponse || !rating) return;
    try {
      await supabase.from('ai_responses').update({ student_rating: rating, student_feedback: feedback || null }).eq('id', aiResponse.id);
      toast.success('Thank you for your feedback!');
      setAiResponse({ ...aiResponse, student_rating: rating, student_feedback: feedback || null });
    } catch (error: any) {
      toast.error(`Failed to submit feedback: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleRequestHumanHelp = async () => {
    if (!question) return;
    try {
      await supabase.from('questions').update({ human_requested: true, status: 'human_requested' }).eq('id', question.id);
      setQuestion({ ...question, human_requested: true, status: 'human_requested' });
      toast.success('Human help requested! Our tutors will review your question.');
    } catch (error: any) {
      toast.error(`Failed to request human help: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSaveExplanation = async () => {
    if (!user || !question) return;
    if (isSaved && savedId) {
      try {
        await supabase.from('saved_explanations').delete().eq('id', savedId);
        setIsSaved(false); setSavedId(null);
        toast.success('Removed from saved explanations');
      } catch (error: any) { toast.error(`Failed to remove: ${error?.message || 'Unknown error'}`); }
    } else {
      try {
        const { data, error } = await supabase
          .from('saved_explanations')
          .insert({ user_id: user.id, question_id: questionId, ai_response_id: aiResponse?.id || null, human_response_id: humanResponse?.id || null })
          .select('id').single();
        if (error) throw error;
        setIsSaved(true); setSavedId(data.id);
        toast.success('Explanation saved!');
      } catch (error: any) { toast.error(`Failed to save: ${error?.message || 'Unknown error'}`); }
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!question) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium">Question not found</p>
        <Button className="mt-4" asChild><Link href="/questions">View All Questions</Link></Button>
      </div>
    );
  }

  const config = statusConfig[question.status];
  const displayRating = hoverRating ?? rating;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/questions"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{question.title || 'Question Details'}</h1>
          <p className="text-muted-foreground">{new Date(question.created_at).toLocaleDateString()}</p>
        </div>
        {(aiResponse || humanResponse) && (
          <Button variant={isSaved ? 'default' : 'outline'} size="sm" onClick={handleSaveExplanation}>
            <Bookmark className={cn('h-4 w-4 mr-1', isSaved && 'fill-current')} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
        )}
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      {/* Question Content */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Question</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {attachments.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {attachments.map((attachment) => (
                <div key={attachment.id}>
                  {attachment.file_type === 'image' && attachment.signedUrl ? (
                    <img
                      src={attachment.signedUrl}
                      alt={attachment.file_name}
                      className="rounded-lg border w-full object-cover aspect-square"
                    />
                  ) : attachment.file_type === 'image' && attachment.storage_path ? (
                    <img
                      src={supabase.storage.from('question-attachments').getPublicUrl(attachment.storage_path).data.publicUrl}
                      alt={attachment.file_name}
                      className="rounded-lg border w-full object-cover aspect-square"
                    />
                  ) : (
                    <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {question.ocr_extracted_text && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-1">Extracted Text</p>
              <p className="text-muted-foreground">{question.ocr_extracted_text}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap">{question.content}</p>
          {question.student_notes && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-1">My Notes</p>
              <p className="text-sm text-muted-foreground">{question.student_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Response */}
      {aiResponse && (
        <Card className="border-milo/25 bg-milo/[0.03]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-milo flex items-center justify-center">
                  <Bot className="h-4 w-4 text-milo-foreground" />
                </div>
                <CardTitle>Milo's Explanation</CardTitle>
              </div>
              {aiResponse.status === 'ready' && (
                <Badge className="flex items-center gap-1 bg-milo text-milo-foreground hover:bg-milo/90">
                  <CheckCircle2 className="h-3 w-3" />Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {aiResponse.confidence_score != null && aiResponse.confidence_score < 0.5 && (
              <div className="flex gap-2.5 p-3.5 rounded-xl bg-warning/10 border border-warning/20 text-warning text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Milo isn't fully confident on this one — consider requesting a human tutor for a second opinion.</span>
              </div>
            )}
            <MarkdownContent content={aiResponse.explanation} />

            {Array.isArray(aiResponse.hints) && aiResponse.hints.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-warning" />Hints
                </h4>
                <ul className="space-y-1">
                  {(aiResponse.hints as string[]).map((hint, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="font-medium text-foreground">{i + 1}.</span>{hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(aiResponse.related_concepts) && aiResponse.related_concepts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Related Concepts</h4>
                <div className="flex flex-wrap gap-2">
                  {(aiResponse.related_concepts as string[]).map((c, i) => (
                    <Badge key={i} variant="secondary">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Star Rating */}
            <div className="space-y-3">
              <h4 className="font-medium">Was this helpful?</h4>
              {aiResponse.student_rating ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={cn('h-5 w-5', s <= aiResponse.student_rating! ? 'fill-yellow-400 text-warning/70' : 'text-muted-foreground')} />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">You rated {aiResponse.student_rating}/5</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setRating(s)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star className={cn('h-6 w-6 transition-colors', s <= (displayRating ?? 0) ? 'fill-yellow-400 text-warning/70' : 'text-muted-foreground/40 hover:text-muted-foreground')} />
                      </button>
                    ))}
                    {rating && <span className="ml-2 text-sm text-muted-foreground self-center">{['', 'Not helpful', 'Slightly helpful', 'Helpful', 'Very helpful', 'Excellent!'][rating]}</span>}
                  </div>
                  {rating && (
                    <div className="space-y-2">
                      <Textarea placeholder="Any additional feedback? (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSubmitRating}>Submit Rating</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRating(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!question.human_requested && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Need more help?</h4>
                    <p className="text-sm text-muted-foreground">Request a personalized explanation from our tutors</p>
                  </div>
                  <Button variant="outline" onClick={handleRequestHumanHelp}>
                    <Users className="h-4 w-4 mr-2" />Request Human Help
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Human Response */}
      {humanResponse && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Human Expert Explanation</CardTitle>
              </div>
              {humanResponse.is_approved
                ? <Badge variant="default" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
                : <Badge variant="outline">Pending Review</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <MarkdownContent content={humanResponse.explanation} />

            {humanResponse.teaching_notes && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-1">Teaching Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{humanResponse.teaching_notes}</p>
              </div>
            )}

            {resolvedVideoUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Video className="h-4 w-4" />Video Explanation
                </p>
                <VideoPlayer url={resolvedVideoUrl} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending human response */}
      {question.human_requested && !humanResponse && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center gap-4 py-8">
            <Users className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium">Human Help Requested</p>
              <p className="text-sm text-muted-foreground">Our tutors are reviewing your question. You'll be notified when ready.</p>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground animate-pulse ml-auto" />
          </CardContent>
        </Card>
      )}

      {/* Pending AI response */}
      {!aiResponse && (question.status === 'pending' || question.status === 'processing') && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="font-medium">Processing your question</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
