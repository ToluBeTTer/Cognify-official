'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { createPracticeSession, fetchQuestionsForMode } from '@/lib/practice/engine';
import type { SessionConfig } from '@/lib/practice/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  ArrowLeft,
  BookOpen,
  Calculator,
  FileText,
  PenTool,
  BarChart3,
  Loader2,
  Play,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

interface BankQuestion {
  id: string;
  display_id: string | null;
  question_text: string;
  question_format: string | null;
  choices: Array<{ label: string; text: string }> | null;
  correct_answer: string;
  explanation: string | null;
  hint: string | null;
  section: string;
  difficulty: string | null;
  calculator_allowed: boolean | null;
  domain_id: string | null;
  skill_id: string | null;
  gamemodes: string[] | null;
  visual_spec: Record<string, unknown> | null;
  visual_data: Record<string, unknown> | null;
  passage_id: string | null;
  source: string | null;
  domains?: { name: string } | null;
  skills?: { name: string; code: string } | null;
}

interface Domain {
  id: string;
  name: string;
}

export default function QuestionBankBrowsePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [domain, setDomain] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, math: 0, reading: 0, writing: 0 });
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [launchCount, setLaunchCount] = useState(10);
  const [launchMode, setLaunchMode] = useState<'quick_practice' | 'timed_practice'>('quick_practice');

  // Load domains and stats
  useEffect(() => {
    const load = async () => {
      const [domRes, statsRes, bookRes] = await Promise.all([
        supabase.from('domains').select('id, name').order('display_order'),
        supabase.from('question_bank').select('section').eq('status', 'published'),
        user
          ? supabase.from('bookmarked_questions').select('question_id').eq('user_id', user.id)
          : Promise.resolve({ data: null }),
      ]);

      if (domRes.data) setDomains(domRes.data);
      if (statsRes.data) {
        const total = statsRes.data.length;
        const math = statsRes.data.filter((q: any) => q.section === 'math').length;
        const reading = statsRes.data.filter((q: any) => q.section === 'reading').length;
        const writing = statsRes.data.filter((q: any) => q.section === 'writing').length;
        setStats({ total, math, reading, writing });
      }
      if (bookRes.data) {
        setBookmarkedIds(new Set((bookRes.data as any[]).map((r) => r.question_id)));
      }
    };
    load();
  }, [user]);

  // Load questions with filters
  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      let q = supabase
        .from('question_bank')
        .select('*, domains(name), skills(name, code)')
        .eq('status', 'published')
        .order('display_id', { ascending: true });

      if (section !== 'all') q = q.eq('section', section);
      if (difficulty !== 'all') q = q.eq('difficulty', difficulty);
      if (domain !== 'all') q = q.eq('domain_id', domain);

      const { data, error } = await q.limit(200);
      if (error) { toast.error('Failed to load questions'); setIsLoading(false); return; }

      const filtered = search.trim()
        ? (data ?? []).filter((q: BankQuestion) =>
            q.question_text.toLowerCase().includes(search.toLowerCase()) ||
            q.display_id?.toLowerCase().includes(search.toLowerCase())
          )
        : (data ?? []);

      setQuestions(filtered as BankQuestion[]);
      setIsLoading(false);
    };
    loadQuestions();
  }, [section, difficulty, domain, search]);

  const toggleBookmark = useCallback(async (questionId: string) => {
    if (!user) { toast.error('Sign in to bookmark questions'); return; }
    const isBookmarked = bookmarkedIds.has(questionId);
    if (isBookmarked) {
      await supabase.from('bookmarked_questions').delete().eq('user_id', user.id).eq('question_id', questionId);
      setBookmarkedIds((prev) => { const s = new Set(prev); s.delete(questionId); return s; });
    } else {
      await supabase.from('bookmarked_questions').upsert({ user_id: user.id, question_id: questionId });
      setBookmarkedIds((prev) => new Set(Array.from(prev).concat(questionId)));
    }
  }, [user, bookmarkedIds]);

  const handleLaunchSession = async () => {
    if (!user) { toast.error('Sign in to start a session'); return; }
    setIsStartingSession(true);
    try {
      const config: SessionConfig = {
        modeKey: launchMode,
        section,
        difficulty,
        domain,
        skill: 'all',
        questionCountTarget: launchCount,
        timeLimitSeconds: launchMode === 'timed_practice' ? launchCount * 70 : null,
        shuffleQuestions: true,
        allowBacktracking: true,
        showTimer: launchMode === 'timed_practice',
        adaptive: false,
        sourceType: 'stored_question',
      };
      const ids = await fetchQuestionsForMode(config, user.id);
      if (ids.length === 0) { toast.error('No questions match these filters.'); setIsStartingSession(false); return; }
      const sessionId = await createPracticeSession(user.id, { ...config, questionIds: ids });
      router.push(`/practice/session?session=${sessionId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to start session');
      setIsStartingSession(false);
    }
  };

  const sectionColor = (s: string) => {
    if (s === 'math') return 'text-info';
    if (s === 'reading') return 'text-success';
    if (s === 'writing') return 'text-warning';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Browse, filter, and search all published SAT questions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/study"><ArrowLeft className="h-4 w-4 mr-1.5" />Practice</Link>
          </Button>
          {(profile?.role === 'creator' || profile?.role === 'admin') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/question-bank/import">Import Questions</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: stats.total, icon: BookOpen, active: section === 'all', onClick: () => setSection('all') },
          { label: 'Math', count: stats.math, icon: Calculator, active: section === 'math', onClick: () => setSection(section === 'math' ? 'all' : 'math') },
          { label: 'Reading', count: stats.reading, icon: FileText, active: section === 'reading', onClick: () => setSection(section === 'reading' ? 'all' : 'reading') },
          { label: 'Writing', count: stats.writing, icon: PenTool, active: section === 'writing', onClick: () => setSection(section === 'writing' ? 'all' : 'writing') },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={cn('cursor-pointer transition-all hover:border-primary/50', stat.active && 'border-primary bg-primary/5')}
              onClick={stat.onClick}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', stat.active ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-sm font-medium">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stat.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setLaunchDialogOpen(true)}
          disabled={questions.length === 0}
          className="gap-1.5"
        >
          <Play className="h-4 w-4" />
          Start Session
        </Button>
      </div>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        {isLoading ? 'Loading...' : `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No questions found</p>
          <p className="text-sm mt-1">Try different filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => {
            const isExpanded = expandedId === q.id;
            const isBookmarked = bookmarkedIds.has(q.id);
            const choices = Array.isArray(q.choices) ? q.choices as Array<{ label: string; text: string }> : [];
            return (
              <Card key={q.id} className={cn('transition-all', isExpanded && 'border-primary/40')}>
                <button
                  className="w-full text-left px-4 pt-3 pb-3 hover:bg-muted/30 transition-colors rounded-t-xl"
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {q.display_id && (
                            <Badge variant="outline" className="text-[10px] font-mono">{q.display_id}</Badge>
                          )}
                          <Badge variant="secondary" className={cn('text-[10px] capitalize', sectionColor(q.section))}>
                            {q.section}
                          </Badge>
                          {q.difficulty && (
                            <Badge
                              variant={q.difficulty === 'easy' ? 'secondary' : q.difficulty === 'hard' ? 'destructive' : 'default'}
                              className="text-[10px] capitalize"
                            >{q.difficulty}</Badge>
                          )}
                          {q.domains?.name && (
                            <Badge variant="outline" className="text-[10px]">{q.domains.name}</Badge>
                          )}
                          {q.skills?.code && (
                            <Badge variant="outline" className="text-[10px] font-mono">{q.skills.code}</Badge>
                          )}
                          {q.visual_spec && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <BarChart3 className="h-2.5 w-2.5" />Visual
                            </Badge>
                          )}
                          {q.calculator_allowed && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Calculator className="h-2.5 w-2.5" />Calc OK
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(q.id); }}
                      className={cn('shrink-0 h-8 w-8 p-0', isBookmarked && 'text-info')}
                    >
                      {isBookmarked ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
                    </Button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t pt-4 space-y-4">
                    {/* Full question */}
                    <p className="text-sm whitespace-pre-wrap">{q.question_text}</p>

                    {/* Visual */}
                    {q.visual_spec && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Visual question — {JSON.stringify(q.visual_spec).slice(0, 80)}...
                      </div>
                    )}

                    {/* Choices */}
                    {choices.length > 0 && (
                      <div className="space-y-1.5">
                        {choices.map((c) => (
                          <div
                            key={c.label}
                            className={cn(
                              'flex items-start gap-2.5 p-2.5 rounded-lg border text-sm',
                              c.label === q.correct_answer
                                ? 'border-success/25 bg-success/10'
                                : 'border-border'
                            )}
                          >
                            <span className="font-semibold w-4 shrink-0">{c.label}.</span>
                            <span className="flex-1">{c.text}</span>
                            {c.label === q.correct_answer && (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3 bg-info/10 rounded-lg border border-info/25">
                        <p className="text-xs font-semibold text-info mb-1">Explanation</p>
                        <p className="text-sm text-muted-foreground">{q.explanation}</p>
                      </div>
                    )}

                    {/* Hint */}
                    {q.hint && (
                      <div className="p-3 bg-warning/10 rounded-lg border border-warning/25">
                        <p className="text-xs font-semibold text-warning mb-1">Hint</p>
                        <p className="text-sm text-muted-foreground">{q.hint}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Launch session dialog */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Session from Filtered Questions</DialogTitle>
            <DialogDescription>
              {questions.length} questions match your current filters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={launchMode} onValueChange={(v) => setLaunchMode(v as typeof launchMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick_practice">Quick Practice</SelectItem>
                  <SelectItem value="timed_practice">Timed Practice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Number of Questions</Label>
              <div className="flex gap-2">
                {[5, 10, 20, 30].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLaunchCount(n)}
                    className={cn(
                      'w-14 py-1.5 rounded-lg border-2 text-sm font-medium text-center transition-all',
                      launchCount === n ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'
                    )}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLaunchSession} disabled={isStartingSession} className="gap-2">
              {isStartingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
