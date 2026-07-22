
ALTER TABLE public.informer_sync_state
  ADD COLUMN IF NOT EXISTS last_debtor_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS public.informer_debtor_map (
  member_id integer PRIMARY KEY REFERENCES public.members_data(id) ON DELETE CASCADE,
  informer_debtor_id text NOT NULL UNIQUE,
  matched_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.informer_debtor_map TO authenticated;
GRANT ALL ON public.informer_debtor_map TO service_role;

ALTER TABLE public.informer_debtor_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view debtor map"
  ON public.informer_debtor_map FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage debtor map"
  ON public.informer_debtor_map FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_informer_debtor_map_updated_at
  BEFORE UPDATE ON public.informer_debtor_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
