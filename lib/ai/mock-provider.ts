/**
 * Mock AI Provider
 *
 * Provides realistic mock responses for development and testing.
 * Replace with actual provider implementations in production.
 */

import type { AIProviderInterface, AIRequest, AIResponse, AIConfig, AIAttachment } from './types';

const MOCK_DELAY_MS = 1500;

const mockExplanations: Record<string, string> = {
  algebra: `This is a linear equation problem. Let me walk you through the solution step by step.

**Step 1: Identify the goal**
We need to solve for x in the equation. First, let's identify what we're solving for.

**Step 2: Isolate the variable**
Move all terms containing x to one side and constants to the other.

**Step 3: Simplify**
Combine like terms and divide both sides by the coefficient of x.

**Step 4: Verify**
Plug your answer back into the original equation to confirm it works.

*Key concept: Linear equations have exactly one solution (unless they're parallel lines or the same line).*`,

  geometry: `This problem involves geometric reasoning. Here's how to approach it:

**Step 1: Identify what's given**
Look at the information provided in the diagram and problem statement.

**Step 2: Apply relevant theorems**
Based on the given information, which geometric theorems or formulas apply?

**Step 3: Set up the equation**
Translate the geometric relationship into an algebraic equation.

**Step 4: Solve and check**
Solve your equation and verify the answer makes geometric sense.

*Remember: Always check if your answer is reasonable in the context of geometry (no negative lengths, angles between 0-180, etc.)*`,

  'reading-writing': `This question tests your reading comprehension skills.

**Step 1: Read strategically**
First, identify what type of passage this is and what the question is asking.

**Step 2: Locate evidence**
Find the specific lines in the passage that relate to the question.

**Step 3: Eliminate wrong answers**
Use process of elimination to narrow down your choices.

**Step 4: Select the best answer**
Choose the answer that's most directly supported by the text.

*Key strategy: The correct answer is always supported by explicit evidence in the passage.*`,
};

export class MockAIProvider implements AIProviderInterface {
  async generateResponse(request: AIRequest, _config?: AIConfig): Promise<AIResponse> {
    await this.simulateDelay();

    const subject = request.context?.subject || 'algebra';
    const explanation = mockExplanations[subject] || mockExplanations.algebra;

    return {
      success: true,
      data: {
        explanation,
        hints: [
          'Start by identifying what you know and what you need to find.',
          'Think about which formula or theorem applies here.',
          'Draw a diagram if it helps visualize the problem.',
        ],
        followUpQuestions: [
          { question: 'What would happen if we changed the coefficient of x?' },
          { question: 'Can you solve a similar problem with different numbers?' },
        ],
        relatedConcepts: ['linear equations', 'variables', 'isolating terms'],
        classification: {
          subject: subject,
          domain: request.context?.domain || 'algebra',
          topic: request.context?.topic || 'linear-equations',
          confidence: 0.92,
        },
      },
      metadata: {
        provider: 'mock',
        model: 'mock-v1',
        tokensUsed: 450,
        processingTimeMs: MOCK_DELAY_MS,
      },
    };
  }

  async classifyQuestion(content: string, _attachments?: AIAttachment[]): Promise<AIResponse> {
    await this.simulateDelay(500);

    // Simple keyword-based classification for mock
    const contentLower = content.toLowerCase();
    let subject = 'math';
    let domain = 'algebra';
    let topic = 'linear-equations';

    if (contentLower.includes('angle') || contentLower.includes('triangle') || contentLower.includes('circle')) {
      domain = 'geometry-trigonometry';
      topic = 'angles';
    } else if (contentLower.includes('passage') || contentLower.includes('author') || contentLower.includes('paragraph')) {
      subject = 'reading-writing';
      domain = 'information-ideas';
      topic = 'main-idea';
    } else if (contentLower.includes('grammar') || contentLower.includes('sentence')) {
      subject = 'reading-writing';
      domain = 'english-conventions';
      topic = 'grammar';
    }

    return {
      success: true,
      data: {
        classification: {
          subject,
          domain,
          topic,
          confidence: 0.85,
        },
      },
      metadata: {
        provider: 'mock',
        model: 'mock-v1',
        tokensUsed: 50,
        processingTimeMs: 500,
      },
    };
  }

  async performOCR(_imageUrl: string): Promise<AIResponse> {
    await this.simulateDelay(800);

    return {
      success: true,
      data: {
        ocrText: 'If 3x + 7 = 22, what is the value of x?',
        ocrConfidence: 0.94,
      },
      metadata: {
        provider: 'mock',
        model: 'mock-ocr-v1',
        tokensUsed: 25,
        processingTimeMs: 800,
      },
    };
  }

  async generateHints(_explanation: string, _level: number): Promise<AIResponse> {
    await this.simulateDelay(300);

    return {
      success: true,
      data: {
        hints: [
          'Start by isolating the variable term.',
          'Remember: whatever you do to one side, do to the other.',
          'Check your answer by substituting back into the original equation.',
        ],
      },
      metadata: {
        provider: 'mock',
        model: 'mock-v1',
        tokensUsed: 75,
        processingTimeMs: 300,
      },
    };
  }

  private simulateDelay(ms: number = MOCK_DELAY_MS): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 500));
  }

  async extractQuestions(_fileUrl: string, _fileType: 'image' | 'pdf'): Promise<AIResponse> {
    await this.simulateDelay();
    return {
      success: true,
      data: {
        extractedQuestions: [
          {
            question_text: '[Mock extraction] If 3x + 5 = 20, what is the value of x?',
            question_format: 'multiple_choice',
            choices: { a: '3', b: '5', c: '10', d: '15' },
            correct_answer: 'b',
            explanation: 'Subtract 5 from both sides to get 3x = 15, then divide by 3.',
            hint: 'Isolate x by undoing addition first, then multiplication.',
            section: 'math',
            difficulty: 'easy',
            section_confidence: 0.5,
            difficulty_confidence: 0.5,
          },
        ],
      },
      metadata: { provider: 'mock', model: 'mock-v1', tokensUsed: 50, processingTimeMs: 300 },
    };
  }

  async generateQuestions(params: { subject: 'math' | 'reading' | 'writing'; difficulty: 'easy' | 'medium' | 'hard'; count: number; topic?: string }): Promise<AIResponse> {
    await this.simulateDelay();
    const mockQuestion = {
      question_text:
        params.subject === 'math'
          ? '[Mock] If 2x - 4 = 10, what is the value of x?'
          : params.subject === 'reading'
          ? '[Mock] Based on the passage, what is the main idea?'
          : '[Mock] Which choice fixes the grammatical error?',
      passage: params.subject === 'reading' ? 'This is a mock reading passage used only when NEXT_PUBLIC_AI_PROVIDER=mock.' : null,
      choices: { a: '5', b: '7', c: '9', d: '11' },
      correct_answer: 'b' as const,
      explanation: 'Mock explanation for offline development.',
      hint: 'Mock hint.',
      topic: params.topic || 'General',
      section: params.subject,
      difficulty: params.difficulty,
    };
    return {
      success: true,
      data: { generatedQuestions: Array.from({ length: params.count }, () => mockQuestion) },
      metadata: { provider: 'mock', model: 'mock-v1', tokensUsed: 50, processingTimeMs: 300 },
    };
  }
}
