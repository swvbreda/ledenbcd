REVOKE ALL ON FUNCTION public.agenda_seed_board_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_board_registrations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_board_registrations(uuid) TO service_role;