CREATE OR REPLACE FUNCTION public.announcement_name_matches(_text text, _name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT length(btrim(_name)) >= 4
     AND lower(_text) ~ ('(^|[^[:alnum:]])' || regexp_replace(lower(btrim(_name)), '([^[:alnum:][:space:]])', '\\\1', 'g') || '($|[^[:alnum:]])')
$$;