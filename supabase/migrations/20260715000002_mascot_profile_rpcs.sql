-- mascot_profiles is a newly-added table, same category of object (freshly
-- added schema) that caused the profiles.test_date schema-cache failure.
-- Routing these writes through RPCs sidesteps PostgREST's REST-table cache
-- the same way save_academic_profile does for profiles.

CREATE OR REPLACE FUNCTION public.purchase_mascot_item(
  p_user_id uuid,
  p_item_id text,
  p_price integer
)
RETURNS public.mascot_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.mascot_profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_profile FROM public.mascot_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mascot profile not found for user %', p_user_id;
  END IF;

  IF p_item_id = ANY(v_profile.owned_items) THEN
    RETURN v_profile; -- already owned, no-op
  END IF;

  IF v_profile.credits < p_price THEN
    RAISE EXCEPTION 'Not enough Cogs';
  END IF;

  UPDATE public.mascot_profiles
  SET owned_items = array_append(owned_items, p_item_id),
      credits = credits - p_price,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_mascot_item(
  p_user_id uuid,
  p_category text,
  p_item_id text
)
RETURNS public.mascot_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.mascot_profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.mascot_profiles
  SET equipped_items = jsonb_set(equipped_items, ARRAY[p_category], to_jsonb(p_item_id)),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mascot profile not found for user %', p_user_id;
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_mascot_stat(
  p_user_id uuid,
  p_stat text
)
RETURNS public.mascot_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.mascot_profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_stat NOT IN ('throws', 'chats', 'wallHits', 'offscreen') THEN
    RAISE EXCEPTION 'Invalid stat name';
  END IF;

  UPDATE public.mascot_profiles
  SET stats = jsonb_set(
        stats, ARRAY[p_stat],
        to_jsonb(COALESCE((stats ->> p_stat)::int, 0) + 1)
      ),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_mascot_position(
  p_user_id uuid,
  p_x numeric,
  p_y numeric,
  p_corner text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.mascot_profiles
  SET positions = jsonb_build_object('x', p_x, 'y', p_y, 'corner', p_corner),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_mascot_item(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_mascot_item(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_mascot_stat(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mascot_position(uuid, numeric, numeric, text) TO authenticated;
