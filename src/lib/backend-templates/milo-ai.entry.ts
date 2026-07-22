const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * BACKEND FUNCTION TEMPLATE — Copy to base44/functions/milo-ai/entry.ts when you upgrade to Builder+
 *
 * This function provides Milo AI explanations with a multi-provider fallback chain:
 *   1. Gemini (primary)    — GEMINI_API_KEY
 *   2. Groq (fallback 1)    — GROQ_API_KEY
 *   3. OpenRouter (fallback 2) — OPENROUTER_API_KEY
 *
 * Deploy with: npx base44 functions deploy
 *
 * The frontend (src/lib/milo.js) already calls this function first and falls back
 * to the built-in InvokeLLM if it's not deployed yet.
 */
import { createClientFromRequest } from "npm:@base44/sdk";

const STYLE: Record<string, string> = {
  "Quick Hint": "Give a single short nudge that points the student in the right direction WITHOUT revealing the final answer.",
  "Full Explanation": "Give a clear, numbered step-by-step walkthrough that arrives at the correct answer.",
  "Simplified Explanation": "Explain from scratch at a beginner level, defining any terms, using plain language.",
  "SAT Strategy Tip": "Focus on the test-taking strategy (elimination, plugging in, pacing) rather than the raw computation.",
};

// ─── Provider: Gemini ───
async function callGemini(apiKey: string, prompt: string, schemaDescription: string) {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nReturn JSON with this structure:\n${schemaDescription}` }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
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
        { role: "system", content: `You are a helpful SAT tutor. Respond ONLY with valid JSON. ${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
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
        { role: "system", content: `You are a helpful SAT tutor. Respond ONLY with valid JSON. ${schemaDescription}` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
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
      console.error(`[milo-ai] ${p.name} failed:`, err.message);
    }
  }
  throw new Error("All AI providers failed or no API keys configured");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { text, image_url, subject, responseType } = await req.json();

    const prompt = `You are Milo, Cognify's friendly SAT tutor. A student is stuck on a ${subject} SAT question.
Question: """${text || "(see attached image)"}"""
Task: ${STYLE[responseType] || STYLE["Full Explanation"]}
Also classify a likely topic and rate your confidence (high/medium/low). If confidence is low, gently suggest escalating to a human tutor.
Keep it concise, warm, and encouraging. Use markdown for the answer.`;

    const schemaDescription = `{ "answer": string (markdown), "topic": string, "confidence": "high" | "medium" | "low" }`;

    const { result, provider } = await callWithFallback(prompt, schemaDescription);

    return Response.json({
      answer: result.answer,
      topic: result.topic || "General",
      confidence: result.confidence || "medium",
      provider,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});