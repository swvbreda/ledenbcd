REVOKE ALL ON public.dossier_register, public.dossier_finance_aliases, public.dossier_project_links FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.dossier_project_links FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dossier_register, public.dossier_finance_aliases FROM authenticated;