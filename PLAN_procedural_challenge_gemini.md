# Cognify — Implementation Plan
## Procedural Infinite Mode · Live-Adaptive Challenge Mode · Gemini/Groq Swap for Milo

---

## 0. The one idea that ties all three together

Every reliability problem described (missing passages, broken charts, questions not loading) traces back to one root cause: **nothing validated AI-generated content before showing it to a student.** The fix isn't a smarter model — it's a validation gate between "AI generated something" and "a student sees it." That gate is the backbone of Part 1, and it's why Part 3 (which provider) is almost a footnote by comparison: whichever provider generates a question, it goes through the same gate.

---

## Part 1 — Validated Procedural Generator (Infinite Mode)

### 1.1 Scope decision (this is the actual fix)

AI-generated questions are **restricted to formats where text generation is reliable**:

| Format | AI-generated? | Why |
|---|---|---|
| Algebra / word-problem math | ✅ Yes | Fully expressible in text |
| Grammar / writing questions | ✅ Yes | Fully expressible in text |
| Reading passage + question | ✅ Yes | Fully expressible in text |
| Graph / chart / table questions | ❌ No — Question Bank only | LLMs can't reliably produce accurate charts |
| Diagram-based geometry | ❌ No — Question Bank only | Same reason |

This isn't a limitation to work around later — it's the permanent design. Chart/diagram questions stay human-authored and curated, forever. That scoping *is* what makes the AI-generated half trustworthy.

### 1.2 The validation gate

Every AI-generated question must pass ALL of these checks before a student ever sees it:

1. Required fields present and non-empty: `question_text`, `choices` (exactly 4 options for multiple choice), `correct_answer`, `explanation`
2. `correct_answer` must exactly match one of the 4 choices (catches a real, common LLM failure mode)
3. If `format = passage_based`: `passage` field must be non-empty and above a minimum length (e.g. 100+ characters) — this is the direct fix for "questions with passages didn't come with the passage"
4. `format` must be one of the three allowed text-reliable types — anything else is auto-rejected, never shown
5. Basic content-safety check (reuse the existing safety patterns already in the app)

**On failure:** retry once with a corrective prompt ("your last response was missing the passage — regenerate with a complete passage included"). If it fails twice, discard silently and serve a real question from the Question Bank instead. **A student should never see an error where a question should be — they should see a slightly different (but complete) question instead.**

### 1.3 Architecture

```
Student in Infinite Mode
        │
        ▼
Client keeps a buffer of 3 upcoming questions ready at all times
        │ (buffer running low → request more)
        ▼
POST /api/practice/generate-questions   (new server route)
        │
        ▼
Try Gemini → validate → pass? serve : retry once → still fail? pull from Question Bank
        │
        ▼
Good, validated questions are cached in a new `procedural_questions` table
        │
        ├─→ Reused for other students (saves API calls / cost)
        └─→ Available for an admin/creator to promote into the permanent Question Bank
```

The client-side buffer (always keep 3 questions ready ahead of the current one) is what directly fixes "questions weren't loading" — the student is never staring at a spinner waiting for generation; the next question is already there before they finish the current one.

### 1.4 What this needs

- **AI/API:** Gemini (primary), Groq (fallback) — same two providers as Part 3, reused, not a separate integration
- **New route:** `app/api/practice/generate-questions/route.ts`
- **New AI request type:** `'generate_question'` added to the existing `lib/ai/types.ts`
- **New table:** `procedural_questions` (cached validated generations + which provider made them + times served)
- **Modified:** `lib/practice/engine.ts`'s `infinite_practice` handling — blend curated bank questions with generated ones instead of only reshuffling the bank

---

## Part 2 — Live-Adaptive Challenge Mode

### 2.1 What makes this different from the "adaptive practice" already built

Earlier this session, adaptive difficulty was built at the **session-creation level** — the question mix is weighted by historical accuracy before the session starts, then locked in (so students can resume/backtrack, which the app needs elsewhere). Challenge Mode is different on purpose: it adapts **question-to-question, live, within the current session** — which means it can't share that fixed-list design. It's architected as its own flow, closer to a streak game than a worksheet.

### 2.2 The adaptation logic (pure application logic — no AI call needed)

After each answered question, before fetching the next one:

- **2 correct in a row** → escalate difficulty one tier (easy→medium→hard)
- **2 incorrect in a row** → de-escalate one tier, AND re-serve a question from the *same domain/skill* just missed, at a slightly easier difficulty (reinforcement, not just "make it easier")
- **A domain hits 2+ misses this session** → bias the next several questions toward that domain regardless of overall streak, until the student shows improvement there
- Next question is always pulled from the **curated Question Bank** (not procedural generation) — keeps this mode's reliability independent from Part 1 while it's new; blending in procedural text-only questions later is a safe future addition once Part 1 is proven stable

### 2.3 Architecture

```
Student answers a question
        │
        ▼
Record correct/incorrect + domain/skill/difficulty tags
(session_question_states — already exists)
        │
        ▼
Compute rolling state: streak, per-domain miss count (client-side or a small helper —
this is simple enough it doesn't need a dedicated server route)
        │
        ▼
Fetch next question from question_bank matching the computed
target difficulty + domain bias
        │
        ▼
Repeat until time/question limit → show session summary
(optional: Milo/Gemini writes a one-paragraph natural-language summary — nice-to-have, not required)
```

### 2.4 What this needs

- **AI/API:** None required for the core mechanic. Optionally Gemini for an end-of-session natural-language summary — genuinely optional, the mode fully works without it.
- **New mode:** `'challenge_mode'` added to the `ModeKey` union
- **Reuses:** `session_question_states`, `question_bank` — no major new tables required

---

## Part 3 — Gemini/Groq Swap for Milo

### 3.1 What changes

- `GeminiProvider` becomes the **default** active provider (replacing `ClaudeProvider` as default)
- `GroqProvider` is the **automatic fallback** when Gemini fails or hits its daily quota
- `ClaudeProvider` **stays in the codebase**, just not selected by default — available later if there's ever a paid tier where quality-over-cost makes sense

### 3.2 Architecture

```
Milo request comes in
        │
        ▼
Has an image attachment? ──Yes──→ Gemini only (Groq's vision support is inconsistent/limited)
        │No                              │
        ▼                                ▼
   Try Gemini                    Gemini fails/quota hit?
        │                                │
        ▼                          Yes ──┴── No → done
   Fails/quota hit?                      │
        │                                ▼
   Yes → Try Groq                "I can't read images right now,
        │                        but I can help if you describe
   Both fail →                   the question" (honest degraded
   existing graceful              state, not a broken one)
   error message
```

This slots into the exact same `/api/ai/route.ts` and `AIRequest`/`AIResponse` contract already built — nothing else in the app (question submission, Milo chat widget) needs to change, since everything already talks to the abstraction, not a specific provider.

### 3.3 What this needs

- **New files:** `lib/ai/gemini-provider.ts`, `lib/ai/groq-provider.ts` (server-side callers, same pattern as the existing Anthropic call logic)
- **Modified:** `app/api/ai/route.ts` — try Gemini → Groq → graceful error, instead of Anthropic-only
- **Modified:** `.env.example` — add `GEMINI_API_KEY`, `GROQ_API_KEY`

---

## The external accounts you actually need (only two)

| Service | Used for | Where to sign up | Cost |
|---|---|---|---|
| **Google AI Studio (Gemini)** | Milo (primary) + procedural question generation | [aistudio.google.com](https://aistudio.google.com) → "Get API key" | Free tier, no card, rate-limited |
| **Groq Console** | Milo (fallback) | [console.groq.com](https://console.groq.com) → API Keys | Free tier, no card |

That's the complete list for all three parts. Nothing else from the earlier research (vector databases, web search APIs, OCR.space, Cohere, etc.) is needed for any of this — each of those solves a problem Cognify doesn't actually have right now.

---

## Recommended build order

1. **Gemini/Groq swap for Milo** — foundational; the provider classes built here get reused directly by Part 1
2. **Validated procedural generator** — reuses the plumbing from step 1
3. **Live-adaptive Challenge Mode** — independent of the AI work, could genuinely be built first or in parallel if you'd rather see it sooner, since it needs zero API calls

---

## What I need from you before starting

Just the two API keys once you've created them (Google AI Studio + Groq Console) — everything else in this plan I can build without further input.
