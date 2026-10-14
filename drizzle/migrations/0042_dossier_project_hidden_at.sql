ALTER TABLE public.dossier_register ADD COLUMN IF NOT EXISTS project_hidden_at timestamptz NULL;
COMMENT ON COLUMN public.dossier_register.project_hidden_at IS 'Alleen verborgen in het Projecten-dossieroverzicht; Jaarplan/Financien negeren dit veld.';
GRANT UPDATE (project_hidden_at) ON public.dossier_register TO authenticated;
CREATE POLICY "Admins verbergen dossiers in projectoverzicht" ON public.dossier_register
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));