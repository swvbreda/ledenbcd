CREATE TABLE public.bcd_documenten_rate (
  user_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.bcd_documenten_rate TO service_role;
REVOKE ALL ON public.bcd_documenten_rate FROM anon, authenticated;
ALTER TABLE public.bcd_documenten_rate ENABLE ROW LEVEL SECURITY;

-- Telt een documentverzoek voor de aanroeper; false = limiet (60/min) bereikt.
CREATE OR REPLACE FUNCTION public.bcd_documenten_rate_hit()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _hits int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.bcd_documenten_rate AS r (user_id, window_start, hits) VALUES (_uid, now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    hits = CASE WHEN r.window_start < now() - interval '1 minute' THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - interval '1 minute' THEN now() ELSE r.window_start END
  RETURNING hits INTO _hits;
  RETURN _hits <= 60;
END $$;
REVOKE ALL ON FUNCTION public.bcd_documenten_rate_hit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bcd_documenten_rate_hit() TO authenticated;