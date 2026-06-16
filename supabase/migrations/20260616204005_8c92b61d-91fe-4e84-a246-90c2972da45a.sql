REVOKE EXECUTE ON FUNCTION public.is_board_member(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_board_member(uuid) TO authenticated, service_role;