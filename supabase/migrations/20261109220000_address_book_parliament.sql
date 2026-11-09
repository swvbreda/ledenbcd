-- Parliamentary context remains inside the existing internal address book.
-- Existing row-level policies and privileges continue to apply unchanged.
ALTER TABLE public.address_book_contacts
  ADD COLUMN IF NOT EXISTS party text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS committees text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS policy_areas text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.address_book_contacts.party IS 'Political party or parliamentary group, when applicable.';
COMMENT ON COLUMN public.address_book_contacts.committees IS 'Verified committee memberships and roles, one per line.';
COMMENT ON COLUMN public.address_book_contacts.policy_areas IS 'Verified staff policy responsibilities, one per line; not committee memberships.';
