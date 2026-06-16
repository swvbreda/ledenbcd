
-- Revoke EXECUTE on trigger-only and internal queue functions from public/anon/authenticated.
-- Triggers run as the table owner; service_role retains EXECUTE.

REVOKE EXECUTE ON FUNCTION public.notify_on_edit_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_membership_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_external_survey_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cleanup_archived_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_todo_new_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_contribution_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Also revoke anon execute on helper functions that should only be called by signed-in users.
-- They remain available to authenticated (needed inside RLS USING clauses).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_board_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pcn_reviewer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_member_id_for_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_members_for_extern(uuid) FROM anon;
