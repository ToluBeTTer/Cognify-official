
-- Revoke EXECUTE from PUBLIC (=) on all functions that still have it.
-- PUBLIC grant means anon inherits it. Revoking from PUBLIC closes the anon hole
-- while leaving the explicit authenticated grants untouched.

REVOKE EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(text, text)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_on_profile()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_promotion()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_student_human_response()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, public.sat_section, uuid, uuid, public.difficulty_level, text[], text, text, text, text, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid)               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.publish_import_to_bank(uuid)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.use_approved_email(text, uuid)               FROM PUBLIC;

-- Explicitly revoke from anon as well (belt-and-suspenders — anon inherits PUBLIC but
-- explicit grants/revokes take precedence in Supabase's permission model)
REVOKE EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(text, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_on_profile()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_promotion()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_student_human_response()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, public.sat_section, uuid, uuid, public.difficulty_level, text[], text, text, text, text, integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_import_to_bank(uuid)                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.use_approved_email(text, uuid)               FROM anon;

-- Re-confirm the correct grants that must stay for authenticated users
-- (these were already set; this is idempotent)
GRANT EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(text, text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, public.sat_section, uuid, uuid, public.difficulty_level, text[], text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_import_to_bank(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_approved_email(text, uuid)                TO authenticated;

-- Trigger-only functions need NO client grant — postgres role invokes them internally
-- handle_new_user, handle_whitelisted_email_on_profile, handle_whitelisted_email_promotion,
-- notify_student_human_response, update_updated_at — no grant needed beyond postgres/service_role
