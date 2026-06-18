
-- 1. Hide members_only_content from anon on news_articles and publications
REVOKE SELECT (members_only_content) ON public.news_articles FROM anon;
REVOKE SELECT (members_only_content) ON public.publications FROM anon;

-- 2. Attach prevent_extern_self_approval trigger to external_organizations
DROP TRIGGER IF EXISTS prevent_extern_self_approval_trg ON public.external_organizations;
CREATE TRIGGER prevent_extern_self_approval_trg
  BEFORE UPDATE ON public.external_organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_extern_self_approval();

-- 3. Scope PCN reviewer access to only the PCN survey
DROP POLICY IF EXISTS "PCN reviewer can read responses" ON public.survey_responses;
CREATE POLICY "PCN reviewer can read responses"
  ON public.survey_responses
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_pcn_reviewer(auth.uid())
      AND survey_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
      AND (respondent_email IS NOT NULL OR status = 'approved')
    )
  );

DROP POLICY IF EXISTS "PCN reviewer can update external response status" ON public.survey_responses;
CREATE POLICY "PCN reviewer can update external response status"
  ON public.survey_responses
  FOR UPDATE
  TO authenticated
  USING (
    respondent_email IS NOT NULL
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (is_pcn_reviewer(auth.uid()) AND survey_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid)
    )
  )
  WITH CHECK (
    respondent_email IS NOT NULL
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (is_pcn_reviewer(auth.uid()) AND survey_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid)
    )
  );

-- 4. Revoke EXECUTE from anon/public on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_cleanup_archived_member() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_pcn_reviewer(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recompute_contribution_paid() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_todo_new_member() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_member_id_for_email(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_board_members_public() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_edit_request() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_membership_request() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_board_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.prevent_extern_self_approval() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_external_survey_response() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_outlook_sync() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_members_for_extern(uuid) FROM anon, public;

-- Grant execute where needed (authenticated only)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_board_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pcn_reviewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_board_members_public() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_members_for_extern(uuid) TO authenticated;
