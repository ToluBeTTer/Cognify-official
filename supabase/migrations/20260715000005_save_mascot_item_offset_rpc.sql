CREATE OR REPLACE FUNCTION public.save_mascot_item_offset(
  p_user_id uuid,
  p_category text,
  p_dx numeric,
  p_dy numeric
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
  SET mascot_config = jsonb_set(
        COALESCE(mascot_config, '{}'::jsonb),
        ARRAY[p_category],
        jsonb_build_object('dx', p_dx, 'dy', p_dy)
      ),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mascot profile not found for user %', p_user_id;
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_mascot_item_offset(uuid, text, numeric, numeric) TO authenticated;
