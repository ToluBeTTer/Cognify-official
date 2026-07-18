import type { AIRequest } from '@/lib/ai/types';
import { fetchAttachment, buildTextForModel, type ProviderResult } from './shared';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_CONTENT_LENGTH = 8000;
const MAX_ATTACHMENTS = 3;

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * No longer the default — Gemini is. This stays available as the last
 * fallback if both free providers fail, and as the natural place to route
 * a future paid tier where quality-over-cost is worth paying for.
 */
export async function callAnthropic(
  aiRequest: AIRequest,
  systemPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const contentBlocks: any[] = [];

  if (aiRequest.attachments?.length) {
    for (const attachment of aiRequest.attachments.slice(0, MAX_ATTACHMENTS)) {
      const fetched = await fetchAttachment(attachment);
      if (fetched) {
        contentBlocks.push(
          fetched.isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fetched.base64 } }
            : { type: 'image', source: { type: 'base64', media_type: fetched.mediaType, data: fetched.base64 } }
        );
      }
    }
  }

  contentBlocks.push({ type: 'text', text: buildTextForModel(aiRequest, MAX_CONTENT_LENGTH) });

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[anthropic] API error', res.status, errText);
    throw new Error(`Anthropic error ${res.status}`);
  }

  const json = await res.json();
  const textBlock = (json.content || []).find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Anthropic returned no content');

  return {
    text: textBlock.text,
    inputTokens: json.usage?.input_tokens || 0,
    outputTokens: json.usage?.output_tokens || 0,
  };
}
