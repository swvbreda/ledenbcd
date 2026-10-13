-- Projectwerkruimte: uitbreiding op internal_projects/internal_tasks (geen tweede systeem).
ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS project_plan text;
ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS budget_estimate numeric(12,2) CHECK (budget_estimate IS NULL OR budget_estimate >= 0);
ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS budget_reserved numeric(12,2) CHECK (budget_reserved IS NULL OR budget_reserved >= 0);
ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS budget_received numeric(12,2) CHECK (budget_received IS NULL OR budget_received >= 0);
COMMENT ON COLUMN public.internal_projects.budget_estimate IS 'Feitelijke raming; NULL = onbekend. Geen boekhouding.';
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS completed_by uuid;
COMMENT ON COLUMN public.internal_tasks.completed_by IS 'Server-side gezet bij afronden; NULL bij historische taken = niet geregistreerd.';

-- Wie afrondt, wordt server-side vastgelegd; clients kunnen dit niet zetten.
CREATE OR REPLACE FUNCTION public.internal_task_completed_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.completed_by := CASE WHEN NEW.status = 'afgerond' THEN auth.uid() END;
  ELSIF NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' THEN
    NEW.completed_by := auth.uid();
  ELSIF NEW.status = 'afgerond' THEN
    NEW.completed_by := OLD.completed_by;
  ELSE
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_task_completed_by() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_tasks_completed_by BEFORE INSERT OR UPDATE ON public.internal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.internal_task_completed_by();

-- Expliciete deelnemers
CREATE TABLE public.internal_project_participants (
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.internal_project_participants TO authenticated;
GRANT ALL ON public.internal_project_participants TO service_role;
ALTER TABLE public.internal_project_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read participants" ON public.internal_project_participants FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins add participants" ON public.internal_project_participants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins remove participants" ON public.internal_project_participants FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Berichten, notities, voortgang en bronupdates (alleen toevoegen)
CREATE TABLE public.internal_project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bericht','notitie','voortgang','bronupdate')),
  body text CHECK (body IS NULL OR length(body) <= 20000),
  author_id uuid,
  author_kind text NOT NULL DEFAULT 'medewerker' CHECK (author_kind IN ('medewerker','bronimport')),
  source_date timestamptz,
  source_subject text CHECK (source_subject IS NULL OR length(source_subject) <= 500),
  source_mailbox text CHECK (source_mailbox IS NULL OR length(source_mailbox) <= 320),
  source_ref text CHECK (source_ref IS NULL OR length(source_ref) <= 500),
  last_action text CHECK (last_action IS NULL OR length(last_action) <= 4000),
  next_step text CHECK (next_step IS NULL OR length(next_step) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'bronupdate' OR length(btrim(coalesce(body,''))) > 0),
  CHECK (kind <> 'bronupdate' OR (source_date IS NOT NULL
    AND length(btrim(coalesce(source_subject,''))) > 0 AND length(btrim(coalesce(source_mailbox,''))) > 0
    AND length(btrim(coalesce(source_ref,''))) > 0 AND length(btrim(coalesce(last_action,''))) > 0
    AND length(btrim(coalesce(next_step,''))) > 0))
);
CREATE INDEX internal_project_messages_project_idx ON public.internal_project_messages(project_id, created_at DESC);
CREATE UNIQUE INDEX internal_project_messages_source_uq ON public.internal_project_messages(project_id, source_ref) WHERE kind = 'bronupdate';
GRANT SELECT, INSERT ON public.internal_project_messages TO authenticated;
GRANT ALL ON public.internal_project_messages TO service_role;
ALTER TABLE public.internal_project_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read messages" ON public.internal_project_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins post messages" ON public.internal_project_messages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.internal_project_message_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid(); NEW.author_kind := 'medewerker';
  ELSIF current_user IN ('service_role','postgres','supabase_admin') OR coalesce(auth.role(),'') = 'service_role' THEN
    NEW.author_id := NULL; NEW.author_kind := 'bronimport';
  ELSE
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_project_message_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_project_messages_audit BEFORE INSERT ON public.internal_project_messages
  FOR EACH ROW EXECUTE FUNCTION public.internal_project_message_audit();

-- Controlepunten
CREATE TABLE public.internal_project_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','bezig','gereed','nvt')),
  owner_id uuid,
  due_date date,
  remarks text CHECK (remarks IS NULL OR length(remarks) <= 4000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX internal_project_checkpoints_project_idx ON public.internal_project_checkpoints(project_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_project_checkpoints TO authenticated;
GRANT ALL ON public.internal_project_checkpoints TO service_role;
ALTER TABLE public.internal_project_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read checkpoints" ON public.internal_project_checkpoints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert checkpoints" ON public.internal_project_checkpoints FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update checkpoints" ON public.internal_project_checkpoints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete checkpoints" ON public.internal_project_checkpoints FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.internal_project_row_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who uuid;
BEGIN
  who := CASE WHEN TG_TABLE_NAME = 'internal_project_participants' THEN NEW.user_id ELSE NEW.owner_id END;
  IF who IS NOT NULL AND NOT public.has_role(who,'admin') THEN
    RAISE EXCEPTION 'Alleen interne medewerkers (beheerders) zijn toegestaan';
  END IF;
  IF TG_TABLE_NAME = 'internal_project_participants' THEN
    NEW.added_by := auth.uid(); NEW.added_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_at := now(); NEW.updated_by := auth.uid(); NEW.updated_at := now();
  ELSE
    NEW.project_id := OLD.project_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid(); NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_project_row_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_project_checkpoints_audit BEFORE INSERT OR UPDATE ON public.internal_project_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.internal_project_row_audit();
CREATE TRIGGER internal_project_participants_audit BEFORE INSERT ON public.internal_project_participants
  FOR EACH ROW EXECUTE FUNCTION public.internal_project_row_audit();

-- Geschiedenis: alleen door triggers geschreven, clients lezen
CREATE TABLE public.internal_project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  task_id uuid,
  event_type text NOT NULL,
  summary text NOT NULL,
  actor_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('medewerker','bronimport','systeem')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX internal_project_events_project_idx ON public.internal_project_events(project_id, created_at DESC);
GRANT SELECT ON public.internal_project_events TO authenticated;
GRANT ALL ON public.internal_project_events TO service_role;
ALTER TABLE public.internal_project_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read events" ON public.internal_project_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.internal_project_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; tid uuid; typ text; s text; kind text;
BEGIN
  kind := CASE WHEN auth.uid() IS NOT NULL THEN 'medewerker' ELSE 'systeem' END;
  IF TG_TABLE_NAME = 'internal_projects' THEN
    pid := NEW.id;
    IF TG_OP = 'INSERT' THEN typ := 'project_aangemaakt'; s := 'Project aangemaakt';
    ELSE
      s := concat_ws('; ',
        CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN 'titel gewijzigd' END,
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status ' || NEW.status END,
        CASE WHEN NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN 'verantwoordelijke gewijzigd' END,
        CASE WHEN NEW.due_date IS DISTINCT FROM OLD.due_date THEN 'einddatum gewijzigd' END,
        CASE WHEN NEW.description IS DISTINCT FROM OLD.description OR NEW.project_plan IS DISTINCT FROM OLD.project_plan THEN 'projectplan bijgewerkt' END,
        CASE WHEN (NEW.budget_estimate, NEW.budget_reserved, NEW.budget_received) IS DISTINCT FROM (OLD.budget_estimate, OLD.budget_reserved, OLD.budget_received) THEN 'budget bijgewerkt' END,
        CASE WHEN NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN CASE WHEN NEW.archived_at IS NULL THEN 'teruggezet' ELSE 'gearchiveerd' END END);
      IF s = '' THEN RETURN NULL; END IF;
      typ := 'project_gewijzigd'; s := 'Project: ' || s;
    END IF;
  ELSIF TG_TABLE_NAME = 'internal_tasks' THEN
    tid := NEW.id; pid := NEW.project_id;
    IF TG_OP = 'INSERT' THEN typ := 'taak_aangemaakt'; s := 'Taak aangemaakt: ' || NEW.title;
    ELSE
      IF NEW.project_id IS DISTINCT FROM OLD.project_id AND OLD.project_id IS NOT NULL THEN
        INSERT INTO public.internal_project_events(project_id, task_id, event_type, summary, actor_id, actor_kind)
        VALUES (OLD.project_id, NEW.id, 'taak_verplaatst', 'Taak uit project gehaald: ' || NEW.title, auth.uid(), kind);
      END IF;
      s := concat_ws('; ',
        CASE WHEN NEW.project_id IS DISTINCT FROM OLD.project_id THEN 'aan project gekoppeld' END,
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status ' || NEW.status END,
        CASE WHEN NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN CASE WHEN NEW.assignee_id IS NULL THEN 'niet meer toegewezen' ELSE 'toegewezen' END END,
        CASE WHEN NEW.deadline IS DISTINCT FROM OLD.deadline THEN 'deadline gewijzigd' END);
      IF s = '' THEN RETURN NULL; END IF;
      typ := 'taak_gewijzigd'; s := 'Taak ' || NEW.title || ': ' || s;
    END IF;
    IF pid IS NULL THEN RETURN NULL; END IF;
  ELSIF TG_TABLE_NAME = 'internal_project_checkpoints' THEN
    IF TG_OP = 'DELETE' THEN pid := OLD.project_id; typ := 'controlepunt_verwijderd'; s := 'Controlepunt verwijderd: ' || OLD.title;
    ELSIF TG_OP = 'INSERT' THEN pid := NEW.project_id; typ := 'controlepunt_toegevoegd'; s := 'Controlepunt toegevoegd: ' || NEW.title;
    ELSE pid := NEW.project_id; typ := 'controlepunt_gewijzigd'; s := 'Controlepunt bijgewerkt: ' || NEW.title || CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN ' (' || NEW.status || ')' ELSE '' END;
    END IF;
  ELSIF TG_TABLE_NAME = 'internal_project_messages' THEN
    pid := NEW.project_id; typ := NEW.kind || '_geplaatst';
    kind := CASE WHEN NEW.author_kind = 'bronimport' THEN 'bronimport' ELSE kind END;
    s := CASE NEW.kind WHEN 'bronupdate' THEN 'Bronupdate: ' || NEW.source_subject WHEN 'notitie' THEN 'Notitie geplaatst' WHEN 'voortgang' THEN 'Voortgang bijgewerkt' ELSE 'Bericht geplaatst' END;
  ELSIF TG_TABLE_NAME = 'internal_project_participants' THEN
    IF TG_OP = 'DELETE' THEN pid := OLD.project_id; typ := 'deelnemer_verwijderd'; s := 'Deelnemer verwijderd';
    ELSE pid := NEW.project_id; typ := 'deelnemer_toegevoegd'; s := 'Deelnemer toegevoegd'; END IF;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.internal_projects WHERE id = pid) THEN RETURN NULL; END IF;
  INSERT INTO public.internal_project_events(project_id, task_id, event_type, summary, actor_id, actor_kind)
  VALUES (pid, tid, typ, left(s, 500), auth.uid(), kind);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.internal_project_log() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_projects_log AFTER INSERT OR UPDATE ON public.internal_projects FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();
CREATE TRIGGER internal_tasks_log AFTER INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();
CREATE TRIGGER internal_project_checkpoints_log AFTER INSERT OR UPDATE OR DELETE ON public.internal_project_checkpoints FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();
CREATE TRIGGER internal_project_messages_log AFTER INSERT ON public.internal_project_messages FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();
CREATE TRIGGER internal_project_participants_log AFTER INSERT OR DELETE ON public.internal_project_participants FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();

-- Taak oppakken: atomair, alleen voor jezelf, nooit van een andere uitvoerder overnemen.
CREATE OR REPLACE FUNCTION public.claim_internal_task(_task_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  UPDATE public.internal_tasks
     SET assignee_id = auth.uid(), status = CASE WHEN status = 'te_doen' THEN 'bezig' ELSE status END
   WHERE id = _task_id AND assignee_id IS NULL AND status <> 'afgerond';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;
REVOKE ALL ON FUNCTION public.claim_internal_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_internal_task(uuid) TO authenticated;

-- Namen van interne accounts (alleen admins); naam alleen uit het account zelf.
CREATE OR REPLACE FUNCTION public.list_internal_staff_names()
RETURNS TABLE(user_id uuid, email text, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, nullif(btrim(u.raw_user_meta_data->>'full_name'), '') FROM auth.users u
  WHERE public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
  ORDER BY u.email
$$;
REVOKE ALL ON FUNCTION public.list_internal_staff_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_staff_names() TO authenticated;

-- Geen pushmelding aan jezelf bij zelf oppakken/toewijzen.
CREATE OR REPLACE FUNCTION public.internal_task_assignment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NULL; END IF;
  IF NEW.status = 'afgerond' THEN RETURN NULL; END IF;
  IF NEW.assignee_id = auth.uid() THEN RETURN NULL; END IF;
  IF NOT public.has_role(NEW.assignee_id, 'admin') THEN RETURN NULL; END IF;
  INSERT INTO public.task_notifications (recipient_id, task_id, event_key)
  VALUES (NEW.assignee_id, NEW.id, NEW.id::text || ':' || NEW.assignee_id::text || ':' || txid_current()::text)
  ON CONFLICT (event_key) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.internal_task_assignment_notify() FROM PUBLIC, anon, authenticated;