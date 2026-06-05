-- 1. news_articles: remove members_only_content access from anon and authenticated.
REVOKE SELECT (members_only_content) ON public.news_articles FROM anon;
REVOKE SELECT ON public.news_articles FROM authenticated;
GRANT SELECT (id, slug, title, excerpt, public_content, cover_image_url, source_url, published_at, is_published, created_at, updated_at)
  ON public.news_articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_articles TO service_role;

-- 2. publications: same treatment for authenticated.
REVOKE SELECT (members_only_content) ON public.publications FROM anon;
REVOKE SELECT ON public.publications FROM authenticated;
GRANT SELECT (id, slug, title, summary, public_content, attachment_url, cover_image_url, published_at, is_published, created_at, updated_at)
  ON public.publications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO service_role;

-- 3. survey_responses: tighten authenticated insert to active surveys + non-empty email.
DROP POLICY IF EXISTS "Authenticated can insert responses" ON public.survey_responses;
CREATE POLICY "Authenticated can insert responses for active surveys"
  ON public.survey_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    respondent_email IS NOT NULL
    AND length(trim(respondent_email)) > 0
    AND EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND s.active = true
    )
  );

-- 4. secure_document_views: explicit policy preventing any non-service_role insert.
-- Edge function uses service_role which bypasses RLS, so this is safe.
DROP POLICY IF EXISTS "No client inserts on view audit" ON public.secure_document_views;
CREATE POLICY "No client inserts on view audit"
  ON public.secure_document_views FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);