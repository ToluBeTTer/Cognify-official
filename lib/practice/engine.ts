'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  ModeKey,
  SessionConfig,
  QuestionAnswerState,
  PracticeSessionRow,
} from './types';

export interface BankQuestion {
  id: string;
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
  domains?: { name: string } | null;
  skills?: { name: string; code: string } | null;
  /** True for procedurally-generated questions served in Infinite Practice —
   *  lets the UI show an honest "AI-generated" badge rather than presenting
   *  it identically to curated bank content. */
  is_procedural?: boolean;
}

/** Converts a procedural_questions row into the same shape the rest of the
 *  engine already works with, so appending generated questions doesn't
 *  require any special-casing elsewhere in the hook. */
function proceduralToBankQuestion(pq: {
  id: string;
  question_text: string;
  passage: string | null;
  choices: any;
  correct_answer: string;
  explanation: string;
  hint: string | null;
  topic: string;
  section: string;
  difficulty: string;
}): BankQuestion {
  const letterMap: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
  const choicesArray = ['a', 'b', 'c', 'd'].map((k) => ({
    label: letterMap[k],
    text: pq.choices?.[k] ?? '',
  }));

  return {
    id: pq.id,
    question_text: pq.passage ? `${pq.passage}\n\n${pq.question_text}` : pq.question_text,
    question_format: pq.passage ? 'passage_based' : 'multiple_choice',
    choices: choicesArray,
    correct_answer: letterMap[pq.correct_answer] ?? pq.correct_answer.toUpperCase(),
    explanation: pq.explanation,
    hint: pq.hint,
    section: pq.section,
    difficulty: pq.difficulty,
    calculator_allowed: true,
    domain_id: null,
    skill_id: null,
    domains: { name: pq.topic },
    is_procedural: true,
  };
}

export interface SessionEngineState {
  session: PracticeSessionRow | null;
  questions: BankQuestion[];
  questionStates: Record<string, QuestionAnswerState>;
  currentIndex: number;
  elapsed: number;
  isLoading: boolean;
  isFinishing: boolean;
  isFinished: boolean;
  error: string | null;
  isGeneratingMore: boolean;
}

export function useSessionEngine(sessionId: string | null, userId: string | null) {
  const [state, setState] = useState<SessionEngineState>({
    session: null,
    questions: [],
    questionStates: {},
    currentIndex: 0,
    elapsed: 0,
    isLoading: true,
    isFinishing: false,
    isFinished: false,
    error: null,
    isGeneratingMore: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
  }, []);

  // Load session + questions + saved question states
  useEffect(() => {
    if (!sessionId || !userId) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    const load = async () => {
      try {
        // 1. Load session
        const { data: session, error: sErr } = await supabase
          .from('practice_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (sErr) throw sErr;
        if (!session) throw new Error('Session not found');

        // 2. Load saved question states
        const { data: savedStates, error: stErr } = await supabase
          .from('session_question_states')
          .select('*')
          .eq('session_id', sessionId)
          .order('question_index');

        if (stErr) throw stErr;

        const questionIds: string[] = session.generated_question_ids as string[];

        if (!questionIds || questionIds.length === 0) {
          setState((s) => ({
            ...s,
            session: session as PracticeSessionRow,
            questions: [],
            questionStates: {},
            currentIndex: session.last_question_index ?? 0,
            isLoading: false,
          }));
          return;
        }

        // 3. Load question bank rows in the locked-in order
        const { data: bankRows, error: bErr } = await supabase
          .from('question_bank')
          .select('*, domains(name), skills(name, code)')
          .in('id', questionIds);

        if (bErr) throw bErr;

        // Re-sort to match the saved order
        const idToQuestion = new Map((bankRows ?? []).map((q: any) => [q.id, q]));
        const orderedQuestions = questionIds
          .map((id) => idToQuestion.get(id))
          .filter(Boolean) as BankQuestion[];

        // 4. Build per-question state — always start from DB, never from blank
        const stateMap: Record<string, QuestionAnswerState> = {};
        for (let i = 0; i < orderedQuestions.length; i++) {
          const q = orderedQuestions[i];
          const saved = (savedStates ?? []).find((s: any) => s.question_id === q.id);
          stateMap[q.id] = saved
            ? {
                questionId: q.id,
                questionIndex: saved.question_index,
                state: saved.state,
                selectedAnswer: saved.selected_answer,
                isCorrect: saved.is_correct,
                isBookmarked: saved.is_bookmarked,
                markedForReview: saved.marked_for_review,
                eliminatedChoices: saved.eliminated_choices ?? [],
                timeSpentSeconds: saved.time_spent_seconds ?? 0,
                attemptCount: saved.attempt_count ?? 0,
                explanationRevealed: saved.explanation_revealed ?? false,
                answeredAt: saved.answered_at,
              }
            : {
                questionId: q.id,
                questionIndex: i,
                state: 'active',
                selectedAnswer: null,
                isCorrect: null,
                isBookmarked: false,
                markedForReview: false,
                eliminatedChoices: [],
                timeSpentSeconds: 0,
                attemptCount: 0,
                explanationRevealed: false,
                answeredAt: null,
              };
        }

        // Insert missing states for questions that have no DB record yet
        const missingInserts = orderedQuestions
          .filter((q) => !(savedStates ?? []).find((s: any) => s.question_id === q.id))
          .map((q, relIdx) => ({
            session_id: sessionId,
            question_id: q.id,
            question_index: questionIds.indexOf(q.id),
            state: 'active',
          }));

        if (missingInserts.length > 0) {
          await supabase.from('session_question_states').upsert(missingInserts, {
            onConflict: 'session_id,question_id',
          });
        }

        setState((s) => ({
          ...s,
          session: session as PracticeSessionRow,
          questions: orderedQuestions,
          questionStates: stateMap,
          currentIndex: session.last_question_index ?? 0,
          isLoading: false,
          isFinished: session.status === 'completed',
        }));
      } catch (e: any) {
        setState((s) => ({ ...s, isLoading: false, error: e.message ?? 'Failed to load session' }));
      }
    };

    load();
  }, [sessionId, userId]);

  // Elapsed timer
  useEffect(() => {
    if (state.isLoading || state.isFinished) return;
    timerRef.current = setInterval(() => {
      setState((s) => ({ ...s, elapsed: s.elapsed + 1 }));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.isLoading, state.isFinished]);

  // Per-question time tracker
  useEffect(() => {
    if (state.isLoading || state.isFinished || state.questions.length === 0) return;
    const currentQ = state.questions[state.currentIndex];
    if (!currentQ) return;
    const qs = state.questionStates[currentQ.id];
    if (!qs || qs.state === 'answered') return;

    questionTimerRef.current = setInterval(() => {
      setState((s) => {
        const cur = s.questionStates[currentQ.id];
        if (!cur) return s;
        return {
          ...s,
          questionStates: {
            ...s.questionStates,
            [currentQ.id]: { ...cur, timeSpentSeconds: cur.timeSpentSeconds + 1 },
          },
        };
      });
    }, 1000);
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [state.currentIndex, state.isLoading, state.isFinished]);

  // --- Infinite Practice: keep a buffer of questions ready ahead of the
  // student, generating more (validated, via the server route) when running
  // low, and falling back to the curated bank silently if generation fails.
  const isGeneratingMoreRef = useRef(false);

  const loadMoreQuestions = useCallback(async () => {
    if (!sessionId || isGeneratingMoreRef.current) return;
    isGeneratingMoreRef.current = true;
    setState((s) => ({ ...s, isGeneratingMore: true }));

    try {
      const subjects: Array<'math' | 'reading' | 'writing'> = ['math', 'reading', 'writing'];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/practice/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ subject, difficulty: 'medium', count: 3 }),
      });

      const json = await res.json().catch(() => null);
      const newQuestions: BankQuestion[] = (json?.questions || []).map(proceduralToBankQuestion);

      if (newQuestions.length > 0) {
        setState((s) => {
          const existingIds = new Set(s.questions.map((q) => q.id));
          const toAdd = newQuestions.filter((q) => !existingIds.has(q.id));
          if (toAdd.length === 0) return s;

          const startIndex = s.questions.length;
          const newStateEntries: Record<string, QuestionAnswerState> = {};
          toAdd.forEach((q, i) => {
            newStateEntries[q.id] = {
              questionId: q.id,
              questionIndex: startIndex + i,
              state: 'active',
              selectedAnswer: null,
              isCorrect: null,
              isBookmarked: false,
              markedForReview: false,
              eliminatedChoices: [],
              timeSpentSeconds: 0,
              attemptCount: 0,
              explanationRevealed: false,
              answeredAt: null,
            };
          });

          // Persist so refresh/resume keeps working, and so answers can be
          // recorded against these questions the same way as any other.
          supabase
            .from('session_question_states')
            .upsert(
              toAdd.map((q, i) => ({
                session_id: sessionId,
                question_id: q.id,
                question_index: startIndex + i,
                state: 'active',
              })),
              { onConflict: 'session_id,question_id' }
            )
            .then(() => {});

          const updatedIds = [...s.questions.map((q) => q.id), ...toAdd.map((q) => q.id)];
          supabase
            .from('practice_sessions')
            .update({ generated_question_ids: updatedIds, total_questions: updatedIds.length })
            .eq('id', sessionId)
            .then(() => {});

          return {
            ...s,
            questions: [...s.questions, ...toAdd],
            questionStates: { ...s.questionStates, ...newStateEntries },
          };
        });
      }
      // If generation returns nothing (all providers unavailable or nothing
      // validated), we simply don't extend the buffer this cycle — the
      // student keeps going through whatever's already loaded rather than
      // ever seeing a broken or empty question.
    } catch (err) {
      console.error('[engine] loadMoreQuestions failed', err);
    } finally {
      isGeneratingMoreRef.current = false;
      setState((s) => ({ ...s, isGeneratingMore: false }));
    }
  }, [sessionId]);

  // Auto-trigger: keep at least 3 unanswered questions ready ahead of the
  // current one, only for infinite_practice — the other modes intentionally
  // keep their fixed, locked-in question list.
  useEffect(() => {
    if (state.isLoading || state.isFinished) return;
    if (state.session?.mode_key !== 'infinite_practice') return;
    const remaining = state.questions.length - state.currentIndex;
    if (remaining <= 3) {
      loadMoreQuestions();
    }
  }, [state.currentIndex, state.questions.length, state.isLoading, state.isFinished, state.session?.mode_key, loadMoreQuestions]);

  // --- Actions ---

  const selectAnswer = useCallback((questionId: string, answer: string) => {
    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs || qs.state === 'answered') return s;
      return {
        ...s,
        questionStates: {
          ...s.questionStates,
          [questionId]: { ...qs, selectedAnswer: answer },
        },
      };
    });
  }, []);

  const submitAnswer = useCallback(async (questionId: string) => {
    if (!sessionId) return;

    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs || !qs.selectedAnswer || qs.state === 'answered') return s;
      const question = s.questions.find((q) => q.id === questionId);
      if (!question) return s;

      const isCorrect = qs.selectedAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
      const updated: QuestionAnswerState = {
        ...qs,
        state: 'answered',
        isCorrect,
        attemptCount: qs.attemptCount + 1,
        answeredAt: new Date().toISOString(),
      };

      // Persist immediately (fire-and-forget, but we do it)
      supabase
        .from('session_question_states')
        .upsert(
          {
            session_id: sessionId,
            question_id: questionId,
            question_index: qs.questionIndex,
            state: 'answered',
            selected_answer: qs.selectedAnswer,
            is_correct: isCorrect,
            is_bookmarked: qs.isBookmarked,
            marked_for_review: qs.markedForReview,
            eliminated_choices: qs.eliminatedChoices,
            time_spent_seconds: qs.timeSpentSeconds,
            attempt_count: qs.attemptCount + 1,
            answered_at: updated.answeredAt,
          },
          { onConflict: 'session_id,question_id' }
        )
        .then(({ error }) => { if (error) console.error('Failed to save answer:', error); });

      return {
        ...s,
        questionStates: { ...s.questionStates, [questionId]: updated },
      };
    });
  }, [sessionId]);

  const toggleEliminate = useCallback((questionId: string, choice: string) => {
    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs || qs.state === 'answered') return s;
      const elim = qs.eliminatedChoices.includes(choice)
        ? qs.eliminatedChoices.filter((c) => c !== choice)
        : [...qs.eliminatedChoices, choice];
      return {
        ...s,
        questionStates: { ...s.questionStates, [questionId]: { ...qs, eliminatedChoices: elim } },
      };
    });
  }, []);

  const toggleMarkForReview = useCallback(async (questionId: string) => {
    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs) return s;
      const updated = { ...qs, markedForReview: !qs.markedForReview };
      if (sessionId) {
        supabase
          .from('session_question_states')
          .upsert({ session_id: sessionId, question_id: questionId, question_index: qs.questionIndex, marked_for_review: !qs.markedForReview }, { onConflict: 'session_id,question_id' })
          .then(({ error }) => { if (error) console.error(error); });
      }
      return { ...s, questionStates: { ...s.questionStates, [questionId]: updated } };
    });
  }, [sessionId]);

  const toggleBookmark = useCallback(async (questionId: string) => {
    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs) return s;
      const updated = { ...qs, isBookmarked: !qs.isBookmarked };
      if (sessionId) {
        supabase
          .from('session_question_states')
          .upsert({ session_id: sessionId, question_id: questionId, question_index: qs.questionIndex, is_bookmarked: !qs.isBookmarked }, { onConflict: 'session_id,question_id' })
          .then(({ error }) => { if (error) console.error(error); });
      }
      return { ...s, questionStates: { ...s.questionStates, [questionId]: updated } };
    });
  }, [sessionId]);

  const revealExplanation = useCallback(async (questionId: string) => {
    setState((s) => {
      const qs = s.questionStates[questionId];
      if (!qs) return s;
      const updated = { ...qs, explanationRevealed: true };
      if (sessionId) {
        supabase
          .from('session_question_states')
          .upsert({ session_id: sessionId, question_id: questionId, question_index: qs.questionIndex, explanation_revealed: true }, { onConflict: 'session_id,question_id' })
          .then(({ error }) => { if (error) console.error(error); });
      }
      return { ...s, questionStates: { ...s.questionStates, [questionId]: updated } };
    });
  }, [sessionId]);

  const goToQuestion = useCallback(async (index: number) => {
    if (!sessionId) return;
    setState((s) => ({ ...s, currentIndex: index }));
    await supabase
      .from('practice_sessions')
      .update({ last_question_index: index })
      .eq('id', sessionId);
  }, [sessionId]);

  const finishSession = useCallback(async () => {
    if (!sessionId) return;
    stopTimers();
    setState((s) => ({ ...s, isFinishing: true }));

    const { data: scoreData } = await supabase.rpc('compute_session_score', {
      p_session_id: sessionId,
    });

    const score = scoreData?.[0];

    await supabase
      .from('practice_sessions')
      .update({
        status: 'completed',
        correct_answers: score?.correct_count ?? 0,
        total_questions: score?.total_count ?? 0,
        score_percentage: score?.score_pct ?? 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    setState((s) => ({ ...s, isFinishing: false, isFinished: true }));
  }, [sessionId, stopTimers]);

  const pauseSession = useCallback(async () => {
    if (!sessionId) return;
    stopTimers();
    await supabase.from('practice_sessions').update({ status: 'paused' }).eq('id', sessionId);
  }, [sessionId, stopTimers]);

  return {
    ...state,
    selectAnswer,
    submitAnswer,
    toggleEliminate,
    toggleMarkForReview,
    toggleBookmark,
    revealExplanation,
    goToQuestion,
    finishSession,
    pauseSession,
    stopTimers,
    loadMoreQuestions,
  };
}

// Standalone: create a new session with locked-in question list
export async function createPracticeSession(
  userId: string,
  config: SessionConfig & { questionIds: string[] }
): Promise<string> {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      mode_key: config.modeKey,
      session_type: config.modeKey,
      status: 'active',
      source_type: config.sourceType,
      section_filter: config.section !== 'all' ? config.section : null,
      difficulty_filter: config.difficulty !== 'all' ? config.difficulty : null,
      domain_filter: config.domain !== 'all' ? config.domain : null,
      question_count_target: config.questionCountTarget,
      time_limit_seconds: config.timeLimitSeconds,
      shuffle_questions: config.shuffleQuestions,
      allow_backtracking: config.allowBacktracking,
      show_timer: config.showTimer,
      adaptive: config.adaptive,
      resume_allowed: true,
      session_seed: seed,
      generated_question_ids: config.questionIds,
      total_questions: config.questionIds.length,
      last_question_index: 0,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Find an active (resumable) session for a user+mode
export async function findActiveSession(
  userId: string,
  modeKey: ModeKey
): Promise<PracticeSessionRow | null> {
  const { data } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('mode_key', modeKey)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as PracticeSessionRow | null;
}

// Fetch questions for a mode (returns shuffled/filtered list of IDs)
export async function fetchQuestionsForMode(
  config: SessionConfig,
  userId: string,
  limit = 200
): Promise<string[]> {
  const { modeKey, section, difficulty, domain, skill, questionCountTarget } = config;

  if (modeKey === 'adaptive_practice') {
    // "Adaptive" previously did nothing different from a plain shuffle — the
    // `adaptive: true` flag was stored on the session row and never read
    // anywhere. This makes it real: the difficulty mix is weighted by the
    // student's own recent accuracy instead of being a flat random draw.
    //
    // Note on scope: the question list is still locked in up front (not
    // re-adjusted after every single answer within the session) because the
    // fixed-list design is what makes resume/backtrack work elsewhere in the
    // app. This adapts *between* sessions based on demonstrated performance,
    // which is a real, honest form of adaptive difficulty — just not a
    // live per-question re-ranking, which would need a bigger architecture
    // change to support resuming a session mid-way.
    const { data: recentStates } = await supabase
      .from('session_question_states')
      .select('is_correct, practice_sessions!inner(user_id)')
      .eq('practice_sessions.user_id', userId)
      .eq('state', 'answered')
      .order('answered_at', { ascending: false })
      .limit(50);

    const answered = recentStates ?? [];
    const accuracy = answered.length > 0
      ? answered.filter((a: any) => a.is_correct).length / answered.length
      : 0.5; // no history yet — start balanced

    // Higher accuracy -> lean harder. Lower accuracy -> lean easier.
    // Weights always sum to 1; a brand-new student gets a gentle mixed set.
    let weights: Record<'easy' | 'medium' | 'hard', number>;
    if (accuracy >= 0.85) weights = { easy: 0.1, medium: 0.3, hard: 0.6 };
    else if (accuracy >= 0.65) weights = { easy: 0.2, medium: 0.5, hard: 0.3 };
    else if (accuracy >= 0.4) weights = { easy: 0.4, medium: 0.45, hard: 0.15 };
    else weights = { easy: 0.6, medium: 0.35, hard: 0.05 };

    const perTier = async (tier: 'easy' | 'medium' | 'hard', take: number): Promise<string[]> => {
      if (take <= 0) return [];
      let tq = supabase
        .from('question_bank')
        .select('id')
        .eq('status', 'published')
        .eq('is_valid', true)
        .eq('difficulty', tier)
        .limit(limit);
      if (section && section !== 'all') tq = tq.eq('section', section);
      if (domain && domain !== 'all') tq = tq.eq('domain_id', domain);
      if (skill && skill !== 'all') tq = tq.eq('skill_id', skill);
      const { data } = await tq;
      return shuffle((data ?? []).map((r: any) => r.id)).slice(0, take);
    };

    const target = questionCountTarget || 20;
    const [easyIds, mediumIds, hardIds] = await Promise.all([
      perTier('easy', Math.round(target * weights.easy)),
      perTier('medium', Math.round(target * weights.medium)),
      perTier('hard', Math.round(target * weights.hard)),
    ]);

    // Interleave rather than concatenate, so the session doesn't front-load
    // (or back-load) one difficulty tier — pacing matters for how it feels.
    const tiers = [easyIds, mediumIds, hardIds];
    const interleaved: string[] = [];
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (const tier of tiers) {
        const next = tier.shift();
        if (next) {
          interleaved.push(next);
          anyLeft = true;
        }
      }
    }

    if (interleaved.length > 0) return interleaved.slice(0, target);
    // Fall through to the standard query below if no published questions
    // exist yet for any difficulty tier (e.g. an early-stage question bank).
  }

  if (modeKey === 'review_mistakes') {
    const { data } = await supabase
      .from('session_question_states')
      .select('question_id, practice_sessions!inner(user_id)')
      .eq('practice_sessions.user_id', userId)
      .eq('is_correct', false)
      .limit(limit);

    if (!data || data.length === 0) return [];
    const allIds = data.map((r: any) => r.question_id);
    const ids = allIds.filter((id: string, idx: number) => allIds.indexOf(id) === idx);
    return config.shuffleQuestions ? shuffle(ids) : ids;
  }

  if (modeKey === 'bookmarked_questions') {
    const { data } = await supabase
      .from('bookmarked_questions')
      .select('question_id')
      .eq('user_id', userId)
      .limit(limit);
    if (!data || data.length === 0) return [];
    const ids = data.map((r: any) => r.question_id);
    return config.shuffleQuestions ? shuffle(ids) : ids;
  }

  if (modeKey === 'weakest_topics') {
    // Get weak skill IDs from past attempts
    const { data: attempts } = await supabase
      .from('session_question_states')
      .select('question_id, is_correct, practice_sessions!inner(user_id)')
      .eq('practice_sessions.user_id', userId)
      .eq('state', 'answered')
      .limit(500);

    if (!attempts || attempts.length === 0) return [];

    // Group by question and then match to skills from bank
    const wrongIds = attempts.filter((a: any) => !a.is_correct).map((a: any) => a.question_id);
    if (wrongIds.length === 0) return [];

    let q = supabase
      .from('question_bank')
      .select('id, skill_id')
      .eq('status', 'published')
      .eq('is_valid', true)
      .in('id', wrongIds.slice(0, 200));
    const { data: wrongQs } = await q;

    const skillCounts: Record<string, number> = {};
    (wrongQs ?? []).forEach((wq: any) => {
      if (wq.skill_id) skillCounts[wq.skill_id] = (skillCounts[wq.skill_id] ?? 0) + 1;
    });

    const topWeakSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    if (topWeakSkills.length === 0) return wrongIds.slice(0, questionCountTarget);

    let wq = supabase
      .from('question_bank')
      .select('id')
      .eq('status', 'published')
      .eq('is_valid', true)
      .in('skill_id', topWeakSkills)
      .limit(limit);
    const { data: bankRows } = await wq;
    const ids = (bankRows ?? []).map((r: any) => r.id);
    return shuffle(ids).slice(0, questionCountTarget);
  }

  // Standard query - only fetch valid questions
  let q = supabase
    .from('question_bank')
    .select('id')
    .eq('status', 'published')
    .eq('is_valid', true)
    .limit(limit);

  if (section && section !== 'all') q = q.eq('section', section);
  if (difficulty && difficulty !== 'all') q = q.eq('difficulty', difficulty);
  if (domain && domain !== 'all') q = q.eq('domain_id', domain);
  if (skill && skill !== 'all') q = q.eq('skill_id', skill);

  const { data } = await q;
  if (!data || data.length === 0) return [];

  const ids = data.map((r: any) => r.id);
  const shuffled = config.shuffleQuestions ? shuffle(ids) : ids;

  if (modeKey === 'infinite_practice' || modeKey === 'exam_simulation') return shuffled;
  return shuffled.slice(0, questionCountTarget);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
