ALTER TABLE public.internal_projects DROP CONSTRAINT internal_projects_status_check;
ALTER TABLE public.internal_projects ADD CONSTRAINT internal_projects_status_check CHECK (status = ANY (ARRAY['actief'::text, 'gepauzeerd'::text, 'afgerond'::text, 'te_bevestigen'::text]));
ALTER TABLE public.internal_projects ALTER COLUMN status SET DEFAULT 'te_bevestigen';