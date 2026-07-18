'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database as DatabaseIcon,
  Plus,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  Calculator,
  PenTool,
  Image as ImageIcon,
  Copy,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/shared/pagination-controls';

type QuestionBank = Database['public']['Tables']['question_bank']['Row'];
type Domain = Database['public']['Tables']['domains']['Row'];
type Skill = Database['public']['Tables']['skills']['Row'];

interface Question extends QuestionBank {
  domains?: { name: string } | null;
  skills?: { name: string; code: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  archived: 'Archived',
};

export default function AdminQuestionBankPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const pagination = usePagination(25);

  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    pending: 0,
    draft: 0,
  });

  // Bank-wide stats (independent of the current page/filters — these were
  // previously derived from `questions.filter(...)`, which only reflected
  // whatever 200-row slice happened to be loaded. Once the bank grows past
  // 200 rows those numbers were quietly wrong.
  const loadStats = useCallback(async () => {
    try {
      const [totalRes, publishedRes, pendingRes, draftRes] = await Promise.all([
        supabase.from('question_bank').select('id', { count: 'exact', head: true }),
        supabase.from('question_bank').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('question_bank').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('question_bank').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      ]);
      setStats({
        total: totalRes.count ?? 0,
        published: publishedRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        draft: draftRes.count ?? 0,
      });
    } catch (e) {
      console.error('Failed to load bank-wide stats:', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [domainsRes, skillsRes] = await Promise.all([
        supabase.from('domains').select('*').order('display_order'),
        supabase.from('skills').select('*').order('display_order'),
      ]);

      if (domainsRes.data) setDomains(domainsRes.data);
      if (skillsRes.data) setSkills(skillsRes.data);

      // Admins see all questions. Paginated via .range() with an exact count
      // instead of a silent .limit(200) that used to hide everything past
      // row 200 with no indication anything was missing.
      let query = supabase
        .from('question_bank')
        .select('*, domains(name), skills(name, code)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(...pagination.range);

      if (selectedSection !== 'all') {
        query = query.eq('section', selectedSection);
      }
      if (selectedDomain !== 'all') {
        query = query.eq('domain_id', selectedDomain);
      }
      if (selectedDifficulty !== 'all') {
        query = query.eq('difficulty', selectedDifficulty);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }
      if (searchQuery.trim()) {
        // Server-side search so it covers the whole bank, not just this page.
        const term = searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`question_text.ilike.%${term}%,explanation.ilike.%${term}%`);
      }

      const { data: questionsData, error, count } = await query;

      if (error) throw error;

      setQuestions((questionsData || []) as Question[]);
      pagination.setTotalCount(count ?? 0);
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to load questions: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection, selectedDomain, selectedDifficulty, selectedStatus, searchQuery, pagination.page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Jump back to page 1 whenever a filter or the search term changes —
  // otherwise you can land on a now-empty page 4 after narrowing results.
  useEffect(() => {
    pagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection, selectedDomain, selectedDifficulty, selectedStatus, searchQuery]);

  const filteredQuestions = questions;

  const handleStatusChange = async (questionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('question_bank')
        .update({ status: newStatus as any, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', questionId);

      if (error) throw error;
      toast.success('Status updated');
      loadData();
      loadStats();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to update status: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase.from('question_bank').delete().eq('id', questionId);
      if (error) throw error;
      toast.success('Question deleted');
      loadData();
      loadStats();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to delete question: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleDuplicate = async (q: Question) => {
    try {
      const { id, created_at, updated_at, reviewed_at, published_at, reviewed_by, published_by, times_used, times_correct, times_incorrect, average_time_seconds, ...questionData } = q;

      const newQuestion = {
        ...questionData,
        display_id: `${q.display_id || 'Q'}-copy`,
        status: 'draft' as const,
      };

      const { error } = await supabase
        .from('question_bank')
        .insert(newQuestion);

      if (error) throw error;
      toast.success('Question duplicated');
      loadData();
      loadStats();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to duplicate question: ${e?.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground mt-1">Manage all SAT questions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/question-bank/browse">
              <Eye className="h-4 w-4 mr-2" />
              Browse Bank
            </Link>
          </Button>
          <Button asChild>
            <Link href="/question-bank/import">
              <Plus className="h-4 w-4 mr-2" />
              Import Questions
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <p className="text-sm text-muted-foreground mt-1">Total Questions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-success">{stats.published}</div>
            <p className="text-sm text-muted-foreground mt-1">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-warning">{stats.pending}</div>
            <p className="text-sm text-muted-foreground mt-1">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-slate-600">{stats.draft}</div>
            <p className="text-sm text-muted-foreground mt-1">Drafts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="math">Math</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <DatabaseIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No questions found</p>
              <p className="text-muted-foreground text-sm">Import some questions to get started</p>
            </CardContent>
          </Card>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = expandedQuestion === q.id;
            const statusColor = q.status === 'published' ? 'bg-success/10 text-success' :
                                q.status === 'pending_review' ? 'bg-warning/10 text-warning' :
                                'bg-slate-100 text-slate-800';
            return (
              <Card key={q.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {q.display_id && (
                            <Badge variant="outline" className="font-mono text-xs bg-slate-50 dark:bg-slate-800">
                              {q.display_id}
                            </Badge>
                          )}
                          <Badge variant="outline" className={statusColor}>
                            {STATUS_LABELS[q.status] || q.status}
                          </Badge>
                          {q.section && (
                            <Badge variant="secondary">{q.section}</Badge>
                          )}
                          {q.difficulty && (
                            <Badge variant="outline">{q.difficulty}</Badge>
                          )}
                          {q.domains?.name && (
                            <Badge variant="outline" className="text-xs">{q.domains.name}</Badge>
                          )}
                          {q.skills?.name && (
                            <Badge variant="outline" className="text-xs">{q.skills.name}</Badge>
                          )}
                          {q.visual_spec && (
                            <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Visual
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm line-clamp-2">{q.question_text}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(q);
                          }}
                          title="Duplicate question"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(q.id, q.status === 'published' ? 'draft' : 'published');
                          }}
                        >
                          {q.status === 'published' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(q.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t bg-muted/30 p-4 space-y-4">
                      {q.passage && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border">
                          <Label className="text-xs text-muted-foreground">Passage</Label>
                          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{q.passage}</p>
                        </div>
                      )}
                      {q.visual_data && q.visual_spec && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border">
                          <Label className="text-xs text-muted-foreground">
                            <ImageIcon className="h-3 w-3 mr-1 inline" />
                            Visual Data ({(q.visual_spec as any)?.type || 'chart'})
                          </Label>
                          <pre className="mt-1 text-xs font-mono bg-white dark:bg-slate-900 p-2 rounded overflow-auto">
                            {JSON.stringify(q.visual_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {q.gamemodes && Array.isArray(q.gamemodes) && q.gamemodes.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Supported Modes</Label>
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {q.gamemodes.map((mode: string) => (
                              <Badge key={mode} variant="secondary" className="text-xs">{mode}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">Question</Label>
                        <p className="mt-1">{q.question_text}</p>
                      </div>
                      {q.choices && Array.isArray(q.choices) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Choices</Label>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            {(q.choices as any[]).map((c: any, i: number) => (
                              <div
                                key={i}
                                className={`p-2 rounded border text-sm ${
                                  c.label === q.correct_answer
                                    ? 'border-success bg-success/10'
                                    : 'border-border'
                                }`}
                              >
                                <span className="font-medium">{c.label}.</span> {c.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.explanation && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Explanation</Label>
                          <p className="mt-1 text-sm">{q.explanation}</p>
                        </div>
                      )}
                      {q.hint && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Hint</Label>
                          <p className="mt-1 text-sm text-muted-foreground">{q.hint}</p>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center gap-2 justify-between">
                        <div className="text-xs text-muted-foreground">
                          {q.display_id && <span className="font-mono mr-2">{q.display_id}</span>}
                          ID: {q.id.slice(0, 8)}... | Created: {new Date(q.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicate(q)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Duplicate
                          </Button>
                          <Select
                            value={q.status}
                            onValueChange={(v) => handleStatusChange(q.id, v)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="pending_review">Pending Review</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        hasPrev={pagination.hasPrev}
        hasNext={pagination.hasNext}
        onPrev={pagination.prevPage}
        onNext={pagination.nextPage}
        itemLabel="questions"
      />
    </div>
  );
}
