REVOKE EXECUTE ON FUNCTION public.trg_sync_member_allowed_emails() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.member_registered_emails(integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_member_allowed_emails(integer) FROM public;