
-- Split concatenated emails into separate rows so each address can register.
WITH split AS (
  SELECT member_id,
         lower(trim(unnest(string_to_array(email, ',')))) AS email
  FROM public.member_allowed_emails
  WHERE email LIKE '%,%'
)
INSERT INTO public.member_allowed_emails (member_id, email)
SELECT member_id, email FROM split
WHERE email <> ''
ON CONFLICT DO NOTHING;

DELETE FROM public.member_allowed_emails WHERE email LIKE '%,%';

-- Also normalize any stray whitespace/casing so exact-match lookups work.
UPDATE public.member_allowed_emails
SET email = lower(trim(email))
WHERE email <> lower(trim(email));
