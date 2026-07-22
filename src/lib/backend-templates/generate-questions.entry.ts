const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * BACKEND FUNCTION TEMPLATE — Copy to base44/functions/generate-questions/entry.ts when you upgrade to Builder+
 *
 * This function generates validated SAT practice questions with a multi-provider fallback:
 *   1. Gemini (primary)    — GEMINI_API_KEY
 *   2. Groq (fallback 1)   — GROQ_API_KEY
 *   3. OpenRouter (fallback 2) — OPENROUTER_API_KEY
 *
 * Each generated question passes a 5-point validation gate before being returned
 * and cached to the ProceduralQuestion entity.
 *
 * Deploy with: npx base44 functions deploy
 *
 * The frontend (src/lib/questionGenerator.js) already calls this function first
 * and falls back to the built-in InvokeLLM if it's not deployed yet.
 */
import { createClientFromRequest } from "npm:@base44/sdk";

// ─── Provider: Gemini ───
async function callGemini(apiKey: string, prompt: string, schemaDescription: string) {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nReturn JSON with this structure:\n${schemaDescription}` }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

// ─── Provider: Groq (OpenAI-compatible) ───
async function callGroq(apiKey: string, prompt: string, schemaDescription: string) {
  const model = "llama-3.3-70b-versatile";
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are an expert SAT question writer. Respond ONLY with valid JSON. ${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

// ─── Provider: OpenRouter (OpenAI-compatible) ───
async function callOpenRouter(apiKey: string, prompt: string, schemaDescription: string) {
  const model = "google/gemini-2.0-flash-exp:free";
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are an expert SAT question writer. Respond ONLY with valid JSON. ${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

// ─── Fallback runner: Gemini → Groq → OpenRouter ───
async function callWithFallback(prompt: string, schemaDescription: string) {
  const providers = [
    { name: "gemini", key: Deno.env.get("GEMINI_API_KEY"), fn: callGemini },
    { name: "groq", key: Deno.env.get("GROQ_API_KEY"), fn: callGroq },
    { name: "openrouter", key: Deno.env.get("OPENROUTER_API_KEY"), fn: callOpenRouter },
  ];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const result = await p.fn(p.key, prompt, schemaDescription);
      return { result, provider: p.name };
    } catch (err) {
      console.error(`[generate-questions] ${p.name} failed:`, err.message);
    }
  }
  throw new Error("All AI providers failed or no API keys configured");
}

// ─── 5-point validation gate ───
function validateQuestion(q: any): boolean {
  if (!q.prompt || q.prompt.trim().length < 10) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.options.some((o: string) => !o || o.trim().length === 0)) return false;
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 3) return false;
  if (!q.explanation || q.explanation.trim().length < 10) return false;
  if (!q.topic) return false;
  if (q.passage && q.passage.trim().length > 0 && q.passage.trim().length < 100) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { subject = "Math", difficulty = "Medium", count = 3, topic } = await req.json();

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

    const schemaDescription = `{ "questions": [{ "prompt": string, "passage": string (optional), "options": [string, string, string, string], "correct_index": number (0-3), "explanation": string, "topic": string }] }`;

    const { result, provider } = await callWithFallback(prompt, schemaDescription);

    // Validate through the 5-point gate
    const valid = (result.questions || []).filter(validateQuestion);

    // Cache validated questions to the ProceduralQuestion entity
    if (valid.length > 0) {
      await db.asServiceRole.entities.ProceduralQuestion.bulkCreate(
        valid.map((q: any) => ({
          prompt: q.prompt,
          passage: q.passage || "",
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          subject,
          topic: q.topic,
          difficulty,
          question_type: q.passage && q.passage.trim().length > 0 ? "Passage-Based" : "Multiple Choice",
          provider,
        }))
      );
    }

    return Response.json({
      questions: valid.map((q: any) => ({
        ...q,
        subject,
        difficulty,
        question_type: q.passage && q.passage.trim().length > 0 ? "Passage-Based" : "Multiple Choice",
        _procedural: true,
        _provider: provider,
      })),
      provider,
      generated: valid.length,
      rejected: (result.questions || []).length - valid.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});