import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callNvidiaJSON, isNvidiaConfigured } from '@/lib/ai-server/nvidia';

export const runtime = 'nodejs';

const MATH_RULES =
  'Write math in plain readable text: x^2, 1/2, sqrt(x), x_1, (x + y)/2. ' +
  'Do NOT use LaTeX, dollar signs, backslashes, or curly-brace delimiters.';

function getSupabaseForAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

async function authenticateStaff(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = getSupabaseForAuth();
  if (!supabase) return null;

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'creator')) return null;

  return { user: userData.user, role: profile.role as 'admin' | 'creator' };
}

export async function POST(req: NextRequest) {
  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { success: false, error: 'NVIDIA_API_KEY not configured — these admin AI tools are optional and off until it is set.' },
      { status: 503 }
    );
  }

  const staff = await authenticateStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, error: 'Admin or creator access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 });
  }

  try {
    switch (body.action) {
      case 'analyze_application': {
        if (staff.role !== 'admin') {
          return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
        }
        const { application, studentProfile } = body;
        const result = await analyzeApplication(application, studentProfile);
        return NextResponse.json({ success: true, data: result });
      }
      case 'optimize_video_metadata': {
        const { video } = body;
        const result = await optimizeVideoMetadata(video);
        return NextResponse.json({ success: true, data: result });
      }
      case 'assist_tutor_response': {
        const { question, studentProfile } = body;
        const result = await assistTutorResponse(question, studentProfile);
        return NextResponse.json({ success: true, data: result });
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin-ai] error', err);
    return NextResponse.json({ success: false, error: err?.message || 'AI request failed' }, { status: 502 });
  }
}

async function analyzeApplication(application: any, studentProfile: any) {
  const attempts = studentProfile?.practiceAttempts ?? [];
  const questions = studentProfile?.questions ?? [];
  const total = attempts.length;
  const correct = attempts.filter((a: any) => a.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const topicsMissed: Record<string, number> = {};
  attempts.forEach((a: any) => {
    if (!a.correct && a.topic) topicsMissed[a.topic] = (topicsMissed[a.topic] || 0) + 1;
  });
  const weakTopics = Object.entries(topicsMissed)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 5);

  const subjectsAsked: Record<string, number> = {};
  questions.forEach((q: any) => {
    if (q.subject) subjectsAsked[q.subject] = (subjectsAsked[q.subject] || 0) + 1;
  });

  const prompt = `You are an AI admissions assistant for Cognify, an SAT study platform. Analyze this tutor application and the applicant's own student activity on the platform, then recommend whether to approve or reject.

APPLICANT:
- Name: ${application.full_name || application.name || 'Unknown'}
- Requested role/subjects: ${application.requested_role || application.subjects || 'Not specified'}
- Reason / experience given: ${application.reason || application.experience || 'Not provided'}

APPLICANT'S OWN STUDENT ACTIVITY ON THE PLATFORM:
- Total practice questions answered: ${total}
- Accuracy: ${accuracy}%
- Topics they personally struggle with: ${weakTopics.join(', ') || 'None yet'}
- Subjects they ask about most: ${Object.entries(subjectsAsked).map(([s, c]) => `${s} (${c})`).join(', ') || 'None yet'}

Analyze:
1. Does their stated experience/reason suggest they can explain concepts clearly?
2. Does the platform currently have unmet tutor demand in their subject area?
3. Any red flags in the application itself?

This is advisory only — a human admin makes the final call. Return your analysis as JSON.`;

  return callNvidiaJSON(
    'You are a careful, evidence-based hiring-assistant AI. You never fabricate details not present in the input. Respond with ONLY valid JSON.',
    prompt +
      '\n\nRespond with ONLY valid JSON: {"recommendation": "approve"|"reject"|"review_manually", "confidence": "high"|"medium"|"low", "reasoning": string, "strengths": string, "concerns": string}',
    900
  );
}

async function optimizeVideoMetadata(video: any) {
  const prompt = `You are an AI content optimizer for Cognify's video explanation library. Improve this video's metadata so it reaches the students who need it most.

CURRENT METADATA:
- Title: ${video.title || 'Untitled'}
- Description: ${video.description || 'None'}
- Tags: ${(video.tags || []).join(', ') || 'None'}
- Subject: ${video.subject || 'Not specified'}
- Topic: ${video.topic || 'Not specified'}
- Difficulty: ${video.difficulty || 'Not specified'}

Generate improved metadata:
1. title: clear, searchable, under 80 characters, includes the key concept
2. description: 2-3 sentences on what the student will learn. ${MATH_RULES}
3. tags: 5-8 relevant search tags (subject, topic, question type, SAT skill, difficulty)

Respond with ONLY valid JSON: {"title": string, "description": string, "tags": string[], "reasoning": string}`;

  return callNvidiaJSON(
    'You are a precise content-metadata assistant. Respond with ONLY valid JSON.',
    prompt,
    700
  );
}

async function assistTutorResponse(question: any, studentProfile: any) {
  const attempts = studentProfile?.practiceAttempts ?? [];
  const topicsMissed: Record<string, number> = {};
  attempts.forEach((a: any) => {
    if (!a.correct && a.topic) topicsMissed[a.topic] = (topicsMissed[a.topic] || 0) + 1;
  });
  const weakTopics = Object.entries(topicsMissed)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 5);

  const prompt = `You are an AI assistant helping a human tutor draft the best possible response to a student's question on Cognify.

STUDENT'S QUESTION:
${question.image_url ? "[An image was attached to the original question — not visible to you here; use the text below and the tutor's own reading of the image.]" : ''}
Text: "${question.text || question.content || ''}"
Subject: ${question.subject || 'Not specified'}
Topic: ${question.topic || 'Not specified'}

STUDENT PROFILE:
- Topics this student tends to struggle with: ${weakTopics.join(', ') || 'Not enough data yet'}

Provide:
1. suggested_response: a clear, encouraging draft the tutor can use or adapt as a starting point, not a final answer to paste blindly. ${MATH_RULES} Use numbered steps for problem-solving.
2. approach: one or two sentences on the best teaching angle for this student given their weak areas.
3. key_points: 2-3 bullet points the tutor should make sure to hit.

Respond with ONLY valid JSON: {"suggested_response": string, "approach": string, "key_points": string[]}`;

  return callNvidiaJSON(
    "You are a helpful SAT-tutoring co-pilot for human tutors. You draft starting points, not final answers — the tutor always reviews and edits before sending. Respond with ONLY valid JSON.",
    prompt,
    1000
  );
}
