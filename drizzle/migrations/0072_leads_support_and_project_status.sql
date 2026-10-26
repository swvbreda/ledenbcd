CREATE OR REPLACE FUNCTION public.support_member_id(_uid uuid)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT min(mp.member_id) FROM public.member_profiles mp
  JOIN public.members_data md ON md.id = mp.member_id AND md.member_type IN ('member','lead')
  WHERE _uid IS NOT NULL AND mp.user_id = _uid
    AND NOT public.has_role(_uid, 'extern') AND NOT public.has_role(_uid, 'inhuur')
$function$;

CREATE OR REPLACE FUNCTION public.get_member_project_status()
 RETURNS TABLE(id uuid, title text, status text, status_date date, description text, timeline jsonb)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      WHERE mp.user_id = _uid AND md.member_type IN ('member','lead')
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
$function$;