CREATE TABLE public.community_self_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_name text,
  full_name text NOT NULL,
  phone text NOT NULL,
  coffeeshop_name text,
  city text,
  email text,
  note text,
  status text NOT NULL DEFAULT 'nieuw',
  member_id integer,
  participant_id uuid,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.community_self_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_self_links TO authenticated;
GRANT ALL ON public.community_self_links TO service_role;

ALTER TABLE public.community_self_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a self link"
ON public.community_self_links FOR INSERT TO anon, authenticated
WITH CHECK (status = 'nieuw' AND member_id IS NULL AND processed_by IS NULL);

CREATE POLICY "Board can view self links"
ON public.community_self_links FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Board can update self links"
ON public.community_self_links FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Board can delete self links"
ON public.community_self_links FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE TRIGGER update_community_self_links_updated_at
BEFORE UPDATE ON public.community_self_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();