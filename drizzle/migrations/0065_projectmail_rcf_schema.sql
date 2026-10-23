CREATE TABLE public.project_mail_codes (
  project_id uuid PRIMARY KEY REFERENCES public.internal_projects(id) ON DELETE RESTRICT,
  reference_code text NOT NULL CHECK (reference_code ~ '^BCD-[A-Z0-9]{3,20}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX project_mail_codes_code_uq ON public.project_mail_codes (lower(reference_code));
GRANT SELECT ON public.project_mail_codes TO authenticated;
GRANT ALL ON public.project_mail_codes TO service_role;
ALTER TABLE public.project_mail_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmc admin read" ON public.project_mail_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.project_mail_codes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reference_code IS DISTINCT FROM OLD.reference_code OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Projectcode is blijvend en kan niet worden gewijzigd';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER project_mail_codes_guard BEFORE UPDATE ON public.project_mail_codes FOR EACH ROW EXECUTE FUNCTION public.project_mail_codes_guard();
CREATE FUNCTION public.project_mail_codes_nodelete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Projectcodes worden niet verwijderd'; END $$;
CREATE TRIGGER project_mail_codes_nodelete BEFORE DELETE ON public.project_mail_codes FOR EACH ROW EXECUTE FUNCTION public.project_mail_codes_nodelete();

WITH heads AS (
  SELECT id, archived_at,
    CASE WHEN position(' — ' in title) > 0 AND split_part(title, ' — ', 1) ~ '^[A-Za-z0-9]{3,16}$'
      THEN upper(split_part(title, ' — ', 1)) END AS head
  FROM public.internal_projects
), uniq AS (
  SELECT head FROM heads WHERE archived_at IS NULL AND head IS NOT NULL GROUP BY head HAVING count(*) = 1
)
INSERT INTO public.project_mail_codes (project_id, reference_code)
SELECT h.id,
  CASE WHEN h.archived_at IS NULL AND h.head IN (SELECT head FROM uniq) THEN 'BCD-' || h.head
       ELSE 'BCD-' || upper(left(replace(h.id::text, '-', ''), 8)) END
FROM heads h
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.project_mail_code_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.project_mail_codes (project_id, reference_code)
  VALUES (NEW.id, 'BCD-' || upper(left(replace(NEW.id::text, '-', ''), 8))) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_project_mail_code AFTER INSERT ON public.internal_projects FOR EACH ROW EXECUTE FUNCTION public.project_mail_code_on_insert();

CREATE TABLE public.projectmail_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mailbox text NOT NULL DEFAULT 'info@coffeeshopbond.nl' CHECK (mailbox = 'info@coffeeshopbond.nl'),
  mailbox_user_id uuid,
  enabled boolean NOT NULL DEFAULT false,
  connection_state text NOT NULL DEFAULT 'onbekend' CHECK (connection_state IN ('onbekend','verbinding_nodig','verbonden','fout')),
  connection_detail text,
  connection_checked_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.projectmail_settings (id) VALUES (true);
GRANT SELECT (id, mailbox, enabled, connection_state, connection_detail, connection_checked_at, last_run_at, last_success_at, last_error, last_error_at, consecutive_failures, updated_at) ON public.projectmail_settings TO authenticated;
GRANT ALL ON public.projectmail_settings TO service_role;
ALTER TABLE public.projectmail_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pms admin read" ON public.projectmail_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.projectmail_checkpoint (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  delta_link text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.projectmail_checkpoint TO service_role;
ALTER TABLE public.projectmail_checkpoint ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.projectmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox text NOT NULL,
  source_message_id text NOT NULL,
  internet_message_id text,
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE RESTRICT,
  reference_code text NOT NULL,
  subject text NOT NULL,
  received_at timestamptz NOT NULL,
  web_link text CHECK (web_link IS NULL OR web_link ~ '^https://outlook\.(office|office365|live)\.com/'),
  status text NOT NULL DEFAULT 'in_behandeling' CHECK (status IN ('in_behandeling','verwerkt','fout')),
  summary text,
  next_steps text,
  attempts int NOT NULL DEFAULT 0,
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox, source_message_id, project_id)
);
GRANT SELECT ON public.projectmail_messages TO authenticated;
GRANT ALL ON public.projectmail_messages TO service_role;
ALTER TABLE public.projectmail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmm admin read" ON public.projectmail_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.projectmail_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_key text NOT NULL UNIQUE,
  mailbox text NOT NULL,
  source_message_id text NOT NULL,
  project_id uuid REFERENCES public.internal_projects(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('onbekende_code','meerdere_codes','ongeldige_code','project_gepauzeerd','project_gearchiveerd','taak_onzeker','taakstatus','verwerkingsfout')),
  subject text,
  received_at timestamptz,
  web_link text CHECK (web_link IS NULL OR web_link ~ '^https://outlook\.(office|office365|live)\.com/'),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT ON public.projectmail_reviews TO authenticated;
GRANT ALL ON public.projectmail_reviews TO service_role;
ALTER TABLE public.projectmail_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmr admin read" ON public.projectmail_reviews FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.projectmail_task_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.projectmail_messages(id) ON DELETE RESTRICT,
  norm_title text NOT NULL,
  title text NOT NULL,
  source_quote text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('aangemaakt','review','dubbel')),
  task_id uuid REFERENCES public.internal_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, norm_title)
);
GRANT SELECT ON public.projectmail_task_candidates TO authenticated;
GRANT ALL ON public.projectmail_task_candidates TO service_role;
ALTER TABLE public.projectmail_task_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmt admin read" ON public.projectmail_task_candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.projectmail_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('manual','scheduled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
GRANT SELECT ON public.projectmail_runs TO authenticated;
GRANT ALL ON public.projectmail_runs TO service_role;
ALTER TABLE public.projectmail_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmrun admin read" ON public.projectmail_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.projectmail_acquire(_token uuid, _seconds int) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF _seconds < 30 OR _seconds > 900 THEN RAISE EXCEPTION 'Ongeldige leaseduur'; END IF;
  UPDATE public.projectmail_settings SET lease_token = _token, lease_until = now() + make_interval(secs => _seconds)
   WHERE id AND (lease_until IS NULL OR lease_until < now() OR lease_token = _token);
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n = 1;
END $$;
CREATE FUNCTION public.projectmail_release(_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.projectmail_settings SET lease_token = NULL, lease_until = NULL WHERE id AND lease_token = _token;
$$;
REVOKE ALL ON FUNCTION public.projectmail_acquire(uuid,int), public.projectmail_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.projectmail_acquire(uuid,int), public.projectmail_release(uuid) TO service_role;

CREATE FUNCTION public.projectmail_set_active(_project uuid, _active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Alleen beheerders'; END IF;
  UPDATE public.project_mail_codes SET active = _active, updated_by = auth.uid() WHERE project_id = _project;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project heeft geen code'; END IF;
END $$;
CREATE FUNCTION public.projectmail_resolve_review(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Alleen beheerders'; END IF;
  UPDATE public.projectmail_reviews SET resolved_at = now(), resolved_by = auth.uid() WHERE id = _id AND resolved_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.projectmail_set_active(uuid,boolean), public.projectmail_resolve_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projectmail_set_active(uuid,boolean), public.projectmail_resolve_review(uuid) TO authenticated;