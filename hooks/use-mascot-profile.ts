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
  savedPosition: { x: number; y: number; corner: string | null } | null;
  itemOffsets: Record<string, { dx: number; dy: number }>;
}

const DEFAULT_PROFILE: MascotProfileData = {
  credits: 150,
  totalEarned: 150,
  streakDays: 0,
  ownedItems: DEFAULT_OWNED,
  equippedItems: DEFAULT_EQUIPPED,
  stats: { throws: 0, chats: 0, wallHits: 0, offscreen: 0 },
  savedPosition: null,
  itemOffsets: {},
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
        const pos = data.positions as any;
        setProfile({
          credits: data.credits,
          totalEarned: data.total_earned,
          streakDays: data.streak_days,
          ownedItems: data.owned_items ?? DEFAULT_OWNED,
          equippedItems: { ...DEFAULT_EQUIPPED, ...(data.equipped_items as any) },
          stats: { throws: 0, chats: 0, wallHits: 0, offscreen: 0, ...(data.stats as any) },
          savedPosition: pos && typeof pos.x === 'number' ? { x: pos.x, y: pos.y, corner: pos.corner ?? null } : null,
          itemOffsets: (data.mascot_config as any) ?? {},
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
      const { error } = await supabase.rpc('equip_mascot_item', {
        p_user_id: user.id,
        p_category: category,
        p_item_id: itemId,
      });
      if (error) console.error('Failed to equip item', error);
    },
    [user]
  );

  const purchase = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!user) return false;
      const item = itemById(itemId);
      if (!item) return false;
      if (profile.ownedItems.includes(itemId)) return true;
      if (profile.credits < item.price) return false;

      const prevOwned = profile.ownedItems;
      const prevCredits = profile.credits;
      setProfile((prev) => ({
        ...prev,
        ownedItems: [...prev.ownedItems, itemId],
        credits: prev.credits - item.price,
      }));

      const { data, error } = await supabase.rpc('purchase_mascot_item', {
        p_user_id: user.id,
        p_item_id: itemId,
        p_price: item.price,
      });

      if (error || !data) {
        setProfile((prev) => ({ ...prev, ownedItems: prevOwned, credits: prevCredits }));
        return false;
      }

      setProfile((prev) => ({
        ...prev,
        ownedItems: (data as any).owned_items ?? prev.ownedItems,
        credits: (data as any).credits ?? prev.credits,
      }));
      return true;
    },
    [user, profile.ownedItems, profile.credits]
  );

  const bumpStat = useCallback(
    async (stat: keyof MascotProfileData['stats']) => {
      if (!user) return;
      setProfile((prev) => ({ ...prev, stats: { ...prev.stats, [stat]: (prev.stats[stat] || 0) + 1 } }));
      const { error } = await supabase.rpc('bump_mascot_stat', { p_user_id: user.id, p_stat: stat });
      if (error) console.error('Failed to bump stat', error);
    },
    [user]
  );

  const savePosition = useCallback(
    async (position: { x: number; y: number; corner?: string | null }) => {
      if (!user) return;
      setProfile((prev) => ({ ...prev, savedPosition: { x: position.x, y: position.y, corner: position.corner ?? null } }));
      const { error } = await supabase.rpc('save_mascot_position', {
        p_user_id: user.id,
        p_x: position.x,
        p_y: position.y,
        p_corner: position.corner ?? null,
      });
      if (error) console.error('Failed to save mascot position', error);
    },
    [user]
  );

  const saveItemOffset = useCallback(
    async (category: string, dx: number, dy: number) => {
      if (!user) return;
      setProfile((prev) => ({ ...prev, itemOffsets: { ...prev.itemOffsets, [category]: { dx, dy } } }));
      const { error } = await supabase.rpc('save_mascot_item_offset', {
        p_user_id: user.id,
        p_category: category,
        p_dx: dx,
        p_dy: dy,
      });
      if (error) console.error('Failed to save item offset', error);
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

  return { profile, loading, equip, purchase, bumpStat, savePosition, saveItemOffset, awardCreditsForSession, reload: load };
}
