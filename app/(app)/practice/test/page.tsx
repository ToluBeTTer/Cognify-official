'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  Trophy,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PracticeQuestion {
  id: string;
  question_text: string;
  question_type: string;
  choices: Array<{ id: string; text: string }>;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  topic_id: string;
  subject: string;
  domain: string;
}

interface SessionResult {
  total: number;
  correct: number;
  timeSeconds: number;
  bySubject: Record<string, { total: number; correct: number }>;
  answers: Record<string, { selected: string; correct: boolean }>;
}

const MOCK_TEST_LIMIT = 98; // Simulate full SAT (44 math + 54 EBRW)

export default function MockTestPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { selected: string; correct: boolean }>>({});
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const TIME_LIMIT = 35 * 60; // 35 minute practice test
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .order('subject')
        .limit(MOCK_TEST_LIMIT);

      if (error) {
        toast.error(`Failed to load test questions: ${error.message || 'Unknown error'}`);
        return;
      }

      setQuestions(
        (data || []).map((q) => ({
          ...q,
          choices: Array.isArray(q.choices) ? q.choices as Array<{ id: string; text: string }> : [],
        }))
      );
      setIsLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (!started || sessionResult) return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= TIME_LIMIT) {
          clearInterval(timerRef.current!);
          finishSession();
          return e + 1;
        }
        return e + 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, sessionResult]);

  const handleStart = async () => {
    setStarted(true);
    if (user) {
      const { data } = await supabase
        .from('practice_sessions')
        .insert({
          session_type: 'mock_test',
          total_questions: questions.length,
          time_limit_seconds: TIME_LIMIT,
        })
        .select('id')
        .maybeSingle();
      if (data) setSessionId(data.id);
    }
  };

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleAnswer = useCallback(
    async (choiceId: string) => {
      if (showResult || !currentQuestion) return;
      setSelectedAnswer(choiceId);
      setShowResult(true);

      const isCorrect = choiceId === currentQuestion.correct_answer;
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { selected: choiceId, correct: isCorrect },
      }));

      if (user) {
        await supabase.from('practice_attempts').insert({
          question_id: currentQuestion.id,
          session_id: sessionId,
          topic_id: currentQuestion.topic_id,
          subject: currentQuestion.subject,
          domain: currentQuestion.domain,
          selected_answer: choiceId,
          is_correct: isCorrect,
          time_spent_seconds: Math.round(elapsed / (currentIndex + 1)),
        });
      }
    },
    [showResult, currentQuestion, user, sessionId, elapsed, currentIndex]
  );

  const finishSession = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const allAnswers = answers;
    const correct = Object.values(allAnswers).filter((a) => a.correct).length;

    const bySubject: Record<string, { total: number; correct: number }> = {};
    questions.forEach((q) => {
      if (!bySubject[q.subject]) bySubject[q.subject] = { total: 0, correct: 0 };
      bySubject[q.subject].total++;
      if (allAnswers[q.id]?.correct) bySubject[q.subject].correct++;
    });

    const result: SessionResult = {
      total: questions.length,
      correct,
      timeSeconds: elapsed,
      bySubject,
      answers: allAnswers,
    };
    setSessionResult(result);

    if (sessionId) {
      await supabase
        .from('practice_sessions')
        .update({
          correct_answers: correct,
          score_percentage: Math.round((correct / questions.length) * 100),
          time_taken_seconds: elapsed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
  }, [answers, questions, elapsed, sessionId]);

  const handleNext = useCallback(() => {
    if (isLast) {
      finishSession();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowExplanation(false);
    }
  }, [isLast, finishSession]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const timeRemaining = TIME_LIMIT - elapsed;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Results screen
  if (sessionResult) {
    const pct = Math.round((sessionResult.correct / sessionResult.total) * 100);
    const estimatedScore = Math.round(400 + (pct / 100) * 800);
    const grade = pct >= 85 ? 'Outstanding' : pct >= 70 ? 'Strong' : pct >= 55 ? 'Developing' : 'Needs Work';

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center py-6">
          <Trophy className={cn('h-16 w-16 mx-auto mb-4',
            pct >= 85 ? 'text-warning' : pct >= 70 ? 'text-info' : 'text-muted-foreground'
          )} />
          <h1 className="text-3xl font-bold">{grade}</h1>
          <p className="text-muted-foreground mt-1">Practice SAT Complete</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary">{estimatedScore}</div>
              <p className="text-sm text-muted-foreground mt-1">Estimated Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold">{pct}%</div>
              <p className="text-sm text-muted-foreground mt-1">{sessionResult.correct}/{sessionResult.total} correct</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by Subject</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(sessionResult.bySubject).map(([subject, data]) => {
              const subPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{subject}</span>
                    <span className="text-sm text-muted-foreground">{data.correct}/{data.total} ({subPct}%)</span>
                  </div>
                  <Progress value={subPct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setSessionResult(null); setCurrentIndex(0); setAnswers({}); setElapsed(0); setStarted(false); setSessionId(null); setSelectedAnswer(null); setShowResult(false); }}
            className="flex-1"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake Test
          </Button>
          <Button asChild className="flex-1">
            <Link href="/progress">
              <ArrowRight className="mr-2 h-4 w-4" />
              View Progress
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Intro screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/question-bank"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Practice SAT Test</h1>
            <p className="text-muted-foreground">Full-length practice session</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{questions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Questions</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">35m</div>
                <p className="text-xs text-muted-foreground mt-1">Time Limit</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">Mixed</div>
                <p className="text-xs text-muted-foreground mt-1">All Subjects</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>Covers Math, Reading, and Writing sections</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>Detailed explanations after each question</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>Estimated SAT score with subject breakdown</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span>The timer will automatically end the test at 35 minutes</span>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleStart}>
              Start Practice Test
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active quiz
  const progress = ((currentIndex) / questions.length) * 100;
  const timerPct = (timeRemaining / TIME_LIMIT) * 100;
  const timerWarning = timeRemaining < 5 * 60;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Practice SAT</h1>
          <p className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length} ·{' '}
            <span className="capitalize">{currentQuestion?.subject}</span>
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg border',
          timerWarning ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border'
        )}>
          <Clock className="h-4 w-4" />
          {formatTime(timeRemaining)}
        </div>
      </div>

      <div className="space-y-1">
        <Progress value={progress} className="h-1.5" />
        <div className={cn('h-1 rounded-full transition-all', timerWarning ? 'bg-destructive' : 'bg-success')}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Question */}
      {currentQuestion && (
        <Card className="animate-fade-up">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-base font-normal leading-relaxed whitespace-pre-wrap">
                {currentQuestion.question_text}
              </CardTitle>
              <Badge variant="outline" className="flex-shrink-0 capitalize">
                {currentQuestion.subject}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedAnswer === choice.id;
              const isCorrect = choice.id === currentQuestion.correct_answer;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleAnswer(choice.id)}
                  disabled={showResult}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm',
                    !showResult && 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer border-border',
                    isSelected && !showResult && 'border-primary bg-primary/5',
                    showResult && isCorrect && 'border-success bg-success/10 text-success',
                    showResult && isSelected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                    showResult && !isSelected && !isCorrect && 'border-border opacity-60'
                  )}
                >
                  <span className="font-semibold mr-3">{choice.id}.</span>
                  {choice.text}
                  {showResult && isCorrect && <CheckCircle2 className="inline h-4 w-4 ml-2 text-success" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="inline h-4 w-4 ml-2 text-destructive" />}
                </button>
              );
            })}

            {showResult && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-primary"
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  {showExplanation ? 'Hide' : 'Show'} Explanation
                </Button>
                {showExplanation && (
                  <div className="mt-3 p-4 bg-muted/60 rounded-lg border animate-fade-up">
                    <p className="text-sm font-medium mb-1">Explanation</p>
                    <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showResult && (
        <div className="flex justify-end animate-fade-up">
          <Button onClick={handleNext} size="lg">
            {isLast ? (
              <><Trophy className="mr-2 h-4 w-4" />Finish Test</>
            ) : (
              <>Next<ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
