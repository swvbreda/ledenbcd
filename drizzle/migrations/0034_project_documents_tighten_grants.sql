REVOKE ALL ON public.internal_project_documents FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.internal_project_documents FROM authenticated;