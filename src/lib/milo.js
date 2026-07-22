const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


const STYLE = {
  "Quick Hint": "Give a single short nudge that points the student in the right direction WITHOUT revealing the final answer.",
  "Full Explanation": "Give a clear, numbered step-by-step walkthrough that arrives at the correct answer.",
  "Simplified Explanation": "Explain from scratch at a beginner level, defining any terms, using plain language.",
  "SAT Strategy Tip": "Focus on the test-taking strategy (elimination, plugging in, pacing) rather than the raw computation.",
};

export async function askMilo({ text, image_url, subject, responseType }) {
  const style = STYLE[responseType] || STYLE["Full Explanation"];
  const hasImage = !!image_url;

  // Build prompt — when an image is attached, instruct AI to read it
  const prompt = `You are Milo, Cognify's friendly SAT tutor. A student is stuck on a ${subject} SAT question.
${hasImage ? "The student has attached an image of their question — read and analyze it carefully." : `Question: """${text || ""}"""`}
${text && hasImage ? `Additional context from the student: "${text}"` : ""}

Task: ${style}
Also classify a likely topic (e.g. "Linear Equations") and rate your confidence (high/medium/low).
If confidence is low, gently suggest escalating to a human tutor.
Keep it concise, warm, and encouraging.
IMPORTANT FORMATTING RULES — follow these strictly:
- Write math in plain readable format: x^2, x/y, sqrt(x), x_1, (x + y)/2
- Do NOT use LaTeX: no \\frac, no \\sqrt, no dollar signs ($), no \\[ \\], no \\( \\)
- Do NOT use random backslashes or curly braces
- For fractions write: numerator/denominator (e.g. 1/2, (x+1)/(x-1))
- For exponents write: x^2, y^3
- For subscripts write: x_1, y_0
- Bold important terms using **word** only — no other markdown symbols
- Use numbered lists for steps (1. 2. 3.) and bullet points (- item) for concepts
- No horizontal rules, no HTML, no code blocks`;

  // Try backend function first (uses GEMINI_API_KEY → GROQ_API_KEY → OPENROUTER_API_KEY)
  try {
    const resp = await db.functions.invoke("milo-ai", { text, image_url, subject, responseType });
    if (resp.data?.answer) return resp.data;
    throw new Error("empty response");
  } catch {
    // Fallback: built-in InvokeLLM (Gemini Flash — supports image understanding)
    const result = await db.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
      file_urls: image_url ? [image_url] : undefined,
      response_json_schema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          topic: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["answer", "confidence"],
      },
    });
    return {
      answer: result.answer || "No explanation generated.",
      topic: result.topic || "General",
      confidence: result.confidence || "medium",
    };
  }
}

/**
 * Conversational Milo — multi-turn chat with the mascot.
 * Passes recent message history so Milo remembers context within the session.
 */
export async function chatWithMilo({ messages, subject }) {
  const subj = subject || "Math";
  const recent = (messages || [])
    .filter((m) => m.text)
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Student" : "Milo"}: ${m.text}`)
    .join("\n");

  const prompt = `You are Milo, Cognify's friendly SAT tutor, chatting conversationally with a student about ${subj}.
This is a live chat — be warm, concise, and conversational (not a formal essay). Ask a short follow-up when it helps them learn, but don't drag things out.

Conversation so far:
${recent}

Milo:`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        topic: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["answer"],
    },
  });
  return {
    answer: result.answer || "Hmm, I lost my train of thought — try again?",
    topic: result.topic || "General",
    confidence: result.confidence || "medium",
  };
}