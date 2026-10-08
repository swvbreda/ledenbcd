REVOKE ALL ON public.declaration_payment_confirmations FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.declaration_payment_confirmations FROM authenticated;