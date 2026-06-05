
-- 1. News & publications: hide members_only_content from anon
REVOKE SELECT ON public.news_articles FROM anon;
REVOKE SELECT ON public.publications FROM anon;
GRANT SELECT (id, slug, title, excerpt, public_content, cover_image_url, source_url, published_at, is_published, created_at, updated_at) ON public.news_articles TO anon;
GRANT SELECT (id, slug, title, summary, public_content, attachment_url, cover_image_url, published_at, is_published, created_at, updated_at) ON public.publications TO anon;

-- 2. survey_responses: tighten member-role access
DROP POLICY IF EXISTS "Users can read survey responses" ON public.survey_responses;

CREATE POLICY "Users can read responses for own surveys"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_responses.survey_id AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can read approved anonymous responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user'::app_role)
    AND respondent_email IS NULL
    AND status = 'approved'
  );

-- 3. Remove broad upload policy on bestuur-photos bucket
DROP POLICY IF EXISTS "Authenticated users can upload bestuur photos" ON storage.objects;

-- 4. Stop realtime broadcasting of push_device_tokens
ALTER PUBLICATION supabase_realtime DROP TABLE public.push_device_tokens;

-- 5. Fix mutable search_path on pgmq wrappers
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;

-- 6. Revoke EXECUTE on SECURITY DEFINER functions from public/anon/authenticated
--    where callers should be triggers, edge functions (service_role), or RLS only.
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_id_for_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_edit_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_external_survey_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cleanup_archived_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_todo_new_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- These remain executable by authenticated (used by RLS / client RPC) but not anon:
REVOKE EXECUTE ON FUNCTION public.get_board_members_public() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_members_for_extern(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pcn_reviewer(uuid) FROM PUBLIC, anon;
