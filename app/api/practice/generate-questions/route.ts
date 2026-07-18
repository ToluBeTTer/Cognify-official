import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGemini, isGeminiConfigured } from '@/lib/ai-server/gemini';
import { callGroq, isGroqConfigured } from '@/lib/ai-server/groq';
import { callOpenRouter, isOpenRouterConfigured } from '@/lib/ai-server/openrouter';
import { safeParseJson, GENERATE_QUESTION_SYSTEM_PROMPT } from '@/lib/ai-server/shared';
import { filterValidQuestions, type GeneratedQuestionCandidate } from '@/lib/practice/question-validation';
import type { AIRequest } from '@/lib/ai/types';

/**
 * Generates new procedural questions for Infinite Practice mode, validates
 * every one of them, and caches the valid ones in `procedural_questions` so
 * other students can reuse them too (saves API calls). Any signed-in user
 * can call this — but the actual insert into the shared cache table uses
 * the service role, not the caller's own session, so a student can never
 * write directly into a table every other student will see.
 */
export const runtime = 'nodejs';

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const supabase = getSupabaseAuthClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function generateOnce(
  subject: string,
  difficulty: string,
  count: number,
  topic: string | undefined
): Promise<{ candidates: GeneratedQuestionCandidate[]; provider: string | null }> {
  const aiRequest: AIRequest = {
    type: 'generate_question',
    content: `Generate ${count} ${subject} question(s) at ${difficulty} difficulty${topic ? ` focused on ${topic}` : ''}.`,
    context: { subject, topic },
  };

  let text: string | null = null;
  let provider: string | null = null;

  if (isGeminiConfigured()) {
    try {
      const result = await callGemini(aiRequest, GENERATE_QUESTION_SYSTEM_PROMPT, 4096);
      text = result.text;
      provider = 'gemini';
    } catch (err) {
      console.error('[generate-questions] Gemini failed', err);
    }
  }

  if (!text && isGroqConfigured()) {
    try {
      const result = await callGroq(aiRequest, GENERATE_QUESTION_SYSTEM_PROMPT, 4096);
      text = result.text;
      provider = 'groq';
    } catch (err) {
      console.error('[generate-questions] Groq failed', err);
    }
  }

  if (!text && isOpenRouterConfigured()) {
    try {
      const result = await callOpenRouter(aiRequest, GENERATE_QUESTION_SYSTEM_PROMPT, 4096);
      text = result.text;
      provider = 'openrouter';
    } catch (err) {
      console.error('[generate-questions] OpenRouter failed', err);
    }
  }

  if (!text) return { candidates: [], provider: null };

  const parsed = safeParseJson(text);
  return { candidates: Array.isArray(parsed?.questions) ? parsed.questions : [], provider };
}

export async function POST(req: NextRequest) {
  if (!isGeminiConfigured() && !isGroqConfigured()) {
    return NextResponse.json({ success: false, error: 'No AI provider configured.', questions: [] }, { status: 503 });
  }

  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'You must be signed in.', questions: [] }, { status: 401 });
  }

  let body: { subject?: string; difficulty?: string; count?: number; topic?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.', questions: [] }, { status: 400 });
  }

  const subject = body.subject || 'math';
  const difficulty = body.difficulty || 'medium';
  const count = Math.min(Math.max(body.count || 3, 1), 5); // sane bounds — never a runaway batch
  const topic = body.topic;

  // First attempt
  let { candidates, provider: providerUsed } = await generateOnce(subject, difficulty, count, topic);
  let { valid, rejected } = filterValidQuestions(candidates);

  // One retry if the first attempt produced nothing usable at all — a
  // transient bad generation shouldn't mean the student sees nothing.
  if (valid.length === 0 && candidates.length > 0) {
    console.warn('[generate-questions] All candidates failed validation, retrying once', rejected.map((r) => r.reason));
    ({ candidates, provider: providerUsed } = await generateOnce(subject, difficulty, count, topic));
    ({ valid } = filterValidQuestions(candidates));
  }

  if (valid.length === 0) {
    // Honest empty result — the caller (engine.ts) falls back to the
    // curated Question Bank when this happens, rather than the student
    // ever seeing a broken or empty question.
    return NextResponse.json({ success: true, questions: [] });
  }

  // valid.length > 0 by this point guarantees a provider succeeded, but the
  // type is still nullable — this fallback is just to satisfy that, not a
  // real runtime path.
  const providerLabel = providerUsed || 'unknown';

  const serviceClient = getServiceRoleClient();

  let insertedRows: any[] = [];
  if (serviceClient) {
    const { data, error } = await serviceClient
      .from('procedural_questions')
      .insert(
        valid.map((q) => ({
          question_text: q.question_text,
          passage: q.passage,
          choices: q.choices,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          hint: q.hint,
          topic: q.topic,
          section: q.section,
          difficulty: q.difficulty,
          provider: providerLabel,
        }))
      )
      .select();

    if (error) {
      console.error('[generate-questions] Failed to cache generated questions', error);
    } else {
      insertedRows = data || [];
    }
  }

  // Even if caching failed for some reason, still return the validated
  // questions to the student — caching is an optimization, not a
  // requirement for the feature to work.
  const questions =
    insertedRows.length > 0
      ? insertedRows
      : valid.map((q) => ({ ...q, id: undefined, provider: providerLabel }));

  return NextResponse.json({ success: true, questions });
}
