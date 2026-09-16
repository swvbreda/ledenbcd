REVOKE ALL ON FUNCTION public.apply_member_register_opgave(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_member_register_opgave() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compact_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compact_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_member_register_opgave(integer) TO service_role;