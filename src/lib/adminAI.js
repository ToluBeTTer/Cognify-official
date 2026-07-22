const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


const MATH_RULES = `Write math in plain readable format: x^2, 1/2, sqrt(x), x_1. Do NOT use LaTeX, dollar signs, backslashes, or curly braces.`;

/**
 * Analyzes a creator application + the applicant's student profile and recommends accept/reject.
 */
export async function analyzeCreatorApplication(app, studentProfile) {
  const { practiceAttempts = [], questions = [] } = studentProfile;
  const totalAttempts = practiceAttempts.length;
  const correctAttempts = practiceAttempts.filter(a => a.correct).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const topicsMissed = {};
  practiceAttempts.forEach(a => { if (!a.correct && a.topic) topicsMissed[a.topic] = (topicsMissed[a.topic] || 0) + 1; });
  const weakTopics = Object.entries(topicsMissed).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 5);
  const subjectsAsked = {};
  questions.forEach(q => { if (q.subject) subjectsAsked[q.subject] = (subjectsAsked[q.subject] || 0) + 1; });

  const prompt = `You are an AI admissions assistant for Cognify, an SAT study platform. Analyze this tutor application and the applicant's student profile, then recommend whether to approve or reject.

APPLICANT:
- Name: ${app.full_name}
- Email: ${app.email}
- Subjects they want to tutor: ${app.subjects}
- Experience: ${app.experience || "Not provided"}

STUDENT PROFILE (their activity as a student on the platform):
- Total practice questions answered: ${totalAttempts}
- Correct answers: ${correctAttempts}
- Accuracy: ${accuracy}%
- Topics they struggle with: ${weakTopics.join(", ") || "None yet"}
- Subjects they ask about most: ${Object.entries(subjectsAsked).map(([s, c]) => `${s} (${c})`).join(", ") || "None yet"}

Analyze:
1. Do their subject specialties align with where students struggle most on the platform?
2. Does their experience suggest they can explain concepts clearly?
3. Would a student who struggles with ${weakTopics[0] || "these subjects"} benefit from this tutor?
4. Any red flags?

Return your analysis as JSON.`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        recommendation: { type: "string", enum: ["approve", "reject", "review_manually"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        reasoning: { type: "string" },
        strengths: { type: "string" },
        concerns: { type: "string" },
        best_fit_subjects: { type: "string" },
      },
      required: ["recommendation", "reasoning"],
    },
  });
  return result;
}

/**
 * Suggests optimized title, description, and tags for a video based on its content metadata.
 */
export async function optimizeVideoMetadata(video) {
  const prompt = `You are an AI content optimizer for Cognify, an SAT study platform with a video library. Improve this video's metadata so it reaches students who need it most.

CURRENT METADATA:
- Title: ${video.title}
- Description: ${video.description || "None"}
- Tags: ${(video.tags || []).join(", ") || "None"}
- Subject: ${video.subject}
- Topic: ${video.topic || "Not specified"}
- Difficulty: ${video.difficulty}

Generate improved metadata:
1. title: Clear, searchable, under 80 characters. Include the key concept.
2. description: 2-3 sentences explaining what the student will learn. ${MATH_RULES}
3. tags: 5-8 relevant tags students might search for (subject, topic, question type, SAT skill, difficulty level)

Return as JSON.`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        reasoning: { type: "string" },
      },
      required: ["title", "description", "tags"],
    },
  });
  return result;
}

/**
 * Helps a tutor draft a response to a student based on the student's question and profile.
 */
export async function assistTutorResponse(question, studentProfile) {
  const { practiceAttempts = [] } = studentProfile || {};
  const topicsMissed = {};
  practiceAttempts.forEach(a => { if (!a.correct && a.topic) topicsMissed[a.topic] = (topicsMissed[a.topic] || 0) + 1; });
  const weakTopics = Object.entries(topicsMissed).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 5);

  const hasImage = !!question.image_url;
  const prompt = `You are an AI tutoring assistant for Cognify. Help a human tutor craft the best possible response to a student's question.

STUDENT'S QUESTION:
${hasImage ? "[Image attached — analyze it to understand the question]" : ""}
Text: "${question.text || ""}"
Subject: ${question.subject}
Topic: ${question.topic || "Not specified"}

STUDENT PROFILE:
- Weak topics: ${weakTopics.join(", ") || "Not enough data yet"}
- This student tends to struggle with: ${weakTopics[0] || "general concepts"}

Provide:
1. suggested_response: A clear, encouraging explanation the tutor can use or adapt. ${MATH_RULES} Use numbered steps for problem-solving.
2. approach: Brief note on the best teaching approach for this student given their weak areas.
3. key_points: 2-3 bullet points the tutor should emphasize.

Return as JSON.`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    model: "gemini_3_flash",
    file_urls: hasImage ? [question.image_url] : undefined,
    response_json_schema: {
      type: "object",
      properties: {
        suggested_response: { type: "string" },
        approach: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
      },
      required: ["suggested_response", "approach"],
    },
  });
  return result;
}