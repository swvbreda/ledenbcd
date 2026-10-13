ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS status_date date;
COMMENT ON COLUMN public.internal_projects.status_date IS 'Datum waarop de beschreven status gold; handmatig, nooit automatisch gevuld.';
CREATE OR REPLACE FUNCTION public.internal_project_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid; tid uuid; typ text; s text; kind text;
BEGIN
  kind := CASE WHEN auth.uid() IS NOT NULL THEN 'medewerker' ELSE 'systeem' END;
  IF TG_OP = 'INSERT' AND auth.uid() IS NULL AND TG_TABLE_NAME IN ('internal_projects','internal_tasks') THEN kind := 'bronimport'; END IF;
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
        CASE WHEN NEW.planning IS DISTINCT FROM OLD.planning OR NEW.planning_date IS DISTINCT FROM OLD.planning_date THEN 'planning bijgewerkt' END,
        CASE WHEN NEW.status_date IS DISTINCT FROM OLD.status_date THEN 'statusdatum gewijzigd' END,
        CASE WHEN NEW.remarks IS DISTINCT FROM OLD.remarks THEN 'opmerkingen bijgewerkt' END,
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
        CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN 'titel gewijzigd (was: ' || left(OLD.title, 120) || ')' END,
        CASE WHEN NEW.description IS DISTINCT FROM OLD.description THEN 'omschrijving gewijzigd' END,
        CASE WHEN NEW.priority IS DISTINCT FROM OLD.priority THEN 'prioriteit ' || NEW.priority END,
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
  ELSIF TG_TABLE_NAME = 'internal_project_documents' THEN
    pid := NEW.project_id;
    IF TG_OP = 'INSERT' THEN typ := 'document_toegevoegd'; s := 'Document toegevoegd: ' || NEW.title;
    ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      typ := 'document_gearchiveerd'; s := CASE WHEN NEW.archived_at IS NULL THEN 'Document teruggezet: ' ELSE 'Document gearchiveerd: ' END || NEW.title;
    ELSE RETURN NULL; END IF;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.internal_projects WHERE id = pid) THEN RETURN NULL; END IF;
  INSERT INTO public.internal_project_events(project_id, task_id, event_type, summary, actor_id, actor_kind)
  VALUES (pid, tid, typ, left(s, 500), auth.uid(), kind);
  RETURN NULL;
END $function$;