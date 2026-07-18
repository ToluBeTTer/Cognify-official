#!/usr/bin/env node
/**
 * Standalone key checker — run this on your own machine (not in any
 * sandbox), after you've rotated your keys, to confirm each one actually
 * works before relying on it in Cognify.
 *
 * Usage:
 *   GEMINI_API_KEY=your-new-key GROQ_API_KEY=your-new-key node check-ai-keys.js
 *
 * Requires Node 18+ (built-in fetch). No dependencies to install.
 */

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('⏭  GEMINI_API_KEY not set, skipping.');
    return;
  }
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      console.log(`❌ Gemini: HTTP ${res.status} — ${json?.error?.message || JSON.stringify(json)}`);
      return;
    }
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
    console.log(`✅ Gemini responded: "${text?.trim()}"`);
  } catch (err) {
    console.log(`❌ Gemini: request failed — ${err.message}`);
  }
}

async function checkGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.log('⏭  GROQ_API_KEY not set, skipping.');
    return;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_completion_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.log(`❌ Groq: HTTP ${res.status} — ${json?.error?.message || JSON.stringify(json)}`);
      return;
    }
    console.log(`✅ Groq responded: "${json?.choices?.[0]?.message?.content?.trim()}"`);
  } catch (err) {
    console.log(`❌ Groq: request failed — ${err.message}`);
  }
}

/**
 * NVIDIA NIM — dev-only exploration, NOT part of the app's runtime provider
 * chain. NVIDIA's own terms scope the free tier to "development, testing,
 * research or evaluation," not production traffic serving real end users —
 * so this is here for you to experiment/compare models yourself, not
 * something Milo calls live. Set NVIDIA_API_KEY only if you want to poke at
 * it locally.
 */
async function checkNvidia() {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    console.log('⏭  NVIDIA_API_KEY not set, skipping (this one is dev-only exploration anyway).');
    return;
  }
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'nvidia/nvidia-nemotron-nano-9b-v2',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.log(`❌ NVIDIA NIM: HTTP ${res.status} — ${json?.error?.message || JSON.stringify(json)}`);
      return;
    }
    console.log(`✅ NVIDIA NIM responded: "${json?.choices?.[0]?.message?.content?.trim()}" (dev-only — not used by the live app)`);
  } catch (err) {
    console.log(`❌ NVIDIA NIM: request failed — ${err.message}`);
  }
}

(async () => {
  console.log('Checking AI provider keys...\n');
  await checkGemini();
  await checkGroq();
  console.log('\nDone. Fix any ❌ above before relying on that provider in the app.');
})();
