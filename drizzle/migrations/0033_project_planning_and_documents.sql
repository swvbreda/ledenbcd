ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS planning text, ADD COLUMN IF NOT EXISTS planning_date date, ADD COLUMN IF NOT EXISTS remarks text;

CREATE TABLE public.internal_project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.internal_projects(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  doc_type text NOT NULL CHECK (doc_type IN ('gespreksverslag','brief','overig')),
  document_date date,
  original_filename text NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 300),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  object_path text NOT NULL UNIQUE,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid,
  UNIQUE (project_id, sha256)
);
GRANT SELECT, INSERT, UPDATE ON public.internal_project_documents TO authenticated;
GRANT ALL ON public.internal_project_documents TO service_role;
ALTER TABLE public.internal_project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read project documents" ON public.internal_project_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins add project documents" ON public.internal_project_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins archive project documents" ON public.internal_project_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.internal_project_document_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE ext text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    ext := CASE NEW.mime_type WHEN 'application/pdf' THEN 'pdf'
      WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx' ELSE 'xlsx' END;
    IF NEW.object_path IS DISTINCT FROM NEW.project_id::text || '/' || NEW.sha256 || '.' || ext THEN
      RAISE EXCEPTION 'Ongeldig documentpad';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'project-documents' AND o.name = NEW.object_path) THEN
      RAISE EXCEPTION 'Bestand is niet (volledig) geüpload';
    END IF;
    NEW.title := btrim(NEW.title);
    NEW.uploaded_by := auth.uid(); NEW.created_at := now(); NEW.archived_at := NULL; NEW.archived_by := NULL;
  ELSE
    IF (NEW.project_id, NEW.title, NEW.doc_type, NEW.document_date, NEW.original_filename, NEW.size_bytes, NEW.mime_type, NEW.sha256, NEW.object_path, NEW.uploaded_by, NEW.created_at)
       IS DISTINCT FROM (OLD.project_id, OLD.title, OLD.doc_type, OLD.document_date, OLD.original_filename, OLD.size_bytes, OLD.mime_type, OLD.sha256, OLD.object_path, OLD.uploaded_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Documentgegevens zijn onveranderlijk; alleen archiveren is toegestaan';
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      IF NEW.archived_at IS NULL THEN NEW.archived_by := NULL; ELSE NEW.archived_at := now(); NEW.archived_by := auth.uid(); END IF;
    ELSE NEW.archived_by := OLD.archived_by; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER internal_project_documents_guard BEFORE INSERT OR UPDATE ON public.internal_project_documents FOR EACH ROW EXECUTE FUNCTION public.internal_project_document_guard();

CREATE OR REPLACE FUNCTION public.internal_project_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
CREATE TRIGGER internal_project_documents_log AFTER INSERT OR UPDATE ON public.internal_project_documents FOR EACH ROW EXECUTE FUNCTION public.internal_project_log();

CREATE POLICY "Admins read project document files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-documents' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins upload project document files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents' AND public.has_role(auth.uid(),'admin')
    AND lower(storage.extension(name)) IN ('pdf','docx','xlsx')
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.internal_projects)
    AND array_length(storage.foldername(name),1) = 1
    AND split_part(storage.filename(name),'.',1) ~ '^[0-9a-f]{64}$');