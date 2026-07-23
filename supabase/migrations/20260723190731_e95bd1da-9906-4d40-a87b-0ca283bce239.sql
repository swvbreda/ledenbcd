ALTER TABLE public.contribution_invoices
  ADD COLUMN IF NOT EXISTS invoice_date date;

-- Backfill factuurdatum uit de bestaande ledencontributie of, als noodoplossing,
-- uit de aanmaakdatum van de factuurregel.
UPDATE public.contribution_invoices ci
SET invoice_date = COALESCE(mc.invoice_date, ci.invoice_date, ci.created_at::date)
FROM public.member_contributions mc
WHERE mc.member_id = ci.member_id
  AND mc.year = ci.year
  AND ci.invoice_date IS NULL;

-- Verwijder oude 2025-facturen die door de koppeling als 2026-factuur zijn meegeteld.
DELETE FROM public.contribution_invoices
WHERE year = 2026
  AND COALESCE(invoice_number, '') ~ '^2025';

-- Als er voor hetzelfde lid meerdere 2026-factuurregels staan, behoud dan de regel
-- die overeenkomt met member_contributions.invoice_number.
DELETE FROM public.contribution_invoices ci
USING public.member_contributions mc
WHERE ci.member_id = mc.member_id
  AND ci.year = mc.year
  AND ci.year = 2026
  AND mc.invoice_number IS NOT NULL
  AND ci.invoice_number IS DISTINCT FROM mc.invoice_number
  AND EXISTS (
    SELECT 1
    FROM public.contribution_invoices keep
    WHERE keep.member_id = ci.member_id
      AND keep.year = ci.year
      AND keep.invoice_number = mc.invoice_number
  );

-- Synchroniseer bedrag en factuurdatum met de leidende ledencontributie-regel.
UPDATE public.contribution_invoices ci
SET amount = COALESCE(mc.amount, ci.amount),
    invoice_date = COALESCE(mc.invoice_date, ci.invoice_date, ci.created_at::date)
FROM public.member_contributions mc
WHERE mc.member_id = ci.member_id
  AND mc.year = ci.year
  AND ci.year = 2026
  AND (mc.invoice_number IS NULL OR ci.invoice_number IS NOT DISTINCT FROM mc.invoice_number);

-- Vul ontbrekende factuurregels aan vanuit member_contributions, zodat de factuurlijst
-- één consistente regel per contributie kan tonen.
INSERT INTO public.contribution_invoices (member_id, year, invoice_number, invoice_file_path, amount, invoice_date)
SELECT mc.member_id,
       mc.year,
       mc.invoice_number,
       mc.invoice_file_path,
       mc.amount,
       mc.invoice_date
FROM public.member_contributions mc
WHERE mc.year = 2026
  AND NOT EXISTS (
    SELECT 1
    FROM public.contribution_invoices ci
    WHERE ci.member_id = mc.member_id
      AND ci.year = mc.year
  );

-- Als een lid nog open stond maar er is genoeg betaling geregistreerd, zet die bijdrage op betaald.
WITH paid AS (
  SELECT member_id,
         year,
         SUM(COALESCE(amount, 0)) AS paid_amount,
         MIN(paid_at)::date AS first_paid_at
  FROM public.contribution_payments
  WHERE status = 'paid'
  GROUP BY member_id, year
)
UPDATE public.member_contributions mc
SET paid = true,
    paid_date = COALESCE(mc.paid_date, paid.first_paid_at),
    updated_at = now()
FROM paid
WHERE paid.member_id = mc.member_id
  AND paid.year = mc.year
  AND mc.year = 2026
  AND mc.paid = false
  AND paid.paid_amount >= COALESCE(mc.amount, 0) - 0.01;

-- Registreer betaalde contributies die nog geen payment-regel hadden, zodat bank/leden-totalen gelijk kunnen lopen.
INSERT INTO public.contribution_payments (member_id, year, amount, installment_number, installment_count, status, payment_method, paid_at)
SELECT mc.member_id,
       mc.year,
       mc.amount,
       1,
       1,
       'paid',
       'bank',
       mc.paid_date::timestamptz
FROM public.member_contributions mc
WHERE mc.year = 2026
  AND mc.paid = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.contribution_payments cp
    WHERE cp.member_id = mc.member_id
      AND cp.year = mc.year
      AND cp.status = 'paid'
  );

CREATE INDEX IF NOT EXISTS contribution_invoices_member_year_idx
  ON public.contribution_invoices (member_id, year);
CREATE INDEX IF NOT EXISTS contribution_invoices_invoice_date_idx
  ON public.contribution_invoices (year, invoice_date DESC);