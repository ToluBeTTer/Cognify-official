'use client';

/**
 * Real AI provider. Runs in the browser but never touches any provider's
 * API key directly — every call goes through our own /api/ai route, which
 * tries Gemini, then Groq, then Anthropic (whichever is configured and
 * available) server-side, and checks the caller is a signed-in Supabase user.
 */

import { supabase } from '@/lib/supabase';
import type {
  AIProviderInterface,
  AIRequest,
  AIResponse,
  AIConfig,
  AIAttachment,
} from './types';

async function callAiApi(request: AIRequest, config?: AIConfig): Promise<AIResponse> {
  let token: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch {
    // fall through with no token — the route will reject with a clear 401
  }

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ request, config }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return {
        success: false,
        error: json?.error || `Milo request failed (${res.status})`,
      };
    }

    return json as AIResponse;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Could not reach Milo. Check your connection and try again.',
    };
  }
}

export class RealAIProvider implements AIProviderInterface {
  generateResponse(request: AIRequest, config?: AIConfig): Promise<AIResponse> {
    return callAiApi(request, config);
  }

  classifyQuestion(content: string, attachments?: AIAttachment[]): Promise<AIResponse> {
    return callAiApi({ type: 'classify', content, attachments });
  }

  performOCR(imageUrl: string): Promise<AIResponse> {
    return callAiApi({
      type: 'ocr',
      content: '',
      attachments: [{ type: 'image', url: imageUrl }],
    });
  }

  generateHints(explanation: string, level: number): Promise<AIResponse> {
    return callAiApi({
      type: 'hint',
      content: explanation,
      context: { previousContext: `Requested hint level: ${level}` },
    });
  }

  extractQuestions(fileUrl: string, fileType: 'image' | 'pdf'): Promise<AIResponse> {
    return callAiApi({
      type: 'extract_questions',
      content: '',
      attachments: [{ type: fileType, url: fileUrl }],
    });
  }

  generateQuestions(params: { subject: 'math' | 'reading' | 'writing'; difficulty: 'easy' | 'medium' | 'hard'; count: number; topic?: string }): Promise<AIResponse> {
    return callAiApi({
      type: 'generate_question',
      content: `Generate ${params.count} ${params.subject} question(s) at ${params.difficulty} difficulty${params.topic ? ` focused on ${params.topic}` : ''}.`,
      context: { subject: params.subject, topic: params.topic },
    });
  }
}
