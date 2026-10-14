ALTER TABLE public.dossier_register ADD COLUMN IF NOT EXISTS status_summary text NULL;
ALTER TABLE public.dossier_register ADD COLUMN IF NOT EXISTS status_date date NULL;
COMMENT ON COLUMN public.dossier_register.status_summary IS 'Handmatig geschreven algemene dossierstatus (Projecten-overzicht); nooit afgeleid uit taken/projecten.';
COMMENT ON COLUMN public.dossier_register.status_date IS 'Datum van de handmatige algemene dossierstatus; onafhankelijk nullable.';
GRANT UPDATE (status_summary, status_date) ON public.dossier_register TO authenticated;