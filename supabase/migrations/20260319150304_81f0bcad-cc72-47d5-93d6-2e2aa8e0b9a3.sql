
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  functie text NOT NULL,
  type text NOT NULL DEFAULT 'bestuurslid' CHECK (type IN ('bestuurslid', 'aspirant')),
  lid_id integer,
  email text,
  bond_email text,
  telefoon text,
  prive_adres text,
  prive_postcode text,
  prive_plaats text,
  geboortedatum text,
  coffeeshop text,
  coffeeshop_plaats text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read board members"
  ON public.board_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert board members"
  ON public.board_members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update board members"
  ON public.board_members FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete board members"
  ON public.board_members FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
