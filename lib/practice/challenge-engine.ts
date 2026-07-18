import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChallengeState } from './types';

const DIFFICULTY_TIERS: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

function adjacentDifficulties(target: 'easy' | 'medium' | 'hard'): Array<'easy' | 'medium' | 'hard'> {
  const idx = DIFFICULTY_TIERS.indexOf(target);
  return DIFFICULTY_TIERS.filter((_, i) => Math.abs(i - idx) === 1);
}

export function initialChallengeState(): ChallengeState {
  return { streak: 0, difficulty: 'medium', domainMisses: {}, servedQuestionIds: [] };
}

/**
 * Computes the next difficulty/streak after an answer, and the domain-miss
 * map used to bias toward weak areas. Pure function — no I/O — so it's easy
 * to reason about and test.
 *
 * Ported from the Base44 reference's pickNext()/streak logic, kept
 * server-side only per the sounder pattern in the Emergent reference
 * (computed and returned by the backend, never trusted from the client —
 * otherwise a student's browser could fake their own streak).
 */
export function advanceChallengeState(
  prev: ChallengeState,
  wasCorrect: boolean,
  answeredDomainId: string | null,
  answeredQuestionId: string
): ChallengeState {
  const nextStreak = wasCorrect ? Math.max(1, prev.streak + 1) : Math.min(-1, prev.streak - 1);

  let nextDifficulty = prev.difficulty;
  let streakAfterAdjustment = nextStreak;

  if (nextStreak >= 2) {
    const idx = DIFFICULTY_TIERS.indexOf(prev.difficulty);
    nextDifficulty = DIFFICULTY_TIERS[Math.min(idx + 1, DIFFICULTY_TIERS.length - 1)];
    streakAfterAdjustment = 0;
  } else if (nextStreak <= -2) {
    const idx = DIFFICULTY_TIERS.indexOf(prev.difficulty);
    nextDifficulty = DIFFICULTY_TIERS[Math.max(idx - 1, 0)];
    streakAfterAdjustment = 0;
  }

  const domainMisses = { ...prev.domainMisses };
  if (!wasCorrect && answeredDomainId) {
    domainMisses[answeredDomainId] = (domainMisses[answeredDomainId] || 0) + 1;
  } else if (wasCorrect && answeredDomainId && domainMisses[answeredDomainId]) {
    // A correct answer in a previously-weak domain eases the targeting —
    // don't keep hammering a domain forever once it's improving.
    domainMisses[answeredDomainId] = Math.max(0, domainMisses[answeredDomainId] - 1);
  }

  return {
    streak: streakAfterAdjustment,
    difficulty: nextDifficulty,
    domainMisses,
    servedQuestionIds: [...prev.servedQuestionIds, answeredQuestionId],
  };
}

interface PickableQuestion {
  id: string;
  domain_id: string | null;
  difficulty: string;
}

/**
 * Priority order (ported from the Base44 reference's pickNext()):
 *   1. A weak domain (2+ misses) at the target difficulty
 *   2. Any question at the target difficulty
 *   3. Adjacent difficulty tiers
 *   4. Any unused question at all
 *   5. Last resort: allow repeats if the filtered bank is truly exhausted
 */
export async function pickNextChallengeQuestion(
  supabase: SupabaseClient,
  state: ChallengeState,
  section: string | null
): Promise<PickableQuestion | null> {
  const weakDomains = Object.entries(state.domainMisses)
    .filter(([, misses]) => misses >= 2)
    .map(([domainId]) => domainId);

  const baseQuery = () => {
    let q = supabase
      .from('question_bank')
      .select('id, domain_id, difficulty')
      .eq('status', 'published')
      .eq('is_valid', true)
      .not('id', 'in', `(${state.servedQuestionIds.length ? state.servedQuestionIds.join(',') : 'null'})`);
    if (section) q = q.eq('section', section);
    return q;
  };

  // 1. Weak domain at target difficulty
  if (weakDomains.length > 0) {
    const { data } = await baseQuery().eq('difficulty', state.difficulty).in('domain_id', weakDomains).limit(10);
    if (data && data.length > 0) return data[Math.floor(Math.random() * data.length)] as PickableQuestion;
  }

  // 2. Target difficulty, any domain
  {
    const { data } = await baseQuery().eq('difficulty', state.difficulty).limit(10);
    if (data && data.length > 0) return data[Math.floor(Math.random() * data.length)] as PickableQuestion;
  }

  // 3. Adjacent difficulties
  {
    const { data } = await baseQuery().in('difficulty', adjacentDifficulties(state.difficulty)).limit(10);
    if (data && data.length > 0) return data[Math.floor(Math.random() * data.length)] as PickableQuestion;
  }

  // 4. Any unused question at all
  {
    const { data } = await baseQuery().limit(10);
    if (data && data.length > 0) return data[Math.floor(Math.random() * data.length)] as PickableQuestion;
  }

  // 5. Last resort — filtered bank truly exhausted, allow a repeat rather
  // than ending the session abruptly.
  {
    let q = supabase.from('question_bank').select('id, domain_id, difficulty').eq('status', 'published').eq('is_valid', true);
    if (section) q = q.eq('section', section);
    const { data } = await q.limit(10);
    if (data && data.length > 0) return data[Math.floor(Math.random() * data.length)] as PickableQuestion;
  }

  return null;
}
