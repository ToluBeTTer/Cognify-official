const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Loads (or creates) the current user's MascotProfile.
 * Exposes addCredits / saveConfig for gamification wiring.
 */
export function useMascotProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const creatingRef = useRef(false);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const existing = await db.entities.MascotProfile.filter({ created_by_id: uid }, "-created_date", 1);
      if (existing && existing.length > 0) {
        setProfile(existing[0]);
      } else if (!creatingRef.current) {
        creatingRef.current = true;
        const created = await db.entities.MascotProfile.create({
          credits: 100,
          total_earned: 100,
          streak_days: 1,
          last_login_date: new Date().toISOString().slice(0, 10),
          mascot_config: {},
          owned_items: [],
          equipped_items: [],
        });
        setProfile(created);
        creatingRef.current = false;
      }
    } catch {
      /* silent — profile loads next time */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) loadProfile(user.id);
    else if (user === null) {
      // explicitly not logged in
      setLoading(false);
    } else {
      // user still resolving — wait for db.auth.me in Layout
    }
  }, [user, loadProfile]);

  const addCredits = useCallback(
    async (amount, reason) => {
      if (!profile) return null;
      try {
        const updated = await db.entities.MascotProfile.update(profile.id, {
          credits: (profile.credits || 0) + amount,
          total_earned: (profile.total_earned || 0) + Math.max(0, amount),
        });
        setProfile(updated);
        return updated;
      } catch {
        return null;
      }
    },
    [profile]
  );

  const saveConfig = useCallback(
    async (configPatch) => {
      if (!profile) return null;
      try {
        const merged = { ...(profile.mascot_config || {}), ...configPatch };
        const updated = await db.entities.MascotProfile.update(profile.id, { mascot_config: merged });
        setProfile(updated);
        return updated;
      } catch {
        return null;
      }
    },
    [profile]
  );

  return { profile, loading, reload: loadProfile, addCredits, saveConfig };
}