'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { getAIProvider } from '@/lib/ai';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { CheckCircle2, Clock, XCircle, Loader2, Star, BookOpen, Upload, Sparkles, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/shared/pagination-controls';

type HumanResponse = Database['public']['Tables']['human_responses']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
type Domain = Database['public']['Tables']['domains']['Row'];
type Skill = Database['public']['Tables']['skills']['Row'];

interface Item { response: HumanResponse; question: Question; }

export default function CreatorCompletedPage() {
  const { user } = useAuth();
  const [pendingItems, setPendingItems] = useState<Item[]>([]);
  const [historyItems, setHistoryItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const historyPagination = usePagination(20);

  // Promote dialog state
  const [promoteItem, setPromoteItem] = useState<Item | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const buildItems = async (responsesData: HumanResponse[]): Promise<Item[]> => {
    if (!responsesData.length) return [];
    const questionIds = responsesData.map((r) => r.question_id);
    const { data: questionsData } = await supabase.from('questions').select('*').in('id', questionIds);
    const questionsMap = new Map((questionsData || []).map((q) => [q.id, q]));
    return responsesData
      .map((response) => ({ response, question: questionsMap.get(response.question_id)! }))
      .filter((r) => r.question);
  };

  const loadCounts = async () => {
    if (!user) return;
    try {
      const base = () =>
        supabase.from('human_responses').select('id', { count: 'exact', head: true }).eq('creator_id', user.id);
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        base().not('is_approved', 'is', true).neq('status', 'failed'),
        base().eq('is_approved', true),
        base().eq('status', 'failed'),
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
      const [pendingRes, historyRes, domainsRes, skillsRes] = await Promise.all([
        // Pending: bounded, actively-worked set — fetched in full with a safety cap
        supabase
          .from('human_responses')
          .select('*')
          .eq('creator_id', user.id)
          .not('is_approved', 'is', true)
          .neq('status', 'failed')
          .order('created_at', { ascending: true })
          .limit(300),
        // History: this used to have zero limit and would grow forever —
        // now range-paginated with a real total count.
        supabase
          .from('human_responses')
          .select('*', { count: 'exact' })
          .eq('creator_id', user.id)
          .or('is_approved.eq.true,status.eq.failed')
          .order('created_at', { ascending: false })
          .range(...historyPagination.range),
        supabase.from('domains').select('*').order('display_order'),
        supabase.from('skills').select('*').order('display_order'),
      ]);

      if (pendingRes.error) throw pendingRes.error;
      if (historyRes.error) throw historyRes.error;

      const [pendingList, historyList] = await Promise.all([
        buildItems(pendingRes.data || []),
        buildItems(historyRes.data || []),
      ]);

      setPendingItems(pendingList);
      setHistoryItems(historyList);
      historyPagination.setTotalCount(historyRes.count ?? 0);

      if (domainsRes.data) setDomains(domainsRes.data);
      if (skillsRes.data) setSkills(skillsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, historyPagination.page]);

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openPromoteDialog = (item: Item) => {
    setPromoteItem(item);
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

  const handleGenerateWithAI = async () => {
    if (!promoteItem) return;
    setIsGeneratingPromote(true);
    try {
      const { data: attachmentRows } = await supabase
        .from('attachments')
        .select('storage_path, file_type')
        .eq('question_id', promoteItem.question.id);

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
          if (!firstImagePath && !att.file_type?.includes('pdf')) firstImagePath = att.storage_path;
        }
      }

      const result = await getAIProvider().generateResponse({
        type: 'extract_questions',
        content: `${promoteItem.question.content}\n\n---\nA tutor already explained this question as follows, use it to inform the explanation/hint fields:\n${promoteItem.response.explanation}`,
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
      toast.success('AI filled in the question — review everything before submitting.');
    } catch (err: any) {
      toast.error(err?.message || 'AI generation failed — fill it in manually.');
    } finally {
      setIsGeneratingPromote(false);
    }
  };

  const filteredSkills = skills.filter(s => s.domain_id === promoteForm.domain_id);

  const handlePromote = async () => {
    if (!promoteItem || !user) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('promote_response_to_bank', {
        p_question_id: promoteItem.question.id,
        p_response_id: promoteItem.response.id,
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

      toast.success('Question submitted for review to the question bank');
      setPromoteItem(null);

      // Update local state
      setHistoryItems(prev => prev.map(i =>
        i.response.id === promoteItem.response.id
          ? { ...i, response: { ...i.response, promoted_to_bank: true } }
          : i
      ));
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to promote question to bank: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalResponses = counts.pending + counts.approved + counts.rejected;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Completed Responses</h1>
        <p className="text-muted-foreground mt-2">Your submitted explanations ({totalResponses} total)</p>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-warning">{counts.pending}</div><p className="text-sm text-muted-foreground mt-1">Pending Review</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-success">{counts.approved}</div><p className="text-sm text-muted-foreground mt-1">Approved</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-destructive">{counts.rejected}</div><p className="text-sm text-muted-foreground mt-1">Rejected</p></CardContent></Card>
      </div>

      {pendingItems.length === 0 && historyItems.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16"><CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-lg font-medium">No responses yet</p><p className="text-muted-foreground text-sm mb-4">Head to the queue to start helping students</p><Button asChild><Link href="/creator/queue">Browse Queue</Link></Button></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {[...pendingItems, ...historyItems].map(({ response, question }) => {
            const isApproved = response.is_approved;
            const isFailed = response.status === 'failed';
            const isPromoted = response.promoted_to_bank || (response.metadata as any)?.promoted_to_bank;
            return (
              <Card key={response.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {isApproved ? (
                          <Badge className="bg-success/10 text-success border-success/25"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
                        ) : isFailed ? (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
                        ) : (
                          <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>
                        )}
                        {response.student_rating && (
                          <Badge variant="outline" className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-warning/70" />{response.student_rating}/5</Badge>
                        )}
                        {isPromoted && (
                          <Badge variant="outline" className="bg-info/10 text-info border-info/25 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            In Bank
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium">{question.title || 'Untitled Question'}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{response.explanation.substring(0, 150)}...</p>
                      <p className="text-xs text-muted-foreground mt-2">{new Date(response.created_at).toLocaleDateString()}</p>
                      {response.admin_feedback && (
                        <p className="text-xs text-warning mt-1">
                          {response.rejection_reason && (
                            <span className="font-medium capitalize">{response.rejection_reason.replace(/_/g, ' ')}: </span>
                          )}
                          {response.admin_feedback}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isApproved && !isPromoted && (
                        <Button
                          size="sm"
                          onClick={() => openPromoteDialog({ response, question })}
                          title="Promote to Question Bank"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Promote
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild><Link href={`/questions/${question.id}`}>View</Link></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {historyItems.length > 0 && (
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

      {/* Promote to Question Bank Dialog */}
      <Dialog open={!!promoteItem} onOpenChange={(open) => !open && setPromoteItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Promote to Question Bank
            </DialogTitle>
            <DialogDescription>
              Review and submit this answered question to the question bank for admin review.
            </DialogDescription>
          </DialogHeader>

          {promoteItem && (
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
                context, and classification below. Review everything before submitting — AI can get this wrong.
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
            <Button variant="outline" onClick={() => setPromoteItem(null)}>
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
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
