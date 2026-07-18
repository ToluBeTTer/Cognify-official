'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnswerBubble } from '@/components/ui/answer-bubble';
import { Flame, Loader2, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import confetti from 'canvas-confetti';

interface ChallengeQuestion {
  id: string;
  question_text: string;
  choices: Array<{ label: string; text: string }>;
  correct_answer?: string;
  difficulty: string;
  section: string;
  domains?: { name: string } | null;
}

interface ChallengeState {
  streak: number;
  difficulty: 'easy' | 'medium' | 'hard';
  domainMisses: Record<string, number>;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ChallengeModePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<ChallengeQuestion | null>(null);
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [nextQuestion, setNextQuestion] = useState<ChallengeQuestion | null>(null);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/practice/challenge/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ section }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || 'Could not start Challenge Mode');
        router.push('/study');
        return;
      }
      setSessionId(json.session_id);
      setQuestion(json.question);
      setChallengeState(json.state);
    } catch (err) {
      console.error(err);
      toast.error('Could not start Challenge Mode');
      router.push('/study');
    } finally {
      setIsLoading(false);
    }
  }, [section, router]);

  useEffect(() => {
    if (user) startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async () => {
    if (!selected || !question || !sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/practice/challenge/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, selected_answer: selected }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || 'Something went wrong');
        return;
      }

      setAnswered(true);
      setWasCorrect(json.is_correct);
      setCorrectAnswer(json.correct_answer);
      setExplanation(json.explanation);
      setTotalAnswered((n) => n + 1);
      if (json.is_correct) setTotalCorrect((n) => n + 1);

      const prevDifficulty = challengeState?.difficulty;
      if (prevDifficulty && json.state.difficulty !== prevDifficulty) {
        const tiers = ['easy', 'medium', 'hard'];
        const wentUp = tiers.indexOf(json.state.difficulty) > tiers.indexOf(prevDifficulty);
        setDifficultyChanged(wentUp ? 'up' : 'down');
        if (wentUp) {
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#2F6FE4', '#8355D8', '#1FA693'],
          });
        }
      } else {
        setDifficultyChanged(null);
      }
      setChallengeState(json.state);
      setNextQuestion(json.next_question || null);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong submitting your answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!nextQuestion) {
      toast.error('No more questions available right now — try again shortly.');
      return;
    }
    setQuestion(nextQuestion);
    setNextQuestion(null);
    setSelected(null);
    setAnswered(false);
    setCorrectAnswer(null);
    setExplanation(null);
    setWasCorrect(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!question) return null;

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/study"><ArrowLeft className="h-4 w-4 mr-1" />Exit Challenge</Link>
        </Button>
        <div className="flex items-center gap-2">
          {challengeState && challengeState.streak !== 0 && (
            <Badge className="bg-gradient-to-r from-warning to-warning/80 text-warning-foreground border-0 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" />
              {Math.abs(challengeState.streak)} streak
            </Badge>
          )}
          <Badge variant="outline" className="capitalize">{challengeState?.difficulty}</Badge>
        </div>
      </div>

      {difficultyChanged && (
        <div
          className={cn(
            'text-sm rounded-lg px-3 py-2 flex items-center gap-2 border',
            difficultyChanged === 'up'
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-muted border-border text-muted-foreground'
          )}
        >
          {difficultyChanged === 'up' ? (
            <><TrendingUp className="h-4 w-4" />Nice streak — stepping up to {challengeState?.difficulty} questions.</>
          ) : (
            <><TrendingDown className="h-4 w-4" />Difficulty easing to {challengeState?.difficulty} — let's build back up.</>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize text-xs">{question.section}</Badge>
            {question.domains?.name && <Badge variant="secondary" className="text-xs">{question.domains.name}</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">{totalAnswered} answered · {accuracy}% accuracy</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base leading-relaxed whitespace-pre-wrap">{question.question_text}</p>

          <div className="space-y-2">
            {question.choices.map((choice) => {
              const isSelected = selected === choice.label;
              const showCorrect = answered && correctAnswer === choice.label;
              const showWrong = answered && isSelected && !showCorrect;
              return (
                <button
                  key={choice.label}
                  onClick={() => !answered && setSelected(choice.label)}
                  disabled={answered}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm flex items-center gap-3',
                    !answered && isSelected && 'border-primary bg-primary/5',
                    !answered && !isSelected && 'hover:border-primary/40',
                    showCorrect && 'border-success bg-success/10',
                    showWrong && 'border-destructive bg-destructive/10',
                    answered && !showCorrect && !showWrong && 'opacity-50'
                  )}
                >
                  <AnswerBubble
                    label={choice.label}
                    size="sm"
                    state={showCorrect ? 'correct' : showWrong ? 'incorrect' : isSelected ? 'active' : 'empty'}
                  />
                  <span className="flex-1">{choice.text}</span>
                </button>
              );
            })}
          </div>

          {answered && explanation && (
            <div className={cn('rounded-lg p-4 text-sm', wasCorrect ? 'bg-success/10' : 'bg-muted')}>
              <p className="font-medium mb-1">{wasCorrect ? 'Correct!' : 'Not quite'}</p>
              <p className="text-muted-foreground leading-relaxed">{explanation}</p>
            </div>
          )}

          <div className="flex justify-end">
            {!answered ? (
              <Button onClick={handleSubmit} disabled={!selected || isSubmitting} className="bg-gradient-primary hover:opacity-90">
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit
              </Button>
            ) : (
              <Button onClick={handleNext} className="bg-gradient-primary hover:opacity-90">
                Next Question
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
