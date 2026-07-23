
UPDATE public.ponto_transactions
SET budget_line_item_id = 'b1000000-0000-0000-0000-000000000006',
    match_strategy = COALESCE(match_strategy, 'manual'),
    matched_manually = true,
    dossier = COALESCE(NULLIF(dossier,''), 'Contributie (handmatig gekoppeld)')
WHERE id IN (
  'e64a0225-a857-4c8d-91f0-d95477063625', -- CRASH LIGHT
  'c7691cfa-8ba5-4cc9-84a0-10e39010e150', -- A.R. van der Ende
  'f1ffdcd7-810a-41ee-97f0-74b5f9c0409a'  -- 1851 B.V.
);

UPDATE public.finance_todos
SET status = 'done', updated_at = now()
WHERE id IN (
  'c902ba57-484d-4f6a-aef6-885363ed6102',
  'f3d9d58b-07c5-4b07-a85a-a858a88a0196',
  'afa900d1-4c9c-442a-9df1-4827a2995de0'
);
