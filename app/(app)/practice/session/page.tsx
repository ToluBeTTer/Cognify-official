'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, supabase } from '@/lib/supabase';
import { useMascotProfile } from '@/hooks/use-mascot-profile';
import { useSessionEngine } from '@/lib/practice/engine';
import type { ModeKey } from '@/lib/practice/types';
import { getModeDefinition } from '@/lib/practice/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, Trophy,
  Lightbulb, Ban, Flag, Calculator, Grid3X3, ArrowRight,
  FileText, HelpCircle, Bookmark, BookmarkCheck, AlertCircle,
  RotateCcw, TrendingDown, TrendingUp, Infinity as InfinityIcon, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { AnswerBubble } from '@/components/ui/answer-bubble';
import confetti from 'canvas-confetti';

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function PracticeSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { awardCreditsForSession } = useMascotProfile();

  const sessionId = searchParams.get('session');
  const isReviewMode = searchParams.get('review') === '1';

  const engine = useSessionEngine(sessionId, user?.id ?? null);

  const {
    session, questions, questionStates, currentIndex, elapsed,
    isLoading, isFinishing, isFinished, error, isGeneratingMore,
    selectAnswer, submitAnswer, toggleEliminate, toggleMarkForReview,
    toggleBookmark, revealExplanation, goToQuestion, finishSession,
  } = engine;

  const [showHint, setShowHint] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isQuestionNavOpen, setIsQuestionNavOpen] = useState(false);
  const hasFiredConfettiRef = useRef(false);
  const [subjectSlugToId, setSubjectSlugToId] = useState<Record<string, string>>({});
  const [isEscalating, setIsEscalating] = useState(false);
  interface StruggleState {
    topicLabel: string;
    subject: string;
    questionText: string;
    choices: Array<{ label: string; text: string }> | null;
    correctAnswer: string;
    selectedAnswer: string | null;
    explanation: string | null;
    missCount: number;
    sent: boolean;
  }
  const [struggle, setStruggle] = useState<StruggleState | null>(null);
  // Per-topic (not just per-question-in-a-row) consecutive-miss counter — a
  // correct answer on a *different* topic shouldn't reset how stuck the
  // student is on the one they keep missing. Ported from the Base44
  // reference's StandardPractice/InfinitePractice/ChallengePractice pattern.
  const topicMissesRef = useRef<Record<string, number>>({});
  const processedForStruggleRef = useRef<Set<string>>(new Set());
  const STRUGGLE_THRESHOLD = 3;

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id, slug')
      .then(({ data }) => {
        if (data) setSubjectSlugToId(Object.fromEntries(data.map((s: any) => [s.slug, s.id])));
      });
  }, []);

  const hasAwardedCreditsRef = useRef(false);
  useEffect(() => {
    if (!isFinished || hasAwardedCreditsRef.current || !session?.id) return;
    hasAwardedCreditsRef.current = true;
    awardCreditsForSession(session.id).then((reward) => {
      if (reward > 0) toast.success(`+${reward} Cogs for Milo!`, { duration: 2500 });
    });
  }, [isFinished, session?.id, awardCreditsForSession]);

  useEffect(() => {
    if (!isFinished || hasFiredConfettiRef.current) return;
    const answered = Object.values(questionStates).filter((s) => s.state === 'answered');
    const correct = session?.correct_answers ?? answered.filter((s) => s.isCorrect).length;
    const total = session?.total_questions ?? answered.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (accuracy >= 80 && total >= 3) {
      hasFiredConfettiRef.current = true;
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        // Canvas rendering can't consume CSS custom properties directly, so
        // these are hardcoded hex approximations of --primary/--purple/--milo
        // rather than a token reference — the one legitimate exception to
        // the rest of the app using design tokens.
        colors: ['#2F6FE4', '#8355D8', '#1FA693'],
      });
    }
  }, [isFinished, questionStates, session]);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);

  const modeKey = (session?.mode_key ?? 'quick_practice') as ModeKey;
  const modeDef = getModeDefinition(modeKey);
  const isExam = modeDef?.isExam ?? false;
  const isInfinite = modeDef?.isInfinite ?? false;
  const isTimed = modeDef?.isTimed ?? (session?.show_timer ?? false);
  const timeLimitSeconds = session?.time_limit_seconds ?? null;

  // Reset hint on question change
  useEffect(() => { setShowHint(false); }, [currentIndex]);

  // Auto-finish when timer runs out
  useEffect(() => {
    if (!isTimed || !timeLimitSeconds || isFinished) return;
    if (elapsed >= timeLimitSeconds) { finishSession(); }
  }, [elapsed, timeLimitSeconds, isTimed, isFinished, finishSession]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentQState = currentQuestion ? (questionStates[currentQuestion.id] ?? null) : null;

  // Fires once per newly-answered question, updates the per-topic miss
  // tally, and opens the struggle prompt the first time a topic crosses
  // the threshold. A correct answer on that topic resets its own counter
  // but does NOT dismiss an already-open prompt for a different topic.
  useEffect(() => {
    if (!currentQuestion || currentQState?.state !== 'answered' || currentQState.isCorrect == null) return;
    if (processedForStruggleRef.current.has(currentQuestion.id)) return;
    processedForStruggleRef.current.add(currentQuestion.id);

    const topicKey = currentQuestion.skills?.name || currentQuestion.domains?.name || currentQuestion.section || 'general';

    if (currentQState.isCorrect) {
      topicMissesRef.current[topicKey] = 0;
      return;
    }

    const missCount = (topicMissesRef.current[topicKey] || 0) + 1;
    topicMissesRef.current[topicKey] = missCount;

    if (missCount >= STRUGGLE_THRESHOLD) {
      setStruggle((prev) =>
        prev
          ? prev
          : {
              topicLabel: topicKey,
              subject: currentQuestion.section,
              questionText: currentQuestion.question_text,
              choices: currentQuestion.choices ?? null,
              correctAnswer: currentQuestion.correct_answer,
              selectedAnswer: currentQState.selectedAnswer,
              explanation: currentQuestion.explanation ?? null,
              missCount,
              sent: false,
            }
      );
    }
  }, [currentQuestion, currentQState]);

  const handleEscalate = useCallback(async () => {
    if (!struggle || !user || isEscalating) return;
    setIsEscalating(true);
    try {
      const choiceLines = (struggle.choices ?? []).map((c) => `${c.label}) ${c.text}`).join('\n');
      const contextNotes =
        `Escalated automatically from a practice session after ${struggle.missCount} "${struggle.topicLabel}" ` +
        `question(s) missed (mode: ${session?.mode_key ?? 'practice'}). Student's answer: ${struggle.selectedAnswer ?? 'unknown'}. ` +
        `Correct answer: ${struggle.correctAnswer}.` +
        (struggle.explanation ? ` Milo's explanation was already shown to the student: ${struggle.explanation}` : '');

      const { error: insertError } = await supabase.from('questions').insert({
        user_id: user.id,
        title: `Stuck on ${struggle.topicLabel}`,
        content: choiceLines ? `${struggle.questionText}\n\n${choiceLines}` : struggle.questionText,
        question_type: 'text',
        subject_id: subjectSlugToId[struggle.subject] ?? null,
        student_notes: `I've missed ${struggle.missCount} "${struggle.topicLabel}" questions in a row during practice and could use a real explanation.`,
        human_requested: true,
        human_request_notes: contextNotes,
        status: 'human_requested',
      });
      if (insertError) throw insertError;

      setStruggle((prev) => (prev ? { ...prev, sent: true } : prev));
      toast.success("Sent to a tutor — you'll get notified when someone responds.");
    } catch (err: any) {
      toast.error(`Could not send this to a tutor: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsEscalating(false);
    }
  }, [struggle, user, isEscalating, session, subjectSlugToId]);

  const timeRemaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null;
  const timerWarning = timeRemaining !== null && timeRemaining < 120;

  const choices = useMemo((): Array<{ label: string; text: string }> => {
    if (!currentQuestion) return [];
    if (currentQuestion.question_format === 'numeric_entry') return [];
    const c = currentQuestion.choices;
    if (!c) return [];
    if (Array.isArray(c)) return c as Array<{ label: string; text: string }>;
    return [];
  }, [currentQuestion]);

  const answeredCount = useMemo(
    () => Object.values(questionStates).filter((s) => s.state === 'answered').length,
    [questionStates]
  );
  const correctCount = useMemo(
    () => Object.values(questionStates).filter((s) => s.isCorrect === true).length,
    [questionStates]
  );

  const handleSubmit = async () => {
    if (!currentQuestion || !currentQState?.selectedAnswer) return;
    await submitAnswer(currentQuestion.id);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      await goToQuestion(currentIndex + 1);
    } else if (!isInfinite) {
      await finishSession();
    }
  };

  const handlePrevious = async () => {
    if (currentIndex > 0 && (session?.allow_backtracking ?? true)) {
      await goToQuestion(currentIndex - 1);
    }
  };

  const handleExitAndSave = async () => {
    setIsExitDialogOpen(false);
    router.push('/study');
  };

  const handleExitAndFinish = async () => {
    setIsExitDialogOpen(false);
    await finishSession();
  };

  // ---- Results screen ----
  if (isFinished || isReviewMode) {
    const allAnswered = Object.values(questionStates).filter((s) => s.state === 'answered');
    const finalCorrect = session?.correct_answers ?? allAnswered.filter((s) => s.isCorrect).length;
    const finalTotal = session?.total_questions ?? allAnswered.length;
    const accuracy = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 0;
    const timeTaken = session?.time_taken_seconds ?? elapsed;

    // Weak topics from answered questions
    const bySkill: Record<string, { name: string; correct: number; total: number }> = {};
    questions.forEach((q) => {
      const qs = questionStates[q.id];
      if (!qs || qs.state !== 'answered') return;
      const key = q.skill_id ?? q.domain_id ?? q.section ?? 'unknown';
      const name = q.skills?.name ?? q.domains?.name ?? q.section ?? key;
      if (!bySkill[key]) bySkill[key] = { name, correct: 0, total: 0 };
      bySkill[key].total++;
      if (qs.isCorrect) bySkill[key].correct++;
    });
    const weakTopics = Object.values(bySkill)
      .map((t) => ({ ...t, pct: Math.round((t.correct / t.total) * 100) }))
      .filter((t) => t.pct < 70 && t.total >= 2)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5);

    const missedQuestions = questions.filter((q) => questionStates[q.id]?.isCorrect === false);

    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6 animate-in fade-in duration-300">
        {/* Score header */}
        <div className="text-center py-6">
          <div className={cn(
            'inline-flex items-center justify-center w-20 h-20 rounded-full mb-4',
            accuracy >= 80 ? 'bg-success/10'
              : accuracy >= 60 ? 'bg-info/10'
              : 'bg-warning/10'
          )}>
            <Trophy className={cn('h-10 w-10',
              accuracy >= 80 ? 'text-success'
                : accuracy >= 60 ? 'text-info'
                : 'text-warning'
            )} />
          </div>
          <h1 className="text-3xl font-bold">
            {accuracy >= 80 ? 'Excellent Work!' : accuracy >= 60 ? 'Good Progress!' : 'Keep Practicing!'}
          </h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {modeDef?.label ?? modeKey.replace(/_/g, ' ')} — Complete
          </p>
        </div>

        {/* Score metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{accuracy}%</div>
            <p className="text-xs text-muted-foreground mt-1">Accuracy</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{finalCorrect}/{finalTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">Correct</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{formatTime(timeTaken ?? elapsed)}</div>
            <p className="text-xs text-muted-foreground mt-1">Time</p>
          </CardContent></Card>
        </div>

        {/* Weak topics */}
        {weakTopics.length > 0 && (
          <Card className="border-warning/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-warning" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weakTopics.map((t) => (
                <div key={t.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{t.name}</span>
                    <span className="text-muted-foreground">{t.pct}% ({t.correct}/{t.total})</span>
                  </div>
                  <Progress value={t.pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Missed questions */}
        {missedQuestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Missed Questions ({missedQuestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {missedQuestions.map((q, i) => {
                  const qs = questionStates[q.id];
                  return (
                    <div key={q.id} className="flex items-start gap-3 p-2 rounded-lg bg-destructive/10 border border-destructive/10">
                      <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-destructive">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{q.question_text}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{q.section}</Badge>
                          {q.difficulty && <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>}
                          {qs?.selectedAnswer && (
                            <span className="text-xs text-muted-foreground">
                              You: {qs.selectedAnswer} · Correct: {q.correct_answer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => router.push('/study')} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Study
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link href="/progress">
              <TrendingUp className="mr-2 h-4 w-4" />View Progress
            </Link>
          </Button>
          <Button onClick={() => router.push('/study')} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />Practice Again
          </Button>
        </div>
      </div>
    );
  }

  // ---- Loading / Error ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Session not found</h2>
        <p className="text-muted-foreground text-sm">{error ?? 'This session does not exist or belongs to another account.'}</p>
        <Button asChild><Link href="/study">Back to Study</Link></Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">No questions available</h2>
        <p className="text-muted-foreground text-sm">No questions matched your filters. Try different settings.</p>
        <Button asChild><Link href="/study"><ArrowLeft className="mr-2 h-4 w-4" />Back to Study</Link></Button>
      </div>
    );
  }

  // ---- Active Session ----
  return (
    <div className="min-h-screen bg-background">
      {/* Top toolbar */}
      <div className="sticky top-0 z-50 bg-card border-b px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setIsExitDialogOpen(true)}>
              <ArrowLeft className="h-4 w-4 mr-1" />Exit
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="text-sm">
              <span className="font-medium">{modeDef?.label ?? modeKey.replace(/_/g, ' ')}</span>
              {isInfinite ? (
                <span className="text-muted-foreground ml-2">
                  <InfinityIcon className="h-3 w-3 inline mr-0.5" />Q{currentIndex + 1}
                </span>
              ) : (
                <span className="text-muted-foreground ml-2">{currentIndex + 1} of {questions.length}</span>
              )}
              {isInfinite && isGeneratingMore && (
                <span className="text-milo text-xs ml-2 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />generating more…
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isInfinite && (
              <Button variant="outline" size="sm" onClick={() => setIsQuestionNavOpen(!isQuestionNavOpen)}>
                <Grid3X3 className="h-4 w-4 mr-1" />Nav
              </Button>
            )}
            {(isTimed || isInfinite) && (
              <div className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-1.5',
                timerWarning ? 'bg-destructive/10 text-destructive' : 'bg-muted'
              )}>
                <Clock className="h-3 w-3" />
                {timeRemaining !== null ? formatTime(timeRemaining) : formatTime(elapsed)}
              </div>
            )}
            {isInfinite && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3 text-success" />
                {answeredCount}
              </Badge>
            )}
            {currentQuestion?.section === 'math' && currentQuestion.calculator_allowed && (
              <Button
                variant={showCalculator ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowCalculator(!showCalculator)}
                title="Calculator"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {!isInfinite && (
        <div className="px-4 py-1 bg-muted/20">
          <Progress value={questions.length > 0 ? (answeredCount / questions.length) * 100 : 0} className="h-1" />
        </div>
      )}

      {/* Adaptive indicator */}
      {modeKey === 'adaptive_practice' && (
        <div className="px-4 py-2 bg-milo/10 border-b border-milo/10">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-xs text-milo">
            <TrendingUp className="h-3.5 w-3.5" />
            Adaptive mode — difficulty adjusts based on your answers
            {currentQuestion?.difficulty && (
              <Badge variant="outline" className="text-[10px] capitalize h-4">{currentQuestion.difficulty}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Question nav panel */}
      {isQuestionNavOpen && !isInfinite && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsQuestionNavOpen(false)}>
          <div
            className="absolute right-0 top-[57px] bottom-0 w-72 bg-card border-l shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <h3 className="font-semibold mb-3">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const qs = questionStates[q.id];
                  const bubbleState =
                    qs?.state === 'answered' && qs.isCorrect === true ? 'correct'
                    : qs?.state === 'answered' && qs.isCorrect === false ? 'incorrect'
                    : qs?.state === 'answered' ? 'filled'
                    : i === currentIndex ? 'active'
                    : 'empty';
                  return (
                    <div key={q.id} className="relative flex justify-center">
                      <AnswerBubble
                        label={String(i + 1)}
                        size="md"
                        state={bubbleState}
                        onClick={() => { goToQuestion(i); setIsQuestionNavOpen(false); }}
                      />
                      {qs?.markedForReview && qs?.state !== 'answered' && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warning" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><AnswerBubble state="correct" size="sm" /><span>Correct</span></div>
                <div className="flex items-center gap-2"><AnswerBubble state="incorrect" size="sm" /><span>Incorrect</span></div>
                <div className="flex items-center gap-2 relative"><AnswerBubble state="empty" size="sm" /><span className="absolute left-1 top-0 h-1.5 w-1.5 rounded-full bg-warning" /><span>Flagged</span></div>
              </div>
              <Separator className="my-3" />
              <div className="text-xs">
                <span className="font-medium">{answeredCount}</span>
                <span className="text-muted-foreground"> of {questions.length} answered</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentQuestion && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize text-xs">{currentQuestion.section}</Badge>
                  {currentQuestion.domains?.name && (
                    <Badge variant="secondary" className="text-xs">{currentQuestion.domains.name}</Badge>
                  )}
                  {currentQuestion.skills?.code && (
                    <Badge variant="secondary" className="font-mono text-xs">{currentQuestion.skills.code}</Badge>
                  )}
                  {currentQuestion.difficulty && (
                    <Badge
                      variant={
                        currentQuestion.difficulty === 'easy' ? 'secondary'
                          : currentQuestion.difficulty === 'hard' ? 'destructive'
                          : 'default'
                      }
                      className="capitalize text-xs"
                    >{currentQuestion.difficulty}</Badge>
                  )}
                  {currentQuestion.is_procedural && (
                    <Badge variant="outline" className="text-xs border-milo/30 text-milo">
                      AI-generated
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleBookmark(currentQuestion.id)}
                  className={cn(
                    currentQState?.isBookmarked && 'text-info hover:text-info'
                  )}
                  title={currentQState?.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                >
                  {currentQState?.isBookmarked
                    ? <BookmarkCheck className="h-4 w-4 fill-current" />
                    : <Bookmark className="h-4 w-4" />
                  }
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">
                {currentQuestion.question_text}
              </p>

              {/* Answer choices — shown for multiple_choice, passage_based, graph_table, etc. */}
              {choices.length > 0 && (
                <div className="space-y-2">
                  {choices.map((choice) => {
                    const isSelected = currentQState?.selectedAnswer === choice.label;
                    const isAnswered = currentQState?.state === 'answered';
                    const isCorrectChoice = currentQuestion.correct_answer === choice.label;
                    const isEliminated = currentQState?.eliminatedChoices.includes(choice.label);

                    // CRITICAL: never highlight correct answer before answering (exam mode also)
                    const showCorrect = isAnswered && isCorrectChoice && !isExam;
                    const showWrong = isAnswered && isSelected && !isCorrectChoice;
                    const showExamReveal = isAnswered && isExam && isCorrectChoice;

                    return (
                      <div key={choice.label} className="relative">
                        <button
                          onClick={() => !isEliminated && !isAnswered && selectAnswer(currentQuestion.id, choice.label)}
                          disabled={isAnswered}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm flex items-center gap-3',
                            !isAnswered && !isEliminated && 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
                            !isAnswered && isEliminated && 'opacity-30 line-through cursor-not-allowed',
                            !isAnswered && isSelected && 'border-primary bg-primary/5',
                            showCorrect && 'border-success bg-success/10',
                            showWrong && 'border-destructive bg-destructive/10',
                            isAnswered && !showCorrect && !showWrong && 'opacity-50 border-border',
                          )}
                        >
                          <AnswerBubble
                            label={choice.label}
                            size="sm"
                            state={
                              showCorrect ? 'correct'
                              : showWrong ? 'incorrect'
                              : isSelected ? (isAnswered ? 'filled' : 'active')
                              : 'empty'
                            }
                          />
                          <span className="flex-1">{choice.text}</span>
                        </button>
                        {!isAnswered && (
                          <button
                            onClick={() => toggleEliminate(currentQuestion.id, choice.label)}
                            title="Eliminate"
                            className={cn(
                              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-muted-foreground hover:text-foreground',
                              isEliminated && 'text-destructive hover:text-destructive/80'
                            )}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grid-in / Numeric entry */}
              {currentQuestion.question_format === 'numeric_entry' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={currentQState?.selectedAnswer ?? ''}
                    onChange={(e) => !currentQState || currentQState.state !== 'answered'
                      ? selectAnswer(currentQuestion.id, e.target.value)
                      : undefined
                    }
                    disabled={currentQState?.state === 'answered'}
                    placeholder="Enter your answer..."
                    className={cn(
                      'w-full max-w-xs px-4 py-3 rounded-lg border-2 text-lg font-mono bg-background outline-none transition-colors',
                      currentQState?.state === 'answered' && currentQState.isCorrect === true && 'border-success bg-success/10',
                      currentQState?.state === 'answered' && currentQState.isCorrect === false && 'border-destructive bg-destructive/10',
                      currentQState?.state !== 'answered' && 'border-input focus:border-primary'
                    )}
                  />
                  {currentQState?.state === 'answered' && (
                    <p className={cn('text-sm', currentQState.isCorrect ? 'text-success' : 'text-destructive')}>
                      Correct answer: {currentQuestion.correct_answer}
                    </p>
                  )}
                </div>
              )}

              {/* Hint (before answering, non-exam) */}
              {currentQState?.state !== 'answered' && !isExam && currentQuestion.hint && (
                <div className="mt-4">
                  {showHint ? (
                    <div className="p-3 bg-warning/10 rounded-lg border border-warning/25">
                      <p className="text-sm"><strong>Hint:</strong> {currentQuestion.hint}</p>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowHint(true); revealExplanation(currentQuestion.id); }}
                      className="text-warning hover:text-warning"
                    >
                      <Lightbulb className="h-4 w-4 mr-1.5" />Show Hint
                    </Button>
                  )}
                </div>
              )}

              {/* Explanation — shown after answering (not in exam until finished) */}
              {currentQState?.state === 'answered' && !isExam && currentQuestion.explanation && (
                <div className={cn(
                  'mt-4 p-4 rounded-lg border',
                  currentQState.isCorrect
                    ? 'bg-success/10 border-success/25'
                    : 'bg-destructive/10 border-destructive/25'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {currentQState.isCorrect ? (
                      <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-sm font-semibold text-success">Correct!</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm font-semibold text-destructive">Incorrect — Answer: {currentQuestion.correct_answer}</span></>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(session?.allow_backtracking ?? true) && currentIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrevious}>
                <ArrowLeft className="h-4 w-4 mr-1" />Prev
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleMarkForReview(currentQuestion?.id ?? '')}
              disabled={!currentQuestion}
              className={cn(currentQState?.markedForReview && 'text-warning border-warning/25')}
            >
              <Flag className="h-4 w-4 mr-1" />
              {currentQState?.markedForReview ? 'Unflag' : 'Flag'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentQState?.state !== 'answered' ? (
              <Button
                onClick={handleSubmit}
                disabled={!currentQState?.selectedAnswer}
              >
                Submit Answer
              </Button>
            ) : currentIndex === questions.length - 1 && !isInfinite ? (
              <Button onClick={finishSession} disabled={isFinishing}>
                {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                Finish Session
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Calculator */}
      {showCalculator && (
        <Card className="fixed bottom-4 right-4 w-72 z-50 shadow-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Calculator</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCalculator(false)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent><CalculatorWidget /></CardContent>
        </Card>
      )}

      {/* Exit dialog */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Session?</DialogTitle>
            <DialogDescription>
              {isInfinite
                ? `You've answered ${answeredCount} question${answeredCount !== 1 ? 's' : ''} so far.`
                : `${answeredCount} of ${questions.length} questions answered. Progress is saved automatically.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsExitDialogOpen(false)}>Keep Practicing</Button>
            <Button variant="outline" onClick={handleExitAndSave}>Save & Exit</Button>
            {answeredCount > 0 && (
              <Button onClick={handleExitAndFinish} disabled={isFinishing}>
                {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Finish & See Results
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Struggle prompt — floating, dismissible, independent of which question
          is currently on screen. Pattern ported from the Base44 reference's
          StrugglePrompt.jsx; escalation payload adapted to Cognify's actual
          questions-table schema instead of Base44's separate entity model. */}
      {struggle && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-card border border-warning/30 rounded-2xl shadow-xl p-5 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <p className="font-semibold text-sm">Milo noticed you're stuck</p>
            </div>
            <button
              onClick={() => setStruggle(null)}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            You've missed {struggle.missCount} <strong className="text-foreground">{struggle.topicLabel}</strong> questions
            in a row. Want Milo to send this to a human tutor for a real explanation?
          </p>

          {struggle.sent ? (
            <p className="text-sm text-success font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Sent — check My Requests for the response.
            </p>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-2" onClick={handleEscalate} disabled={isEscalating}>
                {isEscalating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send to a tutor
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStruggle(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <PracticeSessionInner />
    </Suspense>
  );
}

// ---- Calculator widget ----
function CalculatorWidget() {
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (d: string) => {
    if (waitingForOperand) { setDisplay(d); setWaitingForOperand(false); }
    else setDisplay((prev) => prev === '0' ? d : prev + d);
  };
  const inputDecimal = () => {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); }
    else setDisplay((prev) => prev.includes('.') ? prev : prev + '.');
  };
  const clear = () => { setDisplay('0'); setMemory(null); setOperator(null); setWaitingForOperand(false); };
  const performOp = (next: string) => {
    const val = parseFloat(display);
    if (memory !== null && operator) {
      let result = memory;
      if (operator === '+') result = memory + val;
      if (operator === '-') result = memory - val;
      if (operator === '*') result = memory * val;
      if (operator === '/') result = val !== 0 ? memory / val : 0;
      setDisplay(String(result));
      setMemory(result);
    } else {
      setMemory(val);
    }
    setWaitingForOperand(true);
    setOperator(next);
  };
  const calculate = () => {
    if (!operator || memory === null) return;
    performOp(operator);
    setOperator(null);
  };
  const btn = (label: string, onClick: () => void, className = '') => (
    <button key={label} onClick={onClick} className={cn('h-9 rounded-lg text-sm font-medium transition-colors', className)}>
      {label}
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="h-10 bg-muted rounded-lg flex items-center justify-end px-3 font-mono text-base overflow-hidden">{display}</div>
      <div className="grid grid-cols-4 gap-1">
        {btn('C', clear, 'bg-destructive/10 text-destructive hover:bg-destructive/25 col-span-2')}
        {btn('/', () => performOp('/'), 'bg-primary/10 hover:bg-primary/20')}
        {btn('*', () => performOp('*'), 'bg-primary/10 hover:bg-primary/20')}
        {['7','8','9'].map((d) => btn(d, () => inputDigit(d), 'bg-muted hover:bg-muted/60'))}
        {btn('-', () => performOp('-'), 'bg-primary/10 hover:bg-primary/20')}
        {['4','5','6'].map((d) => btn(d, () => inputDigit(d), 'bg-muted hover:bg-muted/60'))}
        {btn('+', () => performOp('+'), 'bg-primary/10 hover:bg-primary/20')}
        {['1','2','3'].map((d) => btn(d, () => inputDigit(d), 'bg-muted hover:bg-muted/60'))}
        {btn('=', calculate, 'bg-primary text-primary-foreground hover:bg-primary/90 row-span-2')}
        {btn('0', () => inputDigit('0'), 'bg-muted hover:bg-muted/60 col-span-2')}
        {btn('.', inputDecimal, 'bg-muted hover:bg-muted/60')}
      </div>
    </div>
  );
}
