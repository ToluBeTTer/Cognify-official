-- Leaderboard needs to show OTHER students' Milo — but mascot_profiles RLS
-- correctly restricts each row to its own owner. Rather than loosen that
-- (credits/stats aren't meant to be world-readable), this view exposes only
-- the columns that make sense to show publicly: display name, Cogs earned,
-- streak, and the equipped cosmetic look.

CREATE OR REPLACE VIEW public.mascot_leaderboard AS
SELECT
  p.user_id,
  COALESCE(p.full_name, 'A Cognify Student') AS display_name,
  p.role,
  m.total_earned,
  m.streak_days,
  m.equipped_items,
  m.updated_at
FROM public.mascot_profiles m
JOIN public.profiles p ON p.user_id = m.user_id
ORDER BY m.total_earned DESC;

GRANT SELECT ON public.mascot_leaderboard TO authenticated;
