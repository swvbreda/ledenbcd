CREATE TABLE public.member_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://'),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_announcements IS
  'Bestuursaankondigingen die ingelogde leden alleen kunnen lezen.';

ALTER TABLE public.member_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_announcements FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_announcements TO authenticated;
GRANT ALL ON TABLE public.member_announcements TO service_role;

CREATE POLICY "Members read published announcements"
ON public.member_announcements FOR SELECT TO authenticated
USING (
  (published = true AND (
    public.has_role(auth.uid(), 'user'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_board_member(auth.uid())
  ))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_board_member(auth.uid())
);

CREATE POLICY "Board inserts announcements"
ON public.member_announcements FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_board_member(auth.uid())
  )
);

CREATE POLICY "Board updates announcements"
ON public.member_announcements FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_board_member(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_board_member(auth.uid())
);

CREATE POLICY "Board deletes announcements"
ON public.member_announcements FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_board_member(auth.uid())
);

CREATE INDEX member_announcements_feed_idx
ON public.member_announcements (published_at DESC, created_at DESC)
WHERE published = true;

CREATE OR REPLACE FUNCTION public.prepare_member_announcement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
  END IF;

  NEW.title := btrim(NEW.title);
  NEW.body := btrim(NEW.body);
  NEW.link_url := NULLIF(btrim(NEW.link_url), '');
  NEW.updated_at := now();

  IF NEW.published = true
     AND (TG_OP = 'INSERT' OR OLD.published = false) THEN
    NEW.published_at := now();
  ELSIF NEW.published = false THEN
    NEW.published_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_member_announcement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_member_announcement() TO service_role;

CREATE TRIGGER prepare_member_announcement_before_write
BEFORE INSERT OR UPDATE ON public.member_announcements
FOR EACH ROW EXECUTE FUNCTION public.prepare_member_announcement();

CREATE OR REPLACE FUNCTION public.notify_members_on_published_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
BEGIN
  IF NEW.published <> true
     OR (TG_OP = 'UPDATE' AND OLD.published IS NOT DISTINCT FROM NEW.published) THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'internal_webhook_secret' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'title', 'Nieuwe aankondiging',
      'body', NEW.title,
      'target_role', 'members',
      'route', '/aankondigingen'
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_members_on_published_announcement()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_members_on_published_announcement() TO service_role;

CREATE TRIGGER notify_members_on_published_announcement
AFTER INSERT OR UPDATE ON public.member_announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_members_on_published_announcement();