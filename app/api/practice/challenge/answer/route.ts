import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { advanceChallengeState, pickNextChallengeQuestion } from '@/lib/practice/challenge-engine';
import type { ChallengeState } from '@/lib/practice/types';

export const runtime = 'nodejs';

function getAuthedClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ success: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const supabase = getAuthedClient(token);
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Server misconfigured.' }, { status: 500 });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ success: false, error: 'Invalid session.' }, { status: 401 });
  }

  let body: { session_id?: string; question_id?: string; selected_answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { session_id, question_id, selected_answer } = body;
  if (!session_id || !question_id || !selected_answer) {
    return NextResponse.json({ success: false, error: 'Missing session_id, question_id, or selected_answer.' }, { status: 400 });
  }

  // Load the session (RLS ensures this user can only load their own).
  const { data: session, error: sessionErr } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', userData.user.id)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 });
  }

  // Load the actual question to check correctness server-side — never trust
  // a client-submitted "was this correct" flag.
  const { data: question, error: questionErr } = await supabase
    .from('question_bank')
    .select('id, correct_answer, domain_id, explanation')
    .eq('id', question_id)
    .single();

  if (questionErr || !question) {
    return NextResponse.json({ success: false, error: 'Question not found.' }, { status: 404 });
  }

  const isCorrect = question.correct_answer === selected_answer;
  const prevState: ChallengeState = (session.challenge_state as ChallengeState) || {
    streak: 0,
    difficulty: 'medium',
    domainMisses: {},
    servedQuestionIds: [],
  };

  const nextState = advanceChallengeState(prevState, isCorrect, question.domain_id, question_id);

  // Record this answer (best-effort — doesn't block returning the result).
  await supabase.from('session_question_states').upsert(
    {
      session_id,
      question_id,
      question_index: nextState.servedQuestionIds.length - 1,
      state: 'answered',
      selected_answer,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,question_id' }
  );

  const nextQuestionMeta = await pickNextChallengeQuestion(supabase, nextState, session.section_filter);

  let nextQuestion = null;
  if (nextQuestionMeta) {
    const { data: fullQuestion } = await supabase
      .from('question_bank')
      .select('*, domains(name), skills(name, code)')
      .eq('id', nextQuestionMeta.id)
      .single();
    nextQuestion = fullQuestion;
  }

  const updatedIds = [...(Array.isArray(session.generated_question_ids) ? session.generated_question_ids : []), nextQuestionMeta?.id].filter(Boolean);

  await supabase
    .from('practice_sessions')
    .update({
      challenge_state: nextState,
      generated_question_ids: updatedIds,
      total_questions: nextState.servedQuestionIds.length,
      correct_answers: (session.correct_answers || 0) + (isCorrect ? 1 : 0),
    })
    .eq('id', session_id);

  return NextResponse.json({
    success: true,
    is_correct: isCorrect,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    state: nextState,
    next_question: nextQuestion,
  });
}
