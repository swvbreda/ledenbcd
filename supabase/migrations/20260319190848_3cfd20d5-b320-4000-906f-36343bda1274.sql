
-- Drop the problematic view
DROP VIEW IF EXISTS public.board_members_public;

-- Create RPC function that returns only safe fields (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_board_members_public()
RETURNS TABLE (
  id uuid,
  naam text,
  functie text,
  type text,
  sort_order integer,
  lid_id integer,
  lid_ids integer[],
  email text,
  bond_email text,
  telefoon text,
  coffeeshop text,
  coffeeshop_plaats text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, naam, functie, type, sort_order, lid_id, lid_ids,
         email, bond_email, telefoon, coffeeshop, coffeeshop_plaats,
         created_at, updated_at
  FROM public.board_members
  ORDER BY sort_order;
$$;
