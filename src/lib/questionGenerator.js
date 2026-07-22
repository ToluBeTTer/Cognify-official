const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


function validateQuestion(q) {
  if (!q.prompt || q.prompt.trim().length < 10) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.options.some((o) => !o || o.trim().length === 0)) return false;
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 3) return false;
  if (!q.explanation || q.explanation.trim().length < 10) return false;
  if (!q.topic) return false;
  if (q.passage && q.passage.trim().length > 0 && q.passage.trim().length < 100) return false;
  return true;
}

export async function generateQuestions({ subject = "Math", difficulty = "Medium", count = 3, topic } = {}) {
  // Try the backend function first (uses your API keys with Gemini→Groq→OpenRouter fallback)
  try {
    const resp = await db.functions.invoke("generate-questions", { subject, difficulty, count, topic });
    const data = resp.data;
    if (data && Array.isArray(data.questions) && data.questions.length > 0) {
      return data.questions;
    }
    throw new Error("Backend returned no questions");
  } catch {
    // Fallback: built-in InvokeLLM with Gemini (works without Builder+)
    const prompt = `You are an expert SAT question writer for Cognify. Generate ${count} ${subject} SAT questions at ${difficulty} difficulty${topic ? ` focused on ${topic}` : ""}.

CRITICAL RULES:
1. Each question must have EXACTLY 4 multiple-choice options (A, B, C, D)
2. correct_index is the 0-based index of the correct answer (0=A, 1=B, 2=C, 3=D)
3. Every question must include a clear explanation of why the correct answer is right
4. Only use text-reliable formats: algebra, word problems, grammar, writing, or reading passages
5. Do NOT create chart/graph/table/diagram questions — those need visual elements
6. If creating a reading question, include a passage field with the full passage (at least 100 characters)
7. For math, keep all numbers clean and verify the answer is mathematically correct
8. Each question must have a topic field (e.g. "Linear Equations", "Subject-Verb Agreement", "Inferences")`;

    const result = await db.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                passage: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_index: { type: "number" },
                explanation: { type: "string" },
                topic: { type: "string" },
              },
              required: ["prompt", "options", "correct_index", "explanation", "topic"],
            },
          },
        },
        required: ["questions"],
      },
    });

    const valid = (result.questions || []).filter(validateQuestion);

    return valid.map((q) => ({
      ...q,
      subject,
      difficulty,
      question_type: q.passage && q.passage.trim().length > 0 ? "Passage-Based" : "Multiple Choice",
      _procedural: true,
    }));
  }
}

/**
 * Converts a student's submitted question (text + optional image) into a proper
 * SAT-style BankQuestion using AI image understanding.
 */
export async function generateQuestionFromStudent({ text, image_url, subject = "Math", topic } = {}) {
  const hasImage = !!image_url;
  const prompt = `You are an expert SAT question writer for Cognify. A student submitted a question they needed help with. Convert it into a proper SAT-style practice question that can be added to the official question bank.

STUDENT'S ORIGINAL QUESTION:
${hasImage ? "[An image is attached — analyze it carefully. It may contain a question, a passage, a graph, chart, diagram, or any visual context.]" : ""}
Text: "${text || ""}"
Subject: ${subject}
${topic ? `Topic hint: ${topic}` : ""}

Generate a single SAT question with these fields:
- prompt: The question text, written clearly in SAT style. If the student's image had a graph/chart/diagram, describe it in words within the prompt so the question is answerable without seeing the image.
- passage: If the question involves a reading passage, paragraph, poem, or any extended context, include it here (at least 100 characters). For graph/chart questions, put the data description here. Otherwise leave empty string.
- options: EXACTLY 4 multiple-choice options as an array of strings.
- correct_index: 0-based index of the correct answer (0=A, 1=B, 2=C, 3=D).
- explanation: Clear explanation of why the correct answer is right and others are wrong.
- topic: The specific topic (e.g. "Linear Equations", "Subject-Verb Agreement", "Inferences").
- difficulty: "Easy", "Medium", or "Hard".

CRITICAL RULES:
- Write math in plain readable format: x^2, 1/2, sqrt(x), x_1. Do NOT use LaTeX, dollar signs, backslashes, or curly braces.
- Make sure the correct answer is actually correct — verify it.
- The question must be fully answerable from the text alone (prompt + passage).
- If the student's question was too vague to convert, still produce your best attempt.`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    model: "gemini_3_flash",
    file_urls: hasImage ? [image_url] : undefined,
    response_json_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        passage: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        correct_index: { type: "number" },
        explanation: { type: "string" },
        topic: { type: "string" },
        difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
      },
      required: ["prompt", "options", "correct_index", "explanation", "topic"],
    },
  });

  const q = {
    prompt: result.prompt || text || "",
    passage: result.passage || "",
    options: Array.isArray(result.options) ? result.options.slice(0, 4) : [],
    correct_index: typeof result.correct_index === "number" ? result.correct_index : 0,
    explanation: result.explanation || "",
    subject,
    topic: result.topic || topic || "General",
    difficulty: result.difficulty || "Medium",
    question_type: result.passage && result.passage.trim().length > 0 ? "Passage-Based" : "Multiple Choice",
    source: "promoted",
    review_status: "published",
  };

  // Basic validation
  if (!q.prompt || q.prompt.trim().length < 5) throw new Error("AI could not generate a valid question prompt");
  if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error("AI did not produce exactly 4 options");
  if (q.options.some(o => !o || o.trim().length === 0)) throw new Error("Some options are empty");

  return q;
}