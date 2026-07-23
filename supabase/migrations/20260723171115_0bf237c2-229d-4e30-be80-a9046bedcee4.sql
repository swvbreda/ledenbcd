
ALTER TABLE public.member_contributions ALTER COLUMN created_by DROP NOT NULL;

WITH pdf_tx AS (
  SELECT id, value_date, amount, counterparty_iban AS iban, counterparty_name AS naam, description
  FROM public.ponto_transactions
  WHERE account_id='abn-import-58626274741' AND amount > 0 AND dossier IS NULL
),
by_iban AS (
  SELECT DISTINCT ON (p.id) p.id AS tx_id, m.id AS member_id, 'pdf-iban'::text AS strat
  FROM pdf_tx p
  JOIN public.members_data m
    ON m.member_type IN ('member','lead')
   AND m.data ? 'ibans'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(m.data->'ibans') e WHERE upper(e)=upper(p.iban))
  ORDER BY p.id, m.id
),
by_invoice AS (
  SELECT DISTINCT ON (p.id) p.id AS tx_id, ci.member_id, 'pdf-invoice'::text AS strat
  FROM pdf_tx p
  JOIN public.contribution_invoices ci
    ON ci.year = 2026
   AND (p.description ILIKE '%' || ci.invoice_number || '%'
        OR p.description ILIKE '%' || replace(ci.invoice_number,'-','') || '%')
  WHERE p.id NOT IN (SELECT tx_id FROM by_iban)
  ORDER BY p.id, ci.member_id
),
by_name AS (
  SELECT DISTINCT ON (p.id) p.id AS tx_id, m.id AS member_id, 'pdf-name'::text AS strat
  FROM pdf_tx p
  JOIN public.members_data m
    ON m.member_type IN ('member','lead')
   AND (upper(m.data->>'naam') = upper(p.naam)
        OR upper(m.data->>'bedrijfsnaam') = upper(p.naam))
  WHERE p.id NOT IN (SELECT tx_id FROM by_iban)
    AND p.id NOT IN (SELECT tx_id FROM by_invoice)
  ORDER BY p.id, m.id
),
matches AS (
  SELECT * FROM by_iban UNION ALL SELECT * FROM by_invoice UNION ALL SELECT * FROM by_name
)
UPDATE public.ponto_transactions pt
SET dossier = 'Contributie #' || m.member_id,
    match_strategy = m.strat
FROM matches m
WHERE pt.id = m.tx_id;

INSERT INTO public.contribution_payments
  (member_id, year, amount, status, payment_method, paid_at, stripe_session_id)
SELECT
  (regexp_match(pt.dossier, 'Contributie #(\d+)'))[1]::int AS member_id,
  2026,
  pt.amount,
  'paid',
  'bank',
  COALESCE(pt.executed_at, (pt.value_date::timestamptz)),
  'abn-import:' || pt.transaction_id
FROM public.ponto_transactions pt
WHERE pt.account_id='abn-import-58626274741'
  AND pt.dossier LIKE 'Contributie #%'
  AND pt.amount > 0
ON CONFLICT (stripe_session_id) DO NOTHING;
