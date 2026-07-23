ALTER TABLE public.contribution_invoices ADD COLUMN IF NOT EXISTS amount numeric(10,2);

UPDATE public.contribution_invoices ci
SET amount = mc.amount
FROM public.member_contributions mc
WHERE ci.amount IS NULL
  AND mc.member_id = ci.member_id
  AND mc.year = ci.year
  AND (mc.invoice_number = ci.invoice_number OR mc.invoice_number IS NULL);

UPDATE public.contribution_invoices
SET amount = 3000
WHERE amount IS NULL;