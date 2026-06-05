
INSERT INTO public.member_allowed_emails (email, member_id)
SELECT DISTINCT ON (lower(trim(e))) lower(trim(e)), md.id
FROM public.members_data md,
LATERAL (
  SELECT md.data->>'email' AS e
  UNION ALL
  SELECT c->>'email' FROM jsonb_array_elements(COALESCE(md.data->'contacten','[]'::jsonb)) c
) s
WHERE md.member_type IN ('member','lead')
  AND e IS NOT NULL AND trim(e) <> '' AND position('@' in e) > 1
ORDER BY lower(trim(e)), md.id
ON CONFLICT (email) DO UPDATE SET member_id = EXCLUDED.member_id;
