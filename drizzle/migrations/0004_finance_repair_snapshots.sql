CREATE TABLE public.finance_repair_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  table_name text NOT NULL,
  row_key text NOT NULL,
  before_row jsonb,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.finance_repair_snapshots IS 'Herstelbare momentopnames van rijen vóór administratieve correcties (alleen admin).';
GRANT SELECT ON public.finance_repair_snapshots TO authenticated;
GRANT ALL ON public.finance_repair_snapshots TO service_role;
ALTER TABLE public.finance_repair_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view repair snapshots" ON public.finance_repair_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX finance_repair_snapshots_batch_idx ON public.finance_repair_snapshots(batch, table_name);