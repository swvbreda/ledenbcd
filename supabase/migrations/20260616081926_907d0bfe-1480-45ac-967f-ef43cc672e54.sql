
CREATE TABLE public.whatsapp_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  phone text,
  note text,
  member_id integer REFERENCES public.members_data(id) ON DELETE SET NULL,
  sort_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_participants TO authenticated;
GRANT ALL ON public.whatsapp_participants TO service_role;

ALTER TABLE public.whatsapp_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board and admins can read wa participants" ON public.whatsapp_participants
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));
CREATE POLICY "Board and admins can insert wa participants" ON public.whatsapp_participants
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));
CREATE POLICY "Board and admins can update wa participants" ON public.whatsapp_participants
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));
CREATE POLICY "Board and admins can delete wa participants" ON public.whatsapp_participants
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));

CREATE TRIGGER update_whatsapp_participants_updated_at
  BEFORE UPDATE ON public.whatsapp_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_whatsapp_participants_member_id ON public.whatsapp_participants(member_id);
