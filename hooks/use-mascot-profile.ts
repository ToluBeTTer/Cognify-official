'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, supabase } from '@/lib/supabase';
import { DEFAULT_OWNED, DEFAULT_EQUIPPED, itemById, type ItemCategory } from '@/lib/mascot/catalog';

export interface MascotProfileData {
  credits: number;
  totalEarned: number;
  streakDays: number;
  ownedItems: string[];
  equippedItems: Record<ItemCategory, string>;
  stats: { throws: number; chats: number; wallHits: number; offscreen: number };
}

const DEFAULT_PROFILE: MascotProfileData = {
  credits: 150,
  totalEarned: 150,
  streakDays: 0,
  ownedItems: DEFAULT_OWNED,
  equippedItems: DEFAULT_EQUIPPED,
  stats: { throws: 0, chats: 0, wallHits: 0, offscreen: 0 },
};

export function useMascotProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MascotProfileData>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const dailyClaimedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let { data } = await supabase.from('mascot_profiles').select('*').eq('user_id', user.id).maybeSingle();

      if (!data) {
        const { data: created } = await supabase
          .from('mascot_profiles')
          .insert({ user_id: user.id })
          .select('*')
          .maybeSingle();
        data = created;
      }

      if (data) {
        setProfile({
          credits: data.credits,
          totalEarned: data.total_earned,
          streakDays: data.streak_days,
          ownedItems: data.owned_items ?? DEFAULT_OWNED,
          equippedItems: { ...DEFAULT_EQUIPPED, ...(data.equipped_items as any) },
          stats: { throws: 0, chats: 0, wallHits: 0, offscreen: 0, ...(data.stats as any) },
        });
      }

      if (!dailyClaimedRef.current) {
        dailyClaimedRef.current = true;
        const { data: daily } = await supabase.rpc('claim_mascot_daily', { p_user_id: user.id });
        const result = Array.isArray(daily) ? daily[0] : daily;
        if (result?.reward > 0) {
          setProfile((prev) => ({
            ...prev,
            credits: prev.credits + result.reward,
            totalEarned: prev.totalEarned + result.reward,
            streakDays: result.streak,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load mascot profile', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const equip = useCallback(
    async (category: ItemCategory, itemId: string) => {
      if (!user) return;
      setProfile((prev) => ({ ...prev, equippedItems: { ...prev.equippedItems, [category]: itemId } }));
      const next = { ...profile.equippedItems, [category]: itemId };
      await supabase.from('mascot_profiles').update({ equipped_items: next }).eq('user_id', user.id);
    },
    [user, profile.equippedItems]
  );

  const purchase = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!user) return false;
      const item = itemById(itemId);
      if (!item) return false;
      if (profile.ownedItems.includes(itemId)) return true;
      if (profile.credits < item.price) return false;

      const nextOwned = [...profile.ownedItems, itemId];
      const nextCredits = profile.credits - item.price;
      setProfile((prev) => ({ ...prev, ownedItems: nextOwned, credits: nextCredits }));

      const { error } = await supabase
        .from('mascot_profiles')
        .update({ owned_items: nextOwned, credits: nextCredits })
        .eq('user_id', user.id);
      if (error) {
        // roll back optimistic update on failure
        setProfile((prev) => ({ ...prev, ownedItems: profile.ownedItems, credits: profile.credits }));
        return false;
      }
      return true;
    },
    [user, profile.ownedItems, profile.credits]
  );

  const bumpStat = useCallback(
    async (stat: keyof MascotProfileData['stats']) => {
      if (!user) return;
      const nextStats = { ...profile.stats, [stat]: (profile.stats[stat] || 0) + 1 };
      setProfile((prev) => ({ ...prev, stats: nextStats }));
      await supabase
        .from('mascot_profiles')
        .update({ stats: nextStats })
        .eq('user_id', user.id);
    },
    [user, profile.stats]
  );

  const savePosition = useCallback(
    async (position: { x: number; y: number }) => {
      if (!user) return;
      await supabase
        .from('mascot_profiles')
        .update({ positions: { last: position } })
        .eq('user_id', user.id);
    },
    [user]
  );

  const awardCreditsForSession = useCallback(
    async (sessionId: string) => {
      if (!user) return 0;
      const { data } = await supabase.rpc('award_mascot_credits_for_session', {
        p_user_id: user.id,
        p_session_id: sessionId,
      });
      const reward = typeof data === 'number' ? data : 0;
      if (reward > 0) {
        setProfile((prev) => ({ ...prev, credits: prev.credits + reward, totalEarned: prev.totalEarned + reward }));
      }
      return reward;
    },
    [user]
  );

  return { profile, loading, equip, purchase, bumpStat, savePosition, awardCreditsForSession, reload: load };
}
