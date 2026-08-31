DELETE FROM public.beleidsmonitor_dossiers a
USING public.beleidsmonitor_dossiers b
WHERE a.extern_id IS NOT NULL
  AND a.extern_id = b.extern_id
  AND (a.fetched_at, a.id) < (b.fetched_at, b.id);

ALTER TABLE public.beleidsmonitor_dossiers
  ADD CONSTRAINT beleidsmonitor_dossiers_extern_id_key UNIQUE (extern_id);