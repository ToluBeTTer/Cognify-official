import type { AIRequest } from '@/lib/ai/types';
import { fetchAttachment, buildTextForModel, type ProviderResult } from './shared';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_CONTENT_LENGTH = 8000;
const MAX_ATTACHMENTS = 3;

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Gemini is the default primary provider — free tier, and unlike Groq it
 * handles images natively, which Milo needs for reading question screenshots.
 *
 * Throws on failure (including quota/rate-limit errors) so the caller in
 * app/api/ai/route.ts can catch it and fall back to Groq.
 */
export async function callGemini(
  aiRequest: AIRequest,
  systemPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const parts: any[] = [];

  if (aiRequest.attachments?.length) {
    for (const attachment of aiRequest.attachments.slice(0, MAX_ATTACHMENTS)) {
      const fetched = await fetchAttachment(attachment);
      if (fetched) {
        parts.push({ inline_data: { mime_type: fetched.mediaType, data: fetched.base64 } });
      }
    }
  }

  parts.push({ text: buildTextForModel(aiRequest, MAX_CONTENT_LENGTH) });

  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      system_instruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[gemini] API error', res.status, errText);
    throw new Error(`Gemini error ${res.status}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';

  if (!text) {
    // Gemini can return an empty candidate when its safety filters trip —
    // treat that as a failure so the caller falls back rather than showing
    // an empty response.
    throw new Error('Gemini returned no content');
  }

  return {
    text,
    inputTokens: json?.usageMetadata?.promptTokenCount || 0,
    outputTokens: json?.usageMetadata?.candidatesTokenCount || 0,
  };
}
