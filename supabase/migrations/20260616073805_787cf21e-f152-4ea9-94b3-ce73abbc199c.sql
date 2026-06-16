
-- Helper: is current user a board member?
CREATE OR REPLACE FUNCTION public.is_board_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm
    JOIN public.member_profiles mp ON mp.user_id = _user_id
    WHERE bm.lid_id = mp.member_id
       OR mp.member_id = ANY(COALESCE(bm.lid_ids, '{}'::integer[]))
  )
$$;

-- Per-member WhatsApp community status
CREATE TABLE public.member_whatsapp_status (
  member_id integer PRIMARY KEY,
  in_community boolean NOT NULL DEFAULT false,
  matched_phone text,
  matched_name text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_whatsapp_status TO authenticated;
GRANT ALL ON public.member_whatsapp_status TO service_role;

ALTER TABLE public.member_whatsapp_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board and admins can read whatsapp status"
  ON public.member_whatsapp_status FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Board and admins can insert whatsapp status"
  ON public.member_whatsapp_status FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Board and admins can update whatsapp status"
  ON public.member_whatsapp_status FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Board and admins can delete whatsapp status"
  ON public.member_whatsapp_status FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE TRIGGER update_member_whatsapp_status_updated_at
  BEFORE UPDATE ON public.member_whatsapp_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
