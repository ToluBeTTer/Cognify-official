'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { getAIProvider } from '@/lib/ai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  Eye,
  Star,
  Video,
  BookOpen,
  Upload,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { resolveResponseVideoUrl } from '@/lib/supabase/video-url';

type HumanResponse = Database['public']['Tables']['human_responses']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
type Domain = Database['public']['Tables']['domains']['Row'];
type Skill = Database['public']['Tables']['skills']['Row'];

interface PendingReview {
  response: HumanResponse;
  question: Question;
  creatorName: string;
}

export default function AdminCompletedPage() {
  const { user, profile } = useAuth();
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [historyReviews, setHistoryReviews] = useState<PendingReview[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [viewItem, setViewItem] = useState<PendingReview | null>(null);
  const [viewVideoUrl, setViewVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!viewItem) {
      setViewVideoUrl(null);
      return;
    }
    let cancelled = false;
    resolveResponseVideoUrl(viewItem.response).then((url) => {
      if (!cancelled) setViewVideoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [viewItem]);
  const [feedbackText, setFeedbackText] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const historyPagination = usePagination(20);

  // Promote to bank state
  const [promoteDialog, setPromoteDialog] = useState<PendingReview | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [promoteForm, setPromoteForm] = useState({
    section: '' as 'math' | 'reading' | 'writing' | '',
    domain_id: '',
    skill_id: '',
    difficulty: '' as 'easy' | 'medium' | 'hard' | '',
    question_text: '',
    passage: '',
    image_url: '',
    choices: [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
    correct_answer: '',
    explanation: '',
    hint: '',
    estimated_time: '',
    tags: '',
  });
  const [isGeneratingPromote, setIsGeneratingPromote] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isCreatorOrAdmin = profile?.role === 'creator' || profile?.role === 'admin';

  const buildEnrichedItems = async (responsesData: HumanResponse[]): Promise<PendingReview[]> => {
    if (!responsesData.length) return [];

    const questionIds = responsesData.map((r) => r.question_id);
    const { data: questionsData } = await supabase.from('questions').select('*').in('id', questionIds);

    const creatorIds = Array.from(new Set(responsesData.map((r) => r.creator_id)));
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', creatorIds);

    const questionsMap = new Map((questionsData || []).map((q) => [q.id, q]));
    const profilesMap = new Map((profilesData || []).map((p) => [p.user_id, p.full_name || 'Unknown']));

    return responsesData
      .map((response) => ({
        response,
        question: questionsMap.get(response.question_id)!,
        creatorName: profilesMap.get(response.creator_id) || 'Unknown',
      }))
      .filter((r) => r.question);
  };

  const loadCounts = async () => {
    if (!user) return;
    try {
      const base = () => {
        let q = supabase.from('human_responses').select('id', { count: 'exact', head: true });
        if (!isAdmin) q = q.eq('creator_id', user.id);
        return q;
      };
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        base().not('is_approved', 'is', true).neq('status', 'failed'),
        base().eq('is_approved', true),
        base().eq('status', 'failed').not('is_approved', 'is', true),
      ]);
      setCounts({
        pending: pendingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        rejected: rejectedRes.count ?? 0,
      });
    } catch (err) {
      console.error('Failed to load response counts:', err);
    }
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      // Pending review is a naturally bounded, actively-worked queue (like
      // the request queue) — a healthy pipeline keeps this small, so it's
      // fetched in full rather than paginated, with a generous safety cap.
      let pendingQuery = supabase
        .from('human_responses')
        .select('*')
        .not('is_approved', 'is', true)
        .neq('status', 'failed')
        .order('created_at', { ascending: true })
        .limit(300);
      if (!isAdmin) pendingQuery = pendingQuery.eq('creator_id', user.id);

      // Approved + rejected are permanent history that only grows — this is
      // the part that previously had zero limit at all and would eventually
      // load the entire lifetime table on every visit. Paginated for real.
      let historyQuery = supabase
        .from('human_responses')
        .select('*', { count: 'exact' })
        .or('is_approved.eq.true,status.eq.failed')
        .order('created_at', { ascending: false })
        .range(...historyPagination.range);
      if (!isAdmin) historyQuery = historyQuery.eq('creator_id', user.id);

      const [pendingRes, historyRes] = await Promise.all([pendingQuery, historyQuery]);

      if (pendingRes.error) throw pendingRes.error;
      if (historyRes.error) throw historyRes.error;

      const [pendingItems, historyItems] = await Promise.all([
        buildEnrichedItems(pendingRes.data || []),
        buildEnrichedItems(historyRes.data || []),
      ]);

      setPendingReviews(pendingItems);
      setHistoryReviews(historyItems);
      historyPagination.setTotalCount(historyRes.count ?? 0);

      // Load domains and skills for promote dialog
      const [domainsRes, skillsRes] = await Promise.all([
        supabase.from('domains').select('*').order('display_order'),
        supabase.from('skills').select('*').order('display_order'),
      ]);
      if (domainsRes.data) setDomains(domainsRes.data);
      if (skillsRes.data) setSkills(skillsRes.data);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to load responses: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user, isAdmin, historyPagination.page]);
  useEffect(() => { loadCounts(); }, [user, isAdmin]);

  const handleApprove = async (item: PendingReview) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('human_responses')
        .update({
          is_approved: true,
          admin_feedback: feedbackText || null,
          approved_at: new Date().toISOString(),
          status: 'ready',
        })
        .eq('id', item.response.id);

      if (error) throw error;

      // Move question to completed
      await supabase
        .from('questions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', item.response.question_id);

      // Notify student
      await supabase.from('notifications').insert({
        user_id: item.question.user_id,
        type: 'response_approved',
        title: 'Expert Response Approved',
        message: `Your expert response for "${item.question.title || 'your question'}" has been approved.`,
        question_id: item.question.id,
        human_response_id: item.response.id,
      });

      toast.success('Response approved and student notified');
      setViewItem(null);
      setFeedbackText(''); setRejectionReason('');
      fetchData();
      loadCounts();
    } catch (err: any) {
      toast.error(`Failed to approve response: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (item: PendingReview) => {
    if (!rejectionReason) {
      toast.error('Please select a rejection reason');
      return;
    }
    if (!feedbackText.trim()) {
      toast.error('Please provide feedback before rejecting');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('human_responses')
        .update({
          is_approved: false,
          admin_feedback: feedbackText,
          rejection_reason: rejectionReason,
          status: 'failed',
        })
        .eq('id', item.response.id);

      if (error) throw error;

      // Move question back to human_requested
      await supabase
        .from('questions')
        .update({ status: 'human_requested' })
        .eq('id', item.response.question_id);

      toast.success('Response rejected with feedback');
      setViewItem(null);
      setFeedbackText(''); setRejectionReason('');
      fetchData();
      loadCounts();
    } catch (err: any) {
      toast.error(`Failed to reject response: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPromoteDialog = (item: PendingReview) => {
    setPromoteDialog(item);
    // Pre-fill form with available data
    setPromoteForm({
      section: '',
      domain_id: '',
      skill_id: '',
      difficulty: item.question.difficulty_perceived as any || '',
      question_text: item.question.content,
      passage: '',
      image_url: '',
      choices: [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ],
      correct_answer: 'A',
      explanation: item.response.explanation,
      hint: '',
      estimated_time: '90',
      tags: '',
    });
  };

  // Uses the same AI extraction Milo already runs for image/PDF bulk imports,
  // pointed at this one original student question — reads any attached
  // image/passage/graph and turns it into a structured question (choices,
  // correct answer, context) the admin/creator can then edit before saving.
  const handleGenerateWithAI = async () => {
    if (!promoteDialog) return;
    setIsGeneratingPromote(true);
    try {
      const { data: attachmentRows } = await supabase
        .from('attachments')
        .select('storage_path, file_type')
        .eq('question_id', promoteDialog.question.id);

      const attachments = [];
      let firstImagePath: string | null = null;
      for (const att of attachmentRows ?? []) {
        const { data: signed } = await supabase.storage
          .from('question-attachments')
          .createSignedUrl(att.storage_path, 3600);
        if (signed?.signedUrl) {
          attachments.push({
            type: (att.file_type?.includes('pdf') ? 'pdf' : 'image') as 'pdf' | 'image',
            url: signed.signedUrl,
          });
          // Store the permanent storage path, not the signed URL — signed
          // URLs expire in an hour and this needs to keep working for as
          // long as the question sits in the bank. Resolved fresh at
          // render time, same fix already applied to response videos.
          if (!firstImagePath && !att.file_type?.includes('pdf')) firstImagePath = att.storage_path;
        }
      }

      const result = await getAIProvider().generateResponse({
        type: 'extract_questions',
        content: `${promoteDialog.question.content}\n\n---\nA tutor already explained this question as follows, use it to inform the explanation/hint fields:\n${promoteDialog.response.explanation}`,
        attachments,
      });

      if (!result.success || !result.data?.extractedQuestions?.length) {
        toast.error(result.error || 'AI could not extract a structured question from this one — fill it in manually.');
        return;
      }

      const q = result.data.extractedQuestions[0];
      const choiceEntries = q.choices
        ? Object.entries(q.choices as Record<string, string>).map(([key, text]) => ({
            label: key.toUpperCase(),
            text: text || '',
          }))
        : promoteForm.choices;

      setPromoteForm((prev) => ({
        ...prev,
        question_text: q.question_text || prev.question_text,
        passage: q.passage || prev.passage,
        image_url:
          firstImagePath && (q.question_format === 'graph_table' || q.question_format === 'image_based')
            ? firstImagePath
            : prev.image_url,
        choices: choiceEntries.length === 4 ? choiceEntries : prev.choices,
        correct_answer: q.correct_answer || prev.correct_answer,
        explanation: q.explanation || prev.explanation,
        hint: q.hint || prev.hint,
        section: (q.section as any) || prev.section,
        difficulty: (q.difficulty as any) || prev.difficulty,
      }));
      toast.success('AI filled in the question — review everything before publishing.');
    } catch (err: any) {
      toast.error(err?.message || 'AI generation failed — fill it in manually.');
    } finally {
      setIsGeneratingPromote(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteDialog || !user) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('promote_response_to_bank', {
        p_question_id: promoteDialog.question.id,
        p_response_id: promoteDialog.response.id,
        p_promoted_by: user.id,
        p_section: promoteForm.section || null,
        p_domain_id: promoteForm.domain_id || null,
        p_skill_id: promoteForm.skill_id || null,
        p_difficulty: promoteForm.difficulty || null,
        p_tags: promoteForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        p_question_text: promoteForm.question_text,
        p_correct_answer: promoteForm.correct_answer,
        p_explanation: promoteForm.explanation,
        p_hint: promoteForm.hint || null,
        p_estimated_time_seconds: promoteForm.estimated_time ? parseInt(promoteForm.estimated_time) : null,
        p_calculator_allowed: true,
        p_choices: promoteForm.choices.some((c) => c.text.trim())
          ? promoteForm.choices.filter((c) => c.text.trim())
          : null,
        p_passage: promoteForm.passage.trim() || null,
        p_image_url: promoteForm.image_url || null,
      });

      if (error) throw error;

      toast.success(isAdmin
        ? 'Question published to the question bank'
        : 'Question submitted for review to the question bank'
      );
      setPromoteDialog(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to promote question to bank: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSkills = skills.filter(s => s.domain_id === promoteForm.domain_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const approvedHistory = historyReviews.filter((r) => r.response.is_approved);
  const rejectedHistory = historyReviews.filter((r) => r.response.status === 'failed' && !r.response.is_approved);
  const totalResponses = counts.pending + counts.approved + counts.rejected;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isAdmin ? 'Response Approval' : 'Completed Responses'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isAdmin
            ? `Review and approve human tutor responses (${counts.pending} pending)`
            : `Your submitted explanations (${totalResponses})`}
        </p>
      </div>

      {/* Stats — these reflect the whole history, independent of which page of
          approved/rejected happens to be loaded below */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-warning">{counts.pending}</div>
            <p className="text-sm text-muted-foreground mt-1">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-success">{counts.approved}</div>
            <p className="text-sm text-muted-foreground mt-1">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-destructive">{counts.rejected}</div>
            <p className="text-sm text-muted-foreground mt-1">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending — bounded, workflow-active set, shown in full */}
      {pendingReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Review ({pendingReviews.length})
          </h2>
          {pendingReviews.map((item) => (
            <ResponseCard
              key={item.response.id}
              item={item}
              isAdmin={isAdmin}
              canPromote={isCreatorOrAdmin}
              onReview={() => { setViewItem(item); setFeedbackText(''); setRejectionReason(''); }}
              onPromote={() => openPromoteDialog(item)}
            />
          ))}
        </div>
      )}

      {/* Approved + Rejected — permanent, ever-growing history, paginated */}
      {approvedHistory.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Approved
          </h2>
          {approvedHistory.map((item) => (
            <ResponseCard
              key={item.response.id}
              item={item}
              isAdmin={isAdmin}
              canPromote={isCreatorOrAdmin}
              onReview={() => { setViewItem(item); setFeedbackText(''); setRejectionReason(''); }}
              onPromote={() => openPromoteDialog(item)}
            />
          ))}
        </div>
      )}

      {rejectedHistory.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Rejected
          </h2>
          {rejectedHistory.map((item) => (
            <ResponseCard
              key={item.response.id}
              item={item}
              isAdmin={isAdmin}
              canPromote={false}
              onReview={() => { setViewItem(item); setFeedbackText(''); setRejectionReason(''); }}
              onPromote={() => {}}
            />
          ))}
        </div>
      )}

      {historyReviews.length > 0 && (
        <PaginationControls
          page={historyPagination.page}
          totalPages={historyPagination.totalPages}
          totalCount={historyPagination.totalCount}
          pageSize={historyPagination.pageSize}
          hasPrev={historyPagination.hasPrev}
          hasNext={historyPagination.hasNext}
          onPrev={historyPagination.prevPage}
          onNext={historyPagination.nextPage}
          itemLabel="approved/rejected responses"
        />
      )}

      {pendingReviews.length === 0 && historyReviews.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No responses yet</p>
            <p className="text-muted-foreground text-sm">Responses will appear here once submitted</p>
          </CardContent>
        </Card>
      )}

      {/* Review dialog */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle>Review Response</DialogTitle>
                <DialogDescription>
                  By {viewItem.creatorName} for &ldquo;{viewItem.question.title || 'Untitled'}&rdquo;
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Question</Label>
                  <p className="mt-1 text-sm p-3 bg-muted/50 rounded-lg">
                    {viewItem.question.content}
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Explanation</Label>
                  <div className="mt-1 text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">
                    {viewItem.response.explanation}
                  </div>
                </div>

                {viewItem.response.teaching_notes && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Teaching Notes</Label>
                    <p className="mt-1 text-sm p-3 bg-muted/50 rounded-lg">
                      {viewItem.response.teaching_notes}
                    </p>
                  </div>
                )}

                {viewVideoUrl && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Video className="h-4 w-4" />
                    <a href={viewVideoUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      View attached video
                    </a>
                  </div>
                )}

                {isAdmin && viewItem.response.status !== 'ready' && !viewItem.response.is_approved && viewItem.response.status !== 'failed' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="rejection-reason">Rejection reason (required to reject)</Label>
                      <Select value={rejectionReason} onValueChange={setRejectionReason}>
                        <SelectTrigger id="rejection-reason">
                          <SelectValue placeholder="Select a reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="out_of_scope">Out of scope</SelectItem>
                          <SelectItem value="insufficient_info">Insufficient info</SelectItem>
                          <SelectItem value="duplicate">Duplicate</SelectItem>
                          <SelectItem value="incorrect">Incorrect</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedback">Feedback (required to reject, optional to approve)</Label>
                      <Textarea
                        id="feedback"
                        placeholder="Provide feedback for the creator..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                {isAdmin && !viewItem.response.is_approved && viewItem.response.status !== 'failed' ? (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(viewItem)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(viewItem)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setViewItem(null)}>Close</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote to Question Bank Dialog */}
      <Dialog open={!!promoteDialog} onOpenChange={(open) => !open && setPromoteDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Promote to Question Bank
            </DialogTitle>
            <DialogDescription>
              Review and add this answered question to the question bank.
              {isAdmin && ' As an admin, this will be published immediately.'}
              {isCreatorOrAdmin && !isAdmin && ' As a creator, this will be submitted for admin review.'}
            </DialogDescription>
          </DialogHeader>

          {promoteDialog && (
            <div className="space-y-4 py-4">
              <Button
                variant="outline"
                className="w-full gap-2 border-primary/40 hover:bg-primary/5"
                onClick={handleGenerateWithAI}
                disabled={isGeneratingPromote}
              >
                {isGeneratingPromote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate structured question with AI
              </Button>
              <p className="text-xs text-muted-foreground -mt-2">
                Reads the original question (and any attached image) and fills in answer choices, passage
                context, and classification below. Review everything before publishing — AI can get this wrong.
              </p>

              {/* Question Text */}
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Textarea
                  value={promoteForm.question_text}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, question_text: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Passage / reading context */}
              <div className="space-y-2">
                <Label>Passage / Context (optional)</Label>
                <Textarea
                  value={promoteForm.passage}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, passage: e.target.value }))}
                  rows={4}
                  placeholder="A reading passage, paragraph, or poem this question depends on, if any"
                />
                {promoteForm.image_url && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> A graph/chart image from the original question will carry over.
                  </p>
                )}
              </div>

              {/* Answer Choices */}
              <div className="space-y-2">
                <Label>Answer Choices</Label>
                <div className="space-y-2">
                  {promoteForm.choices.map((choice, idx) => (
                    <div key={choice.label} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPromoteForm(prev => ({ ...prev, correct_answer: choice.label }))}
                        className={`shrink-0 h-8 w-8 rounded-full border-2 text-xs font-semibold flex items-center justify-center transition-colors ${
                          promoteForm.correct_answer === choice.label
                            ? 'border-success bg-success/10 text-success'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                        title="Mark as correct answer"
                      >
                        {choice.label}
                      </button>
                      <Input
                        value={choice.text}
                        onChange={(e) => {
                          const next = [...promoteForm.choices];
                          next[idx] = { ...next[idx], text: e.target.value };
                          setPromoteForm(prev => ({ ...prev, choices: next }));
                        }}
                        placeholder={`Choice ${choice.label}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the letter to mark the correct answer. Leave all four blank for a grid-in / numeric-entry question.
                </p>
              </div>

              {/* Correct Answer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Input
                    value={promoteForm.correct_answer}
                    onChange={(e) => setPromoteForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                    placeholder="e.g., A, B, C, D, or a numeric value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Est. Time (seconds)</Label>
                  <Input
                    type="number"
                    value={promoteForm.estimated_time}
                    onChange={(e) => setPromoteForm(prev => ({ ...prev, estimated_time: e.target.value }))}
                    placeholder="90"
                  />
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <Label>Explanation</Label>
                <Textarea
                  value={promoteForm.explanation}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, explanation: e.target.value }))}
                  rows={4}
                />
              </div>

              {/* Hint */}
              <div className="space-y-2">
                <Label>Hint (optional)</Label>
                <Input
                  value={promoteForm.hint}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, hint: e.target.value }))}
                  placeholder="A helpful hint for students"
                />
              </div>

              <Separator />

              {/* Classification */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={promoteForm.section}
                    onValueChange={(v) => setPromoteForm(prev => ({ ...prev, section: v as any, domain_id: '', skill_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="reading">Reading</SelectItem>
                      <SelectItem value="writing">Writing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select
                    value={promoteForm.domain_id}
                    onValueChange={(v) => setPromoteForm(prev => ({ ...prev, domain_id: v, skill_id: '' }))}
                    disabled={!promoteForm.section}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains
                        .filter(d => {
                          const domainSubject = d.subject_id?.includes('math') ? 'math' :
                                               d.subject_id?.includes('reading') ? 'reading' : 'writing';
                          return domainSubject === promoteForm.section;
                        })
                        .map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Skill</Label>
                  <Select
                    value={promoteForm.skill_id}
                    onValueChange={(v) => setPromoteForm(prev => ({ ...prev, skill_id: v }))}
                    disabled={!promoteForm.domain_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSkills.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code ? `${s.code}: ` : ''}{s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={promoteForm.difficulty}
                    onValueChange={(v) => setPromoteForm(prev => ({ ...prev, difficulty: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    value={promoteForm.tags}
                    onChange={(e) => setPromoteForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="algebra, equations (comma-separated)"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPromoteDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handlePromote}
              disabled={isSubmitting || !promoteForm.question_text}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isAdmin ? 'Publish to Bank' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResponseCard({
  item,
  isAdmin,
  canPromote,
  onReview,
  onPromote,
}: {
  item: PendingReview;
  isAdmin: boolean;
  canPromote: boolean;
  onReview: () => void;
  onPromote: () => void;
}) {
  const { response, question, creatorName } = item;

  const statusBadge = response.is_approved
    ? { label: 'Approved', variant: 'default' as const, className: 'bg-success/10 text-success border-success/25' }
    : response.status === 'failed'
    ? { label: 'Rejected', variant: 'destructive' as const, className: '' }
    : { label: 'Pending Review', variant: 'secondary' as const, className: '' };

  const isPromoted = response.promoted_to_bank || (response.metadata as any)?.promoted_to_bank;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={statusBadge.variant} className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
              {isAdmin && (
                <span className="text-xs text-muted-foreground">by {creatorName}</span>
              )}
              {response.student_rating && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-warning/70" />
                  {response.student_rating}/5
                </Badge>
              )}
              {isPromoted && (
                <Badge variant="outline" className="bg-info/10 text-info border-info/25 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  In Bank
                </Badge>
              )}
            </div>
            <h3 className="font-medium">{question.title || 'Untitled Question'}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {response.explanation.substring(0, 150)}...
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(response.created_at).toLocaleDateString()}
              </span>
              {response.admin_feedback && (
                <span className="text-warning font-medium">Has feedback</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onReview}>
              <Eye className="h-4 w-4 mr-1" />
              Review
            </Button>
            {response.is_approved && canPromote && !isPromoted && (
              <Button
                variant="default"
                size="sm"
                onClick={onPromote}
                title="Promote to Question Bank"
              >
                <Upload className="h-4 w-4 mr-1" />
                Promote
              </Button>
            )}
            <Link
              href={`/questions/${question.id}`}
              className="text-primary hover:underline flex items-center gap-1 text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
