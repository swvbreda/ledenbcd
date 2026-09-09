REVOKE ALL ON FUNCTION public.auto_prepare_invoice_new_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_prepare_invoice_new_member() TO service_role;