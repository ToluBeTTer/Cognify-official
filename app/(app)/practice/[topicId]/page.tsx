'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Target,
  Lightbulb,
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
  answers: Record<string, { selected: string; correct: boolean }>;
}

const TOPIC_LABELS: Record<string, string> = {
  'linear-equations': 'Linear Equations',
  'quadratics': 'Quadratic Equations',
  'ratios': 'Ratios & Proportions',
  'triangles': 'Triangles & Geometry',
  'main-idea': 'Main Idea & Purpose',
  'vocabulary': 'Vocabulary in Context',
  'subject-verb-agreement': 'Subject-Verb Agreement',
  'transitions': 'Transitions & Rhetoric',
};

export default function TopicPracticePage() {
  const { topicId } = useParams() as { topicId: string };
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

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topicLabel = TOPIC_LABELS[topicId] || topicId;

  useEffect(() => {
    const loadQuestions = async () => {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('topic_id', topicId)
        .order('display_order');

      if (error) {
        toast.error(`Failed to load questions: ${error.message || 'Unknown error'}`);
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

    loadQuestions();
  }, [topicId]);

  // Start session record once questions load
  useEffect(() => {
    if (!user || questions.length === 0 || sessionId) return;

    const createSession = async () => {
      const { data } = await supabase
        .from('practice_sessions')
        .insert({
          session_type: 'topic_practice',
          topic_id: topicId,
          total_questions: questions.length,
        })
        .select('id')
        .maybeSingle();

      if (data) setSessionId(data.id);
    };

    createSession();
  }, [user, questions, sessionId, topicId]);

  // Timer
  useEffect(() => {
    if (isLoading || sessionResult) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoading, sessionResult]);

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

      // Record attempt
      if (user) {
        await supabase.from('practice_attempts').insert({
          question_id: currentQuestion.id,
          session_id: sessionId,
          topic_id: currentQuestion.topic_id,
          subject: currentQuestion.subject,
          domain: currentQuestion.domain,
          selected_answer: choiceId,
          is_correct: isCorrect,
        });
      }
    },
    [showResult, currentQuestion, user, sessionId]
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      finishSession();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowExplanation(false);
    }
  }, [isLast]);

  const finishSession = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const allAnswers = {
      ...answers,
      ...(selectedAnswer && currentQuestion
        ? { [currentQuestion.id]: { selected: selectedAnswer, correct: selectedAnswer === currentQuestion.correct_answer } }
        : {}),
    };

    const correct = Object.values(allAnswers).filter((a) => a.correct).length;
    const result: SessionResult = {
      total: questions.length,
      correct,
      timeSeconds: elapsed,
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
  }, [answers, selectedAnswer, currentQuestion, questions.length, elapsed, sessionId]);

  const restart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setShowExplanation(false);
    setAnswers({});
    setSessionResult(null);
    setElapsed(0);
    setSessionId(null);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">No questions yet</h2>
        <p className="text-muted-foreground mb-6">
          Practice questions for <strong>{topicLabel}</strong> are coming soon.
        </p>
        <Button asChild variant="outline">
          <Link href="/question-bank">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Question Bank
          </Link>
        </Button>
      </div>
    );
  }

  // Results screen
  if (sessionResult) {
    const pct = Math.round((sessionResult.correct / sessionResult.total) * 100);
    const grade = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 60 ? 'Fair' : 'Keep Practicing';
    const gradeColor = pct >= 90 ? 'text-success' : pct >= 75 ? 'text-info' : pct >= 60 ? 'text-warning' : 'text-destructive';

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center py-8">
          <Trophy className={cn('h-16 w-16 mx-auto mb-4', gradeColor)} />
          <h1 className="text-3xl font-bold">{grade}!</h1>
          <p className="text-muted-foreground mt-2">{topicLabel} — Practice Complete</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className={cn('text-4xl font-bold', gradeColor)}>{pct}%</div>
                <p className="text-sm text-muted-foreground mt-1">Score</p>
              </div>
              <div>
                <div className="text-4xl font-bold">{sessionResult.correct}/{sessionResult.total}</div>
                <p className="text-sm text-muted-foreground mt-1">Correct</p>
              </div>
              <div>
                <div className="text-4xl font-bold">{formatTime(sessionResult.timeSeconds)}</div>
                <p className="text-sm text-muted-foreground mt-1">Time</p>
              </div>
            </div>
            <Progress value={pct} className="mt-6 h-3" />
          </CardContent>
        </Card>

        {/* Per-question review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, i) => {
              const ans = sessionResult.answers[q.id];
              return (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-3">
                    {ans?.correct ? (
                      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Q{i + 1}. {q.question_text.slice(0, 120)}{q.question_text.length > 120 ? '…' : ''}</p>
                      {!ans?.correct && (
                        <div className="mt-1 text-xs space-y-1">
                          <p className="text-destructive">Your answer: {ans?.selected ?? 'Not answered'}</p>
                          <p className="text-success">Correct: {q.correct_answer}</p>
                          <p className="text-muted-foreground">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {i < questions.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={restart} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Button asChild className="flex-1">
            <Link href="/question-bank">
              <ArrowRight className="mr-2 h-4 w-4" />
              More Topics
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Quiz screen
  const progress = ((currentIndex) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/question-bank">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{topicLabel}</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Question card */}
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base font-normal leading-relaxed whitespace-pre-wrap">
              {currentQuestion.question_text}
            </CardTitle>
            <Badge
              variant={
                currentQuestion.difficulty === 'easy'
                  ? 'secondary'
                  : currentQuestion.difficulty === 'hard'
                  ? 'destructive'
                  : 'default'
              }
              className="flex-shrink-0 capitalize"
            >
              {currentQuestion.difficulty}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {currentQuestion.choices.map((choice) => {
            const isSelected = selectedAnswer === choice.id;
            const isCorrect = choice.id === currentQuestion.correct_answer;

            let variant = 'default';
            if (showResult) {
              if (isCorrect) variant = 'correct';
              else if (isSelected && !isCorrect) variant = 'wrong';
            }

            return (
              <button
                key={choice.id}
                onClick={() => handleAnswer(choice.id)}
                disabled={showResult}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm',
                  !showResult && 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
                  !showResult && 'border-border',
                  showResult && isCorrect && 'border-success bg-success/10 text-success',
                  showResult && isSelected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                  showResult && !isSelected && !isCorrect && 'border-border opacity-60',
                  isSelected && !showResult && 'border-primary bg-primary/5'
                )}
              >
                <span className="font-semibold mr-3">{choice.id}.</span>
                {choice.text}
                {showResult && isCorrect && (
                  <CheckCircle2 className="inline h-4 w-4 ml-2 text-success" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle className="inline h-4 w-4 ml-2 text-destructive" />
                )}
              </button>
            );
          })}

          {/* Explanation */}
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

      {/* Navigation */}
      {showResult && (
        <div className="flex justify-end animate-fade-up">
          <Button onClick={handleNext} size="lg">
            {isLast ? (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                See Results
              </>
            ) : (
              <>
                Next Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
