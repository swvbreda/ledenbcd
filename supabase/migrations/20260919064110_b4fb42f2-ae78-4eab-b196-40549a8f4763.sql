CREATE OR REPLACE FUNCTION public.normalize_shop_naam(_naam text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(translate(coalesce(_naam, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')),
      '\m(coffeeshop|koffieshop|coffee shop|shop|de|het|the|bv|b\.v\.)\M', ' ', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_contribution_exempt(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_shop_match(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalize_shop_naam(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_shop_naam(text) TO authenticated, service_role;