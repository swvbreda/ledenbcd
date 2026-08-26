REVOKE ALL ON FUNCTION public.get_representation_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_representation_stats() TO service_role;