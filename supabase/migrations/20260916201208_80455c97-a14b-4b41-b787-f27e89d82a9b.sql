CREATE TABLE public.shop_logo_optout (
  register_id uuid PRIMARY KEY REFERENCES public.coffeeshop_register(id) ON DELETE CASCADE,
  member_id integer,
  uitgezet_op timestamptz NOT NULL DEFAULT now(),
  uitgezet_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_logo_optout TO authenticated;
GRANT ALL ON public.shop_logo_optout TO service_role;

ALTER TABLE public.shop_logo_optout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beheer en bestuur beheren logo-optout"
  ON public.shop_logo_optout FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_shop_logo_optout_updated_at
  BEFORE UPDATE ON public.shop_logo_optout
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();