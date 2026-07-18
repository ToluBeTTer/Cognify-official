import type { AIRequest } from '@/lib/ai/types';
import { buildTextForModel, type ProviderResult } from './shared';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_CONTENT_LENGTH = 8000;

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Groq is the fallback provider — fast and free, but text-only (no reliable
 * vision support across its hosted open models), so this is only ever
 * called for non-image requests, or as a last resort with an honest
 * "can't read the image right now" message layered on top by the caller.
 */
export async function callGroq(
  aiRequest: AIRequest,
  systemPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const userText = buildTextForModel(aiRequest, MAX_CONTENT_LENGTH);

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[groq] API error', res.status, errText);
    throw new Error(`Groq error ${res.status}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq returned no content');

  return {
    text,
    inputTokens: json?.usage?.prompt_tokens || 0,
    outputTokens: json?.usage?.completion_tokens || 0,
  };
}
