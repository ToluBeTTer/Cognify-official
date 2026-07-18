import type { AIRequest } from '@/lib/ai/types';
import { buildTextForModel, type ProviderResult } from './shared';

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_CONTENT_LENGTH = 8000;

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * OpenRouter — third fallback layer, after Gemini and Groq. Text-only in
 * this setup (same reasoning as Groq: vision support varies by model and
 * isn't reliable enough to route image requests through here).
 */
export async function callOpenRouter(
  aiRequest: AIRequest,
  systemPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const userText = buildTextForModel(aiRequest, MAX_CONTENT_LENGTH);

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      // OpenRouter asks for these to identify traffic — harmless either way.
      'HTTP-Referer': process.env.APP_URL || 'https://cognify.app',
      'X-Title': 'Cognify',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[openrouter] API error', res.status, errText);
    throw new Error(`OpenRouter error ${res.status}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('OpenRouter returned no content');

  return {
    text,
    inputTokens: json?.usage?.prompt_tokens || 0,
    outputTokens: json?.usage?.completion_tokens || 0,
  };
}
