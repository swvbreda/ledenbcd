CREATE TABLE public.member_shop_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id integer NOT NULL,
  alias text NOT NULL,
  plaats text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX member_shop_aliases_uniq
  ON public.member_shop_aliases (
    public.normalize_shop_naam(alias),
    public.normalize_shop_naam(plaats),
    member_id
  );

GRANT SELECT ON public.member_shop_aliases TO authenticated;
GRANT ALL ON public.member_shop_aliases TO service_role;

ALTER TABLE public.member_shop_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ingelogde gebruikers kunnen aliassen lezen"
  ON public.member_shop_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Alleen beheer kan aliassen beheren"
  ON public.member_shop_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.find_shop_match(_naam text, _plaats text)
 RETURNS TABLE(member_id integer, member_type text, naam text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH treffers AS (
    SELECT m.id, m.member_type, m.data->>'naam' AS naam
    FROM public.members_data m
    WHERE m.member_type IN ('member', 'lead')
      AND m.id < 10000
      AND public.normalize_shop_naam(m.data->>'naam') <> ''
      AND public.normalize_shop_naam(m.data->>'naam') = public.normalize_shop_naam(_naam)
      AND public.normalize_shop_naam(coalesce(m.data->>'plaats', '')) = public.normalize_shop_naam(coalesce(_plaats, ''))
    UNION
    SELECT m.id, m.member_type, m.data->>'naam' AS naam
    FROM public.member_shop_aliases a
    JOIN public.members_data m ON m.id = a.member_id
    WHERE m.member_type IN ('member', 'lead')
      AND m.id < 10000
      AND public.normalize_shop_naam(a.alias) <> ''
      AND public.normalize_shop_naam(a.alias) = public.normalize_shop_naam(_naam)
      AND public.normalize_shop_naam(a.plaats) = public.normalize_shop_naam(coalesce(_plaats, ''))
  )
  SELECT id, member_type, naam FROM treffers ORDER BY id LIMIT 2;
$function$;

REVOKE EXECUTE ON FUNCTION public.find_shop_match(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_shop_match(text, text) TO authenticated, service_role;