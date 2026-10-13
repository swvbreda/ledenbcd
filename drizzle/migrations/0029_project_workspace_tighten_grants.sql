REVOKE ALL ON public.internal_project_messages, public.internal_project_events, public.internal_project_checkpoints, public.internal_project_participants, public.internal_projects, public.internal_tasks FROM anon;
REVOKE UPDATE, DELETE ON public.internal_project_messages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.internal_project_events FROM authenticated;
REVOKE UPDATE ON public.internal_project_participants FROM authenticated;
REVOKE DELETE ON public.internal_projects, public.internal_tasks FROM authenticated;