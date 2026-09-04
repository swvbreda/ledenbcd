DROP FUNCTION IF EXISTS public.get_agenda_share(text);
CREATE OR REPLACE FUNCTION public.get_agenda_share(_code text)
 RETURNS TABLE(id uuid, title text, event_date date, start_time time without time zone, end_time time without time zone, location text, event_type text, image_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.event_type::text, e.image_path
  FROM public.agenda_events e
  WHERE upper(e.share_code) = upper(_code)
  LIMIT 1
$function$;
REVOKE ALL ON FUNCTION public.get_agenda_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_share(text) TO anon, authenticated, service_role;