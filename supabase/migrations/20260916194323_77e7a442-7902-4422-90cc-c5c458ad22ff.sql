REVOKE EXECUTE ON FUNCTION public.agenda_events_outlook_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_registrations_outlook_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_set_share_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_agenda_share_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_beleidsmonitor_sync() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_register_enrichment_scoped(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_beleidsmonitor_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_register_enrichment_scoped(integer, uuid) TO authenticated;