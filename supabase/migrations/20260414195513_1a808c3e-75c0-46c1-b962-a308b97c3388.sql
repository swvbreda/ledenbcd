ALTER TABLE public.internal_declarations
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN reviewed_at timestamptz;

UPDATE public.internal_declarations SET status = 'approved' WHERE status = 'pending';

ALTER TABLE public.internal_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert own declarations"
  ON public.internal_declarations FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users see own or admins see all declarations"
  ON public.internal_declarations FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update declarations"
  ON public.internal_declarations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete declarations"
  ON public.internal_declarations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));