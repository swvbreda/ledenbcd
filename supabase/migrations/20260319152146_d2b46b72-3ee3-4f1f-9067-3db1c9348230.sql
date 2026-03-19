ALTER TABLE public.board_members ADD COLUMN lid_ids integer[] DEFAULT '{}';

-- Migrate existing lid_id values into lid_ids array
UPDATE public.board_members SET lid_ids = ARRAY[lid_id] WHERE lid_id IS NOT NULL;