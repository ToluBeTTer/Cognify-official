import type { AIRequest } from '@/lib/ai/types';

/**
 * Server-only AI provider layer.
 *
 * Deliberately kept out of lib/ai/ (the client-facing folder) so there's no
 * chance any of this — API keys, provider-specific request shapes — ever
 * ends up in a client bundle. Only app/api/ai/route.ts imports from here.
 */

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface FetchedAttachment {
  mediaType: string;
  base64: string;
  isPdf: boolean;
}

export async function fetchAttachment(attachment: { type: string; url: string }): Promise<FetchedAttachment | null> {
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) return null;

    const headerType = res.headers.get('content-type');
    const isPdf = attachment.type === 'pdf' || headerType === 'application/pdf';
    const mediaType = headerType || (isPdf ? 'application/pdf' : 'image/png');

    const buf = Buffer.from(await res.arrayBuffer());
    return { mediaType, base64: buf.toString('base64'), isPdf };
  } catch (err) {
    console.error('[ai-server] Failed to fetch attachment', err);
    return null;
  }
}

export function safeParseJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function buildTextForModel(aiRequest: AIRequest, maxContentLength: number): string {
  const content = (aiRequest.content || '').slice(0, maxContentLength);

  const contextLines: string[] = [];
  if (aiRequest.context?.subject) contextLines.push(`Subject: ${aiRequest.context.subject}`);
  if (aiRequest.context?.domain) contextLines.push(`Domain: ${aiRequest.context.domain}`);
  if (aiRequest.context?.topic) contextLines.push(`Topic: ${aiRequest.context.topic}`);
  if (aiRequest.context?.previousContext) contextLines.push(`Conversation so far:\n${aiRequest.context.previousContext}`);

  return [contextLines.join('\n'), content].filter(Boolean).join('\n\n') || 'No question text was provided.';
}

/**
 * The system prompt Milo uses for question generation specifically — shared
 * between /api/ai (when a client calls generateQuestions through the normal
 * Milo interface) and /api/practice/generate-questions (the server-trusted
 * route that actually validates and caches results). Kept in one place so
 * the two never drift apart.
 */
export const GENERATE_QUESTION_SYSTEM_PROMPT =
  'You are Milo, generating original SAT-style practice questions for Cognify. ' +
  'CRITICAL RULES:\n' +
  '1. Only generate text-reliable formats: algebra/word-problem math, grammar/writing questions, or reading passage + question. ' +
  'NEVER generate chart, graph, table, or diagram-dependent questions — those require visual elements you cannot produce reliably.\n' +
  '2. Every question needs EXACTLY 4 answer choices.\n' +
  '3. correct_answer must be exactly one of "a", "b", "c", or "d", and must match a real, correct choice.\n' +
  '4. Every question must include a real explanation of why the correct answer is right.\n' +
  '5. If it is a reading question, include the FULL passage (at least 100 characters) — never reference a passage without including it.\n' +
  '6. For math, verify the answer is actually mathematically correct before responding.\n' +
  '7. Include a topic field (e.g. "Linear Equations", "Subject-Verb Agreement", "Inference").\n' +
  '8. MATH FORMATTING: this app has no LaTeX renderer. Never use LaTeX syntax (no $, no backslashes, no \\frac, ' +
  '\\sqrt, \\cdot, or similar commands, no curly braces used as LaTeX delimiters). Write math in plain text: ' +
  'exponents as x^2, fractions as 1/100, multiplication as x * y, square roots as sqrt(x), subscripts as x_1, ' +
  'coordinate pairs as (x, y). Bold only with **word**, no other markdown symbols, no code blocks.\n' +
  'Respond with ONLY valid JSON:\n' +
  '{"questions": [{' +
  '"question_text": string, ' +
  '"passage": string | null, ' +
  '"choices": {"a": string, "b": string, "c": string, "d": string}, ' +
  '"correct_answer": "a" | "b" | "c" | "d", ' +
  '"explanation": string, ' +
  '"hint": string, ' +
  '"topic": string, ' +
  '"section": "math" | "reading" | "writing", ' +
  '"difficulty": "easy" | "medium" | "hard"' +
  '}]}';
