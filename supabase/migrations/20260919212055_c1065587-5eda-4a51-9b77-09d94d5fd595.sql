CREATE OR REPLACE FUNCTION public.register_telt_mee(
  _telt_mee boolean,
  _vervallen boolean,
  _status text,
  _raw jsonb
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE(_vervallen, false) THEN false
    WHEN _telt_mee IS NOT NULL THEN _telt_mee
    ELSE COALESCE((_raw->>'is_ruis')::boolean, false) = false
         AND lower(COALESCE(_status, '')) <> 'gesloten'
         AND COALESCE(_raw->>'gesloten_op', '') = ''
  END
$$;