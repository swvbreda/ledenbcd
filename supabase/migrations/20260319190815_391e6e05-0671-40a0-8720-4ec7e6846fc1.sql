
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone authenticated can read board members" ON public.board_members;

-- Add admin-only SELECT policy (admins already have one for other operations)
CREATE POLICY "Admins can read all board member data"
  ON public.board_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create a public view with only non-sensitive fields
CREATE OR REPLACE VIEW public.board_members_public AS
  SELECT id, naam, functie, type, sort_order, lid_id, lid_ids,
         email, bond_email, telefoon, coffeeshop, coffeeshop_plaats,
         created_at, updated_at
  FROM public.board_members;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.board_members_public TO authenticated;
