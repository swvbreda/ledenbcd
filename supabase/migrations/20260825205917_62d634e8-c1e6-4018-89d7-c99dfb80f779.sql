ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS kvk_nummer text,
  ADD COLUMN IF NOT EXISTS kvk_oprichtingsdatum date,
  ADD COLUMN IF NOT EXISTS kvk_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.register_enrichment_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  register_id uuid REFERENCES public.coffeeshop_register(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'locatie',
  location_key text,
  field text NOT NULL,
  current_value text,
  proposed_value text NOT NULL,
  source text NOT NULL DEFAULT 'register',
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS register_enrichment_proposals_uniq
  ON public.register_enrichment_proposals (member_id, coalesce(register_id::text,''), coalesce(location_key,''), field);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.register_enrichment_proposals TO authenticated;
GRANT ALL ON public.register_enrichment_proposals TO service_role;

ALTER TABLE public.register_enrichment_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board and admins can view enrichment proposals"
ON public.register_enrichment_proposals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Board and admins can update enrichment proposals"
ON public.register_enrichment_proposals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can delete enrichment proposals"
ON public.register_enrichment_proposals FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_register_enrichment_proposals_updated
BEFORE UPDATE ON public.register_enrichment_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trigger_register_enrichment()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the enrichment' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/enrich-members-from-register',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_register_enrichment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_register_enrichment() TO authenticated, service_role;