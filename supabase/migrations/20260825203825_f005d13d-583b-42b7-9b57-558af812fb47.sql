CREATE TABLE public.coffeeshop_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bron_id uuid NOT NULL UNIQUE,
  naam text NOT NULL,
  straat text,
  huisnummer text,
  huisnummer_toevoeging text,
  postcode text,
  plaats text,
  gemeente text,
  provincie text,
  latitude numeric,
  longitude numeric,
  exploitant text,
  vergunninghouder text,
  vergunningnummer text,
  status text NOT NULL DEFAULT 'actief',
  vergunningverlening date,
  einddatum date,
  website text,
  telefoon text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  vervallen boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coffeeshop_register_plaats ON public.coffeeshop_register (plaats);
CREATE INDEX idx_coffeeshop_register_gemeente ON public.coffeeshop_register (gemeente);

GRANT SELECT ON public.coffeeshop_register TO authenticated;
GRANT ALL ON public.coffeeshop_register TO service_role;
ALTER TABLE public.coffeeshop_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bestuur en admins lezen het register"
  ON public.coffeeshop_register FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_coffeeshop_register_updated
  BEFORE UPDATE ON public.coffeeshop_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coffeeshop_register_ubo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.coffeeshop_register(id) ON DELETE CASCADE,
  niveau integer NOT NULL DEFAULT 0,
  naam text NOT NULL,
  kvk_nummer text,
  soort text NOT NULL DEFAULT 'rechtspersoon',
  betrouwbaarheid text,
  is_uiteindelijk boolean NOT NULL DEFAULT false,
  toelichting text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (register_id, niveau, naam)
);
CREATE INDEX idx_coffeeshop_register_ubo_register ON public.coffeeshop_register_ubo (register_id);

GRANT SELECT ON public.coffeeshop_register_ubo TO authenticated;
GRANT ALL ON public.coffeeshop_register_ubo TO service_role;
ALTER TABLE public.coffeeshop_register_ubo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bestuur en admins lezen de eigendomsketen"
  ON public.coffeeshop_register_ubo FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_coffeeshop_register_ubo_updated
  BEFORE UPDATE ON public.coffeeshop_register_ubo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coffeeshop_member_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.coffeeshop_register(id) ON DELETE CASCADE,
  member_id integer NOT NULL,
  match_score numeric NOT NULL DEFAULT 1,
  match_reden text,
  status text NOT NULL DEFAULT 'voorstel',
  bevestigd_door uuid,
  bevestigd_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (register_id, member_id),
  CONSTRAINT coffeeshop_member_links_status_chk CHECK (status IN ('voorstel','bevestigd','afgewezen'))
);
CREATE INDEX idx_coffeeshop_member_links_member ON public.coffeeshop_member_links (member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coffeeshop_member_links TO authenticated;
GRANT ALL ON public.coffeeshop_member_links TO service_role;
ALTER TABLE public.coffeeshop_member_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bestuur en admins lezen koppelingen"
  ON public.coffeeshop_member_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));
CREATE POLICY "Bestuur en admins beheren koppelingen"
  ON public.coffeeshop_member_links FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));
CREATE POLICY "Bestuur en admins wijzigen koppelingen"
  ON public.coffeeshop_member_links FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));
CREATE POLICY "Bestuur en admins verwijderen koppelingen"
  ON public.coffeeshop_member_links FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_coffeeshop_member_links_updated
  BEFORE UPDATE ON public.coffeeshop_member_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coffeeshop_register_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_run_at timestamptz,
  last_status text,
  shops_synced integer NOT NULL DEFAULT 0,
  ubo_synced integer NOT NULL DEFAULT 0,
  links_proposed integer NOT NULL DEFAULT 0,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coffeeshop_register_sync_state_single CHECK (id = 1)
);
INSERT INTO public.coffeeshop_register_sync_state (id) VALUES (1);

GRANT SELECT ON public.coffeeshop_register_sync_state TO authenticated;
GRANT ALL ON public.coffeeshop_register_sync_state TO service_role;
ALTER TABLE public.coffeeshop_register_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bestuur en admins lezen de sync-status"
  ON public.coffeeshop_register_sync_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.trigger_coffeeshopregister_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the register sync' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/sync-coffeeshopregister',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_coffeeshopregister_sync() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_coffeeshopregister_sync() TO authenticated, service_role;