import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AIRequest, AIConfig, AIResponse } from '@/lib/ai/types';
import { safeParseJson, GENERATE_QUESTION_SYSTEM_PROMPT } from '@/lib/ai-server/shared';
import { callGemini, isGeminiConfigured } from '@/lib/ai-server/gemini';
import { callGroq, isGroqConfigured } from '@/lib/ai-server/groq';
import { callOpenRouter, isOpenRouterConfigured } from '@/lib/ai-server/openrouter';
import { callAnthropic, isAnthropicConfigured } from '@/lib/ai-server/anthropic';
import type { ProviderResult } from '@/lib/ai-server/shared';

/**
 * Server-side Milo endpoint.
 *
 * Tries providers in order: Gemini (free, default, handles images) → Groq
 * (free, fast, text-only fallback) → Anthropic (only if configured — kept
 * available for a future paid tier, not required for the app to work).
 *
 * This is the ONLY place any of these API keys are ever read. The client
 * never sees them — the browser calls this route, and this route calls
 * whichever provider actually answers.
 */
export const runtime = 'nodejs';

const MAX_ATTACHMENTS = 3;

function getSupabaseForAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

/**
 * Requires a valid Supabase session token. Without this, anyone could hit
 * this route directly and run up API usage with no rate limiting and no
 * accountability.
 */
async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = getSupabaseForAuth();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function systemPromptFor(type: AIRequest['type']): string {
  const base =
    "You are Milo, Cognify's SAT tutor. You are precise, encouraging, and never condescending. " +
    'You ground every explanation in real SAT content and never invent facts, formulas, or answer choices. ' +
    "If an image is attached, read the question directly from the image — don't ask the student to retype it. " +
    'FORMATTING RULES — follow these strictly, this app has no LaTeX renderer so LaTeX syntax shows up as broken ' +
    'literal characters on screen:\n' +
    '- Write math in plain readable text: x^2, x/y, sqrt(x), x_1, (x + y)/2\n' +
    '- Do NOT use LaTeX: no \\frac, \\sqrt, \\cdot, no dollar signs ($), no \\[ \\], no \\( \\)\n' +
    '- Do NOT use random backslashes or curly braces\n' +
    '- For fractions write numerator/denominator, e.g. 1/2, (x+1)/(x-1)\n' +
    '- For exponents write x^2, y^3; for subscripts write x_1, y_0\n' +
    '- Bold important terms using **word** only — no other markdown symbols\n' +
    '- Use numbered lists for steps (1. 2. 3.) and bullet points (- item) for concepts\n' +
    '- No horizontal rules, no HTML, no code blocks\n' +
    'Example — write "x = y^2, so 1/100 of that is 0.01y^2", never "$x=y^{2}$" or "\\(x=y^2\\)".';


  switch (type) {
    case 'explanation':
      return (
        `${base}\n\nRespond with ONLY valid JSON (no markdown code fences, no prose outside the JSON) matching exactly:\n` +
        `{"response": string (a clear, step-by-step markdown explanation), ` +
        `"hints": string[] (2-3 progressively revealing hints, smallest first), ` +
        `"relatedConcepts": string[] (2-4 short related topics), ` +
        `"classification": {"subject": string, "domain": string, "topic": string, "confidence": number between 0 and 1}, ` +
        `"ocrText": string | null (ONLY if an image/PDF is attached: the question text transcribed exactly as written, including answer choices; null if no attachment), ` +
        `"ocrConfidence": number between 0 and 1 | null (how confident you are in that transcription; null if no attachment)}`
      );
    case 'hint':
      return (
        `${base}\n\nThe student wants a nudge, not the full solution. Respond with ONLY valid JSON:\n` +
        `{"response": string (a short hint that does not reveal the final answer), "hints": string[]}`
      );
    case 'follow-up':
      return (
        `${base}\n\nThis is one turn in an ongoing chat — reply naturally and conversationally, ` +
        `referencing prior context if it's provided. Respond with ONLY valid JSON:\n` +
        `{"response": string (markdown allowed)}`
      );
    case 'casual_chat':
      return (
        "You are Milo — but off-duty right now. The student isn't asking for SAT help, they're just " +
        'hanging out and chatting with their study buddy companion. Be warm, a little playful, genuinely ' +
        'curious about them as a person, and brief — this is a chat bubble, not an essay. 1-3 sentences per ' +
        "reply, no lists, no headers. You can be encouraging about their studying without lecturing, and if " +
        "they mention being stuck on something, gently mention they can tap \"Ask for Help\" for real tutoring " +
        "— but don't force it if they just want to talk. Never claim to have feelings or a physical body " +
        "literally, but you can play along with being a small companion character warmly and lightly. " +
        'Respond with ONLY valid JSON:\n' +
        '{"response": string (plain, casual, 1-3 sentences, no markdown)}'
      );
    case 'classify':
      return (
        `${base}\n\nClassify this question only. Respond with ONLY valid JSON:\n` +
        `{"classification": {"subject": string, "domain": string, "topic": string, "confidence": number between 0 and 1}}`
      );
    case 'ocr':
      return (
        'Transcribe all visible question text from the image exactly as written, including answer choices. ' +
        'Respond with ONLY valid JSON: {"ocrText": string, "ocrConfidence": number between 0 and 1}'
      );
    case 'extract_questions':
      return (
        'You are extracting SAT-style practice questions from an uploaded document or image for a question bank import. ' +
        'A single file may contain one question or many (e.g. a full practice test). Extract every distinct question you can find. ' +
        'Do not invent questions or answers that are not actually present. If a correct answer or explanation is not shown in the ' +
        'source material, leave that field null rather than guessing. If the source includes a reading passage, paragraph, or poem ' +
        'the question refers to, put that in the passage field — do not fold it into question_text. Respond with ONLY valid JSON:\n' +
        '{"questions": [{' +
        '"question_text": string, ' +
        '"passage": string | null (a reading passage/paragraph/poem the question depends on, verbatim, only if one is present), ' +
        '"question_format": "multiple_choice" | "numeric_entry" | "passage_based" | "graph_table" | "image_based" | "two_part" | "multi_select", ' +
        '"choices": {"a": string, "b": string, "c": string, "d": string} | null, ' +
        '"correct_answer": string | null, ' +
        '"explanation": string | null, ' +
        '"hint": string | null, ' +
        '"section": "math" | "reading" | "writing" | null, ' +
        '"difficulty": "easy" | "medium" | "hard" | null, ' +
        '"section_confidence": number between 0 and 1, ' +
        '"difficulty_confidence": number between 0 and 1' +
        '}]}'
      );
    case 'generate_question':
      return GENERATE_QUESTION_SYSTEM_PROMPT;
    default:
      return base;
  }
}

function isVisionRequest(aiRequest: AIRequest): boolean {
  return !!aiRequest.attachments?.some((a) => a.type === 'image' || a.type === 'screenshot');
}

function buildAIResponse(
  result: ProviderResult,
  provider: import('@/lib/ai/types').AIProvider,
  model: string,
  startedAt: number,
  requestType: AIRequest['type']
): AIResponse {
  const parsed = safeParseJson(result.text);

  const responseText: string =
    parsed?.response ??
    parsed?.explanation ??
    result.text ??
    'I was not able to generate a response. Please try rephrasing your question.';

  return {
    success: true,
    data: {
      explanation: responseText,
      hints: parsed?.hints,
      relatedConcepts: parsed?.relatedConcepts,
      classification: parsed?.classification,
      ocrText: parsed?.ocrText,
      ocrConfidence: parsed?.ocrConfidence,
      extractedQuestions: requestType === 'extract_questions' ? parsed?.questions : undefined,
      generatedQuestions: requestType === 'generate_question' ? parsed?.questions : undefined,
    },
    metadata: {
      provider,
      model,
      tokensUsed: result.inputTokens + result.outputTokens,
      processingTimeMs: Date.now() - startedAt,
    },
  };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const anyProviderConfigured = isGeminiConfigured() || isGroqConfigured() || isOpenRouterConfigured() || isAnthropicConfigured();
  if (!anyProviderConfigured) {
    const body: AIResponse = {
      success: false,
      error: 'Milo is not configured on the server yet (no AI provider API keys set).',
    };
    return NextResponse.json(body, { status: 503 });
  }

  const user = await authenticate(req);
  if (!user) {
    const body: AIResponse = { success: false, error: 'You must be signed in to use Milo.' };
    return NextResponse.json(body, { status: 401 });
  }

  let parsedBody: { request: AIRequest; config?: AIConfig };
  try {
    parsedBody = await req.json();
  } catch {
    const body: AIResponse = { success: false, error: 'Invalid request body.' };
    return NextResponse.json(body, { status: 400 });
  }

  const { request: aiRequest, config } = parsedBody || {};
  if (!aiRequest || !aiRequest.type) {
    const body: AIResponse = { success: false, error: 'Missing request type.' };
    return NextResponse.json(body, { status: 400 });
  }

  const systemPrompt = systemPromptFor(aiRequest.type);
  const maxTokens = config?.maxTokens || (aiRequest.type === 'extract_questions' || aiRequest.type === 'generate_question' ? 4096 : 1200);
  const needsVision = isVisionRequest(aiRequest);

  // Gemini first (handles both text and vision).
  if (isGeminiConfigured()) {
    try {
      const result = await callGemini(aiRequest, systemPrompt, maxTokens);
      return NextResponse.json(buildAIResponse(result, 'gemini', process.env.GEMINI_MODEL || 'gemini-2.5-flash', startedAt, aiRequest.type));
    } catch (err) {
      console.error('[api/ai] Gemini failed, falling back', err);
    }
  }

  // Groq fallback — text only. If this request needed vision, don't silently
  // send the image nowhere; respond honestly instead of guessing.
  if (!needsVision && isGroqConfigured()) {
    try {
      const result = await callGroq(aiRequest, systemPrompt, maxTokens);
      return NextResponse.json(buildAIResponse(result, 'groq', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', startedAt, aiRequest.type));
    } catch (err) {
      console.error('[api/ai] Groq failed, falling back', err);
    }
  }

  // OpenRouter — third layer, text only, same vision caveat as Groq.
  if (!needsVision && isOpenRouterConfigured()) {
    try {
      const result = await callOpenRouter(aiRequest, systemPrompt, maxTokens);
      return NextResponse.json(
        buildAIResponse(result, 'openrouter', process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', startedAt, aiRequest.type)
      );
    } catch (err) {
      console.error('[api/ai] OpenRouter failed, falling back', err);
    }
  }

  // Anthropic — last resort, only if a key happens to be configured.
  if (isAnthropicConfigured()) {
    try {
      const result = await callAnthropic(aiRequest, systemPrompt, maxTokens);
      return NextResponse.json(buildAIResponse(result, 'anthropic', process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', startedAt, aiRequest.type));
    } catch (err) {
      console.error('[api/ai] Anthropic failed', err);
    }
  }

  if (needsVision) {
    const body: AIResponse = {
      success: false,
      error: "I can't read images right now, but I can still help if you describe the question in words.",
    };
    return NextResponse.json(body, { status: 502 });
  }

  const body: AIResponse = { success: false, error: 'Milo is temporarily unavailable. Please try again shortly.' };
  return NextResponse.json(body, { status: 502 });
}
