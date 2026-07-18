export type { AIProvider, AIConfig, AIRequest, AIResponse, AIAttachment, AIProviderInterface } from './types';
export { MockAIProvider } from './mock-provider';
export { RealAIProvider } from './real-ai-provider';

import { MockAIProvider } from './mock-provider';
import { RealAIProvider } from './real-ai-provider';
import type { AIProviderInterface } from './types';

/**
 * Returns the active AI provider.
 *
 * Defaults to the real Claude-backed provider (routed through /api/ai).
 * Set NEXT_PUBLIC_AI_PROVIDER=mock in your local .env to fall back to the
 * canned mock responses when you don't have an ANTHROPIC_API_KEY handy —
 * useful for offline UI work, never for anything student-facing.
 */
export function getAIProvider(): AIProviderInterface {
  if (process.env.NEXT_PUBLIC_AI_PROVIDER === 'mock') {
    return new MockAIProvider();
  }
  return new RealAIProvider();
}
