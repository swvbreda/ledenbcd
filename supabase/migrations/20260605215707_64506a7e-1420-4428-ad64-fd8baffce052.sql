
-- 1. news_articles: restrict anon column access (hide members_only_content)
REVOKE SELECT ON public.news_articles FROM anon;
GRANT SELECT (id, slug, title, excerpt, public_content, cover_image_url, source_url, published_at, is_published, created_at, updated_at)
  ON public.news_articles TO anon;

-- 2. publications: same treatment
REVOKE SELECT ON public.publications FROM anon;
GRANT SELECT (id, slug, title, summary, public_content, attachment_url, cover_image_url, published_at, is_published, created_at, updated_at)
  ON public.publications TO anon;

-- 3. faq_items: members-only FAQ must require admin or 'user' role (not extern)
DROP POLICY IF EXISTS "Authenticated can read all published FAQ" ON public.faq_items;
CREATE POLICY "Members and admins can read all published FAQ"
  ON public.faq_items FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  );

-- 4. survey_responses: tighten anon insert
DROP POLICY IF EXISTS "Anon can insert responses" ON public.survey_responses;
CREATE POLICY "Anon can insert responses for active surveys"
  ON public.survey_responses FOR INSERT
  TO anon
  WITH CHECK (
    respondent_email IS NOT NULL
    AND length(trim(respondent_email)) > 0
    AND EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND s.active = true
    )
  );
