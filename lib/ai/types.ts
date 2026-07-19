/**
 * AI Provider Types
 *
 * Provider-agnostic AI architecture for easy switching between
 * OpenAI, Anthropic, Gemini, Grok, and local models.
 */

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'grok' | 'local' | 'mock';

export interface AIConfig {
  provider: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIRequest {
  type: 'explanation' | 'hint' | 'follow-up' | 'ocr' | 'classify' | 'extract_questions' | 'generate_question' | 'casual_chat';
  content: string;
  attachments?: AIAttachment[];
  context?: {
    subject?: string;
    domain?: string;
    topic?: string;
    previousContext?: string;
  };
}

export interface AIAttachment {
  type: 'image' | 'pdf' | 'screenshot';
  url: string;
  extractedText?: string;
}

export interface AIResponse {
  success: boolean;
  data?: {
    explanation?: string;
    hints?: string[];
    followUpQuestions?: Array<{
      question: string;
      options?: string[];
    }>;
    relatedConcepts?: string[];
    classification?: {
      subject: string;
      domain: string;
      topic: string;
      confidence: number;
    };
    ocrText?: string;
    ocrConfidence?: number;
    extractedQuestions?: Array<{
      question_text: string;
      passage?: string | null;
      question_format: 'multiple_choice' | 'numeric_entry' | 'passage_based' | 'graph_table' | 'image_based' | 'two_part' | 'multi_select';
      choices?: Record<string, string> | null;
      correct_answer?: string | null;
      explanation?: string | null;
      hint?: string | null;
      section?: 'math' | 'reading' | 'writing' | null;
      difficulty?: 'easy' | 'medium' | 'hard' | null;
      section_confidence?: number;
      difficulty_confidence?: number;
    }>;
    generatedQuestions?: Array<{
      question_text: string;
      passage: string | null;
      choices: { a: string; b: string; c: string; d: string };
      correct_answer: 'a' | 'b' | 'c' | 'd';
      explanation: string;
      hint: string;
      topic: string;
      section: 'math' | 'reading' | 'writing';
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
  };
  error?: string;
  metadata?: {
    provider: AIProvider;
    model: string;
    tokensUsed?: number;
    processingTimeMs: number;
  };
}

/**
 * AI Provider Interface
 * All providers must implement this interface
 */
export interface AIProviderInterface {
  generateResponse(request: AIRequest, config?: AIConfig): Promise<AIResponse>;
  classifyQuestion(content: string, attachments?: AIAttachment[]): Promise<AIResponse>;
  performOCR(imageUrl: string): Promise<AIResponse>;
  generateHints(explanation: string, level: number): Promise<AIResponse>;
  extractQuestions(fileUrl: string, fileType: 'image' | 'pdf'): Promise<AIResponse>;
  generateQuestions(params: { subject: 'math' | 'reading' | 'writing'; difficulty: 'easy' | 'medium' | 'hard'; count: number; topic?: string }): Promise<AIResponse>;
}
