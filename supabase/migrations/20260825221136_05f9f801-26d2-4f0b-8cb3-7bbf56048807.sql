CREATE OR REPLACE FUNCTION public.get_register_plaats_stats()
RETURNS TABLE(plaats text, aantal integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS plaats,
         COUNT(*)::integer AS aantal
  FROM public.coffeeshop_register r
  WHERE r.vervallen = false
    AND COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) IS NOT NULL
  GROUP BY 1
$$;

REVOKE ALL ON FUNCTION public.get_register_plaats_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_register_plaats_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_register_link_summary()
RETURNS TABLE(actieve_shops integer, bevestigde_koppelingen integer, gekoppelde_leden integer, vervallen_koppelingen integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::integer FROM public.coffeeshop_register WHERE vervallen = false),
    (SELECT COUNT(DISTINCT l.register_id)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd' AND r.vervallen = false),
    (SELECT COUNT(DISTINCT l.member_id)::integer
       FROM public.coffeeshop_member_links l
      WHERE l.status = 'bevestigd'),
    (SELECT COUNT(*)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd' AND r.vervallen = true)
$$;

REVOKE ALL ON FUNCTION public.get_register_link_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_register_link_summary() TO authenticated, service_role;

CREATE TABLE public.member_location_register_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  location_key text NOT NULL,
  status text NOT NULL DEFAULT 'niet_in_register',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, location_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_location_register_status TO authenticated;
GRANT ALL ON public.member_location_register_status TO service_role;

ALTER TABLE public.member_location_register_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bestuur en admins lezen locatiestatus"
ON public.member_location_register_status FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Bestuur en admins beheren locatiestatus"
ON public.member_location_register_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_member_location_register_status_updated
BEFORE UPDATE ON public.member_location_register_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();