
DELETE FROM public.contribution_payments cp
WHERE cp.year = 2026
  AND cp.status = 'paid'
  AND cp.payment_method = 'bank'
  AND (cp.stripe_session_id IS NULL OR cp.stripe_session_id NOT LIKE 'abn-import:%')
  AND EXISTS (
    SELECT 1 FROM public.contribution_payments dup
    WHERE dup.member_id = cp.member_id
      AND dup.year = 2026
      AND dup.status = 'paid'
      AND dup.stripe_session_id LIKE 'abn-import:%'
  );
