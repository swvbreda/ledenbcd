CREATE OR REPLACE FUNCTION public.get_register_plaats_stats()
 RETURNS TABLE(plaats text, aantal integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS plaats,
         COUNT(*)::integer AS aantal
  FROM public.coffeeshop_register r
  WHERE r.vervallen = false
    AND COALESCE((r.raw->>'is_ruis')::boolean, false) = false
    AND lower(COALESCE(r.status, '')) <> 'gesloten'
    AND COALESCE(r.raw->>'gesloten_op', '') = ''
    AND COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) IS NOT NULL
  GROUP BY 1
$function$;

REVOKE ALL ON FUNCTION public.get_register_plaats_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_register_plaats_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_register_link_summary()
 RETURNS TABLE(actieve_shops integer, bevestigde_koppelingen integer, gekoppelde_leden integer, vervallen_koppelingen integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*)::integer
       FROM public.coffeeshop_register r
      WHERE r.vervallen = false
        AND COALESCE((r.raw->>'is_ruis')::boolean, false) = false
        AND lower(COALESCE(r.status, '')) <> 'gesloten'
        AND COALESCE(r.raw->>'gesloten_op', '') = ''),
    (SELECT COUNT(DISTINCT l.register_id)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd'
        AND r.vervallen = false
        AND COALESCE((r.raw->>'is_ruis')::boolean, false) = false
        AND lower(COALESCE(r.status, '')) <> 'gesloten'
        AND COALESCE(r.raw->>'gesloten_op', '') = ''),
    (SELECT COUNT(DISTINCT l.member_id)::integer
       FROM public.coffeeshop_member_links l
      WHERE l.status = 'bevestigd'),
    (SELECT COUNT(*)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd'
        AND (r.vervallen = true
          OR COALESCE((r.raw->>'is_ruis')::boolean, false) = true
          OR lower(COALESCE(r.status, '')) = 'gesloten'
          OR COALESCE(r.raw->>'gesloten_op', '') <> ''))
$function$;

REVOKE ALL ON FUNCTION public.get_register_link_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_register_link_summary() TO authenticated, service_role;