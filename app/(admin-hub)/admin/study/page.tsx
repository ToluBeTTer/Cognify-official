'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import {
  MODE_DEFINITIONS,
  getModeDefinition,
  fetchQuestionsForMode,
  createPracticeSession,
  findActiveSession,
  buildTimeLimitFromCount,
} from '@/lib/practice';
import type { ModeKey, ModeDefinition, SessionConfig, PracticeSessionRow } from '@/lib/practice';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Zap, Infinity as InfinityIcon, Timer, TrendingUp, AlertTriangle,
  RefreshCw, Bookmark, GraduationCap, Database as DatabaseIcon,
  Play, Loader2, RotateCcw, Clock, CheckCircle2, ArrowRight,
  Calculator, FileText, PenTool, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Infinity: InfinityIcon, Timer, TrendingUp, AlertTriangle,
  RefreshCw, Bookmark, GraduationCap, Database: DatabaseIcon,
};

const COUNT_PRESETS = [5, 10, 20, 30];

type SetupStep = 'select' | 'configure';

interface Stats {
  totalSessions: number;
  totalAnswered: number;
  accuracy: number;
}

export default function AdminStudyPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<SetupStep>('select');
  const [selectedMode, setSelectedMode] = useState<ModeDefinition | null>(null);
  const [activeSession, setActiveSession] = useState<PracticeSessionRow | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalAnswered: 0, accuracy: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [domains, setDomains] = useState<Array<{ id: string; name: string }>>([]);

  const [section, setSection] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [domain, setDomain] = useState('all');
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }
    const load = async () => {
      const [sessRes, ansRes, domRes] = await Promise.all([
        supabase.from('practice_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('session_question_states').select('is_correct, practice_sessions!inner(user_id)').eq('practice_sessions.user_id', user.id).eq('state', 'answered').limit(1000),
        supabase.from('domains').select('id, name').order('display_order'),
      ]);
      const total = ansRes.data?.length ?? 0;
      const correct = ansRes.data?.filter((r: any) => r.is_correct).length ?? 0;
      setStats({
        totalSessions: sessRes.count ?? 0,
        totalAnswered: total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      });
      if (domRes.data) setDomains(domRes.data);
      setStatsLoading(false);
    };
    load();
  }, [user]);

  const handleSelectMode = useCallback(async (mode: ModeDefinition) => {
    if (mode.key === 'question_bank') {
      router.push('/admin/question-bank');
      return;
    }
    setSelectedMode(mode);
    setSection('all');
    setDifficulty('all');
    setDomain('all');
    setQuestionCount(mode.defaultConfig.questionCountTarget ?? 10);

    if (user) {
      const existing = await findActiveSession(user.id, mode.key);
      if (existing) {
        setActiveSession(existing);
        setResumeDialogOpen(true);
        return;
      }
    }
    setStep('configure');
  }, [user, router]);

  const handleResumeSession = () => {
    if (!activeSession) return;
    setResumeDialogOpen(false);
    router.push(`/practice/session?session=${activeSession.id}`);
  };

  const handleStartNew = async () => {
    if (!activeSession) { setResumeDialogOpen(false); setStep('configure'); return; }
    await supabase.from('practice_sessions').update({ status: 'abandoned' }).eq('id', activeSession.id);
    setActiveSession(null);
    setResumeDialogOpen(false);
    setStep('configure');
  };

  const handleReviewPrevious = () => {
    if (!activeSession) return;
    setResumeDialogOpen(false);
    router.push(`/practice/session?session=${activeSession.id}&review=1`);
  };

  const handleStartSession = async () => {
    if (!user || !selectedMode) return;
    setIsStarting(true);
    try {
      const config: SessionConfig = {
        modeKey: selectedMode.key,
        section,
        difficulty,
        domain,
        skill: 'all',
        questionCountTarget: selectedMode.isInfinite ? 200 : (selectedMode.fixedCount ?? questionCount),
        timeLimitSeconds: selectedMode.isTimed
          ? buildTimeLimitFromCount(selectedMode.fixedCount ?? questionCount)
          : null,
        shuffleQuestions: selectedMode.defaultConfig.shuffleQuestions ?? true,
        allowBacktracking: selectedMode.defaultConfig.allowBacktracking ?? true,
        showTimer: selectedMode.isTimed,
        adaptive: selectedMode.key === 'adaptive_practice',
        sourceType: 'stored_question',
      };

      const questionIds = await fetchQuestionsForMode(config, user.id);
      if (questionIds.length === 0) {
        toast.error('No questions found for these filters. Try different settings.');
        setIsStarting(false);
        return;
      }

      const sessionId = await createPracticeSession(user.id, { ...config, questionIds });
      router.push(`/practice/session?session=${sessionId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to start session');
      setIsStarting(false);
    }
  };

  const backToSelect = () => { setStep('select'); setSelectedMode(null); };

  const renderStats = () => (
    <div className="grid grid-cols-3 gap-3 mb-8">
      {statsLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="py-4 text-center"><div className="h-7 bg-muted animate-pulse rounded w-12 mx-auto mb-1" /><div className="h-3 bg-muted animate-pulse rounded w-16 mx-auto" /></CardContent></Card>
        ))
      ) : (
        <>
          <Card><CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Sessions Done</p>
          </CardContent></Card>
          <Card><CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{stats.totalAnswered}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Answered</p>
          </CardContent></Card>
          <Card><CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{stats.accuracy}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">Accuracy</p>
          </CardContent></Card>
        </>
      )}
    </div>
  );

  if (step === 'configure' && selectedMode) {
    const def = selectedMode;
    const Icon = ICON_MAP[def.icon] ?? Zap;
    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={backToSelect}>
            <ArrowRight className="h-4 w-4 rotate-180 mr-1" />Back
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl bg-muted', def.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{def.label}</h2>
                <p className="text-sm text-muted-foreground">{def.description}</p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              {def.allowsSectionFilter && (
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'math', label: 'Math', Icon: Calculator },
                      { value: 'reading', label: 'Reading', Icon: FileText },
                      { value: 'writing', label: 'Writing', Icon: PenTool },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSection(opt.value); setDomain('all'); }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-1.5',
                          section === opt.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        {opt.Icon && <opt.Icon className="h-3.5 w-3.5" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {def.allowsSectionFilter && section !== 'all' && domains.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Domain <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger><SelectValue placeholder="All Domains" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {def.allowsDifficultyFilter && (
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'easy', 'medium', 'hard'].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border-2 text-sm font-medium capitalize transition-all',
                          difficulty === d
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40',
                          d === 'easy' && difficulty === d && 'border-success bg-success/10 text-success',
                          d === 'medium' && difficulty === d && 'border-warning bg-warning/10 text-warning',
                          d === 'hard' && difficulty === d && 'border-destructive bg-destructive/10 text-destructive',
                        )}
                      >
                        {d === 'all' ? 'Mixed' : d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {def.allowsCountPicker && !def.isInfinite && (
                <div className="space-y-1.5">
                  <Label>Number of Questions</Label>
                  <div className="flex flex-wrap gap-2">
                    {COUNT_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setQuestionCount(c)}
                        className={cn(
                          'w-14 py-1.5 rounded-lg border-2 text-sm font-medium transition-all text-center',
                          questionCount === c
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button className="w-full" size="lg" onClick={handleStartSession} disabled={isStarting}>
              {isStarting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting session...</>
              ) : (
                <><Play className="mr-2 h-4 w-4" />Start {def.label}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const practiceModes = MODE_DEFINITIONS.filter((m) => m.key !== 'question_bank');
  const qbMode = MODE_DEFINITIONS.find((m) => m.key === 'question_bank')!;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Center</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Practice SAT questions anytime</p>
      </div>

      {renderStats()}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Practice Modes</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {practiceModes.map((mode) => {
            const Icon = ICON_MAP[mode.icon] ?? Zap;
            return (
              <Card
                key={mode.key}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sm group"
                onClick={() => handleSelectMode(mode)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg bg-muted shrink-0 group-hover:bg-muted/70 transition-colors', mode.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-medium text-sm">{mode.label}</h3>
                        {mode.isTimed && <Badge variant="outline" className="text-[10px] py-0 h-4">Timed</Badge>}
                        {mode.isExam && <Badge variant="secondary" className="text-[10px] py-0 h-4">Exam</Badge>}
                        {mode.isInfinite && <Badge variant="outline" className="text-[10px] py-0 h-4">Infinite</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{mode.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Question Bank</h2>
        <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sm group" onClick={() => handleSelectMode(qbMode)}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg bg-muted group-hover:bg-muted/70 transition-colors', qbMode.color)}>
                <DatabaseIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">{qbMode.label}</h3>
                <p className="text-xs text-muted-foreground">{qbMode.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume Previous Session?</DialogTitle>
            <DialogDescription>You have an unfinished {selectedMode?.label} session.</DialogDescription>
          </DialogHeader>
          {activeSession && (
            <div className="py-2">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">Question {(activeSession.last_question_index ?? 0) + 1} of {activeSession.generated_question_ids?.length ?? activeSession.total_questions ?? '?'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span>{activeSession.created_at ? new Date(activeSession.created_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleReviewPrevious} className="gap-2"><CheckCircle2 className="h-4 w-4" />Review Results</Button>
            <Button variant="outline" onClick={handleStartNew} className="gap-2"><RotateCcw className="h-4 w-4" />Start New</Button>
            <Button onClick={handleResumeSession} className="gap-2"><Play className="h-4 w-4" />Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
