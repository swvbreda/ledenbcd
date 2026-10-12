ALTER TABLE public.planner_project_links DROP CONSTRAINT IF EXISTS planner_project_links_plan_id_key;
ALTER TABLE public.planner_project_links
  ADD COLUMN bucket_id text CHECK (bucket_id ~ '^[A-Za-z0-9_-]{10,64}$'),
  ADD COLUMN bucket_name text,
  ADD COLUMN lock_token uuid,
  ADD COLUMN last_outcome text CHECK (last_outcome IN ('success','partial','failed'));
ALTER TABLE public.planner_project_links ADD CONSTRAINT planner_project_links_bucket_key UNIQUE (plan_id, bucket_id);
COMMENT ON COLUMN public.planner_project_links.bucket_id IS 'Verplicht voor synchronisatie (server-side afgedwongen); één bucket per BCD-project.';
ALTER TABLE public.planner_sync_log
  ADD COLUMN outcome text CHECK (outcome IN ('success','partial','failed')),
  ADD COLUMN warnings int NOT NULL DEFAULT 0;