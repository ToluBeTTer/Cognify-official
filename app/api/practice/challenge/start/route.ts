import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { initialChallengeState, pickNextChallengeQuestion } from '@/lib/practice/challenge-engine';

export const runtime = 'nodejs';

function getAuthedClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  // A client authenticated AS the calling user (not service role) — question_bank
  // reads and the session insert both go through normal RLS as this user.
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

  let body: { section?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const section = body.section || null;

  const state = initialChallengeState();
  const firstQuestion = await pickNextChallengeQuestion(supabase, state, section);

  if (!firstQuestion) {
    return NextResponse.json(
      { success: false, error: 'No published questions available for this section yet.' },
      { status: 404 }
    );
  }

  const { data: session, error: sessionErr } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userData.user.id,
      session_type: 'challenge_mode',
      mode_key: 'challenge_mode',
      status: 'active',
      section_filter: section,
      adaptive: true,
      shuffle_questions: true,
      allow_backtracking: false,
      resume_allowed: false,
      generated_question_ids: [firstQuestion.id],
      challenge_state: state,
      total_questions: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error('[challenge/start] Failed to create session', sessionErr);
    return NextResponse.json({ success: false, error: 'Failed to start Challenge Mode.' }, { status: 500 });
  }

  const { data: fullQuestion } = await supabase
    .from('question_bank')
    .select('*, domains(name), skills(name, code)')
    .eq('id', firstQuestion.id)
    .single();

  return NextResponse.json({
    success: true,
    session_id: session.id,
    question: fullQuestion,
    state,
  });
}
