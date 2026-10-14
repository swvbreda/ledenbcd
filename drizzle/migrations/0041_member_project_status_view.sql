-- Explicit user exception (Simone, 2026-10-14): read-only status + Verloop projection for current members.
-- Base tables, RLS and storage policies stay admin-only; this function exposes only allowlisted fields.
CREATE OR REPLACE FUNCTION public.member_verloop_items(_plan text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _line text; _h text; _in boolean := false; _parts text[]; _out jsonb := '[]'::jsonb;
  _date_re constant text := '^(\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2} (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\.? \d{4})$';
BEGIN
  IF _plan IS NULL OR btrim(_plan) = '' THEN RETURN _out; END IF;
  FOREACH _line IN ARRAY string_to_array(replace(_plan, E'\r\n', E'\n'), E'\n') LOOP
    _h := lower(btrim(regexp_replace(btrim(_line), ':$', '')));
    IF _h IN ('huidige stand','verloop','vervolg','praktische opvolging') THEN
      _in := (_h = 'verloop');
      CONTINUE;
    END IF;
    IF NOT _in THEN CONTINUE; END IF;
    _parts := string_to_array(_line, '|');
    IF coalesce(array_length(_parts, 1), 0) < 3 THEN CONTINUE; END IF;
    IF btrim(_parts[1]) !~* _date_re THEN CONTINUE; END IF;
    _out := _out || jsonb_build_array(jsonb_build_object(
      'date', btrim(_parts[1]),
      'title', btrim(_parts[2]),
      'text', (SELECT string_agg(btrim(p), ' | ' ORDER BY i) FROM unnest(_parts[3:]) WITH ORDINALITY AS t(p, i))
    ));
  END LOOP;
  RETURN _out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.member_verloop_items(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_member_project_status()
RETURNS TABLE (id uuid, title text, status text, status_date date, description text, timeline jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  _admin := public.has_role(_uid, 'admin');
  IF NOT _admin THEN
    IF public.has_role(_uid, 'extern') OR public.has_role(_uid, 'inhuur') THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.member_profiles mp
      JOIN public.members_data md ON md.id = mp.member_id
      WHERE mp.user_id = _uid AND md.member_type = 'member'
    ) THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN QUERY
    SELECT p.id, p.title, p.status, p.status_date, p.description, public.member_verloop_items(p.project_plan)
    FROM public.internal_projects p
    WHERE p.archived_at IS NULL
    ORDER BY p.status_date DESC NULLS LAST, p.title;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_member_project_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_project_status() TO authenticated;
COMMENT ON FUNCTION public.get_member_project_status() IS 'Explicit user exception: read-only status/Verloop projection for current members and admins; base tables remain admin-only.';