UPDATE public.members_data
SET data = jsonb_set(
  jsonb_set(data, '{email}', '"office@coffeeshopdesteeg.nl"'::jsonb, true),
  '{contacten}',
  COALESCE(data->'contacten','[]'::jsonb) || '[{"naam":"Daan Roelofs","email":"office@coffeeshopdesteeg.nl","functie":"Kantoor","telefoon":""}]'::jsonb,
  true
)
WHERE id = 112
AND NOT (COALESCE(data->'contacten','[]'::jsonb) @> '[{"email":"office@coffeeshopdesteeg.nl"}]'::jsonb);