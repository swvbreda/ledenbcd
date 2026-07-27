CREATE TABLE public.informer_field_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  field text NOT NULL,
  local_value text,
  informer_value text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, field)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.informer_field_diffs TO authenticated;
GRANT ALL ON public.informer_field_diffs TO service_role;

ALTER TABLE public.informer_field_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins en bestuur kunnen verschillen bekijken"
  ON public.informer_field_diffs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins en bestuur kunnen verschillen bijwerken"
  ON public.informer_field_diffs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins kunnen verschillen verwijderen"
  ON public.informer_field_diffs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_informer_field_diffs_updated_at
  BEFORE UPDATE ON public.informer_field_diffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();