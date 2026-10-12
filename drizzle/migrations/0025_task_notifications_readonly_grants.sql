REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.task_notifications FROM authenticated, anon, PUBLIC;
REVOKE ALL ON public.task_notifications FROM anon;
GRANT SELECT ON public.task_notifications TO authenticated;