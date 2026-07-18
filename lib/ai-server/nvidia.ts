import { safeParseJson } from './shared';

const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nvidia-nemotron-nano-9b-v2';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export function isNvidiaConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}

/**
 * NVIDIA NIM is wired here ONLY for internal admin/creator tooling
 * (application review, video-metadata suggestions, tutor-response drafting
 * help) — never for the student-facing Milo chat. Two reasons:
 *
 * 1. It keeps a clean separation from the real provider chain in
 *    app/api/ai/route.ts, so a slow/unavailable NVIDIA endpoint never
 *    touches student-facing latency.
 * 2. NVIDIA's own free-tier terms scope usage to "development, testing,
 *    research or evaluation" — not production traffic serving real end
 *    users. Routing it to admin/creator-only tools instead of students
 *    narrows that exposure, but it doesn't eliminate it: staff using this
 *    inside a live, running app is still production usage in the ordinary
 *    sense. That's a business/ToS judgment call for you to make, not a
 *    technical one — worth a real read of NVIDIA's terms before this sees
 *    real traffic, and worth planning a swap to a paid tier if it sticks.
 */
export async function callNvidiaJSON(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200
): Promise<any> {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY not configured');
  }

  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[nvidia] API error', res.status, errText);
    throw new Error(`NVIDIA NIM error ${res.status}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('NVIDIA NIM returned no content');

  return safeParseJson(text);
}
