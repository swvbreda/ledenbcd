CREATE TABLE public.declaration_push_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.declaration_push_settings TO authenticated;
GRANT ALL ON public.declaration_push_settings TO service_role;
ALTER TABLE public.declaration_push_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Beheerders lezen declaratiepush-instelling" ON public.declaration_push_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.declaration_push_settings (id, enabled) VALUES (true, false) ON CONFLICT DO NOTHING;

CREATE TABLE public.declaration_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid NOT NULL REFERENCES public.internal_declarations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  submission_no integer NOT NULL,
  event_key text NOT NULL UNIQUE,
  push_status text NOT NULL DEFAULT 'pending' CHECK (push_status IN ('pending','sending','sent','no_devices','failed','skipped')),
  push_attempts integer NOT NULL DEFAULT 0,
  push_last_attempt_at timestamptz,
  push_sent integer NOT NULL DEFAULT 0,
  push_total integer NOT NULL DEFAULT 0,
  push_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX declaration_notifications_decl_idx ON public.declaration_notifications(declaration_id);
GRANT SELECT ON public.declaration_notifications TO authenticated;
GRANT ALL ON public.declaration_notifications TO service_role;
ALTER TABLE public.declaration_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eigen declaratiemeldingen lezen" ON public.declaration_notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.declaration_push_recipients()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(r), '{}') FROM unnest(ARRAY[
    'a7fce7fa-600b-48ef-8faf-7aea6918660a'::uuid,
    '15adafb2-cb6a-4212-8604-68d27814ba59'::uuid
  ]) r WHERE public.is_declaration_approver(r)
$$;
REVOKE ALL ON FUNCTION public.declaration_push_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.declaration_push_recipients() TO service_role;

CREATE OR REPLACE FUNCTION public.declaration_submit_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; r uuid;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN RETURN NULL; END IF;
  IF NOT coalesce((SELECT enabled FROM public.declaration_push_settings WHERE id), false) THEN RETURN NULL; END IF;
  SELECT coalesce(max(submission_no), 0) + 1 INTO n FROM public.declaration_notifications WHERE declaration_id = NEW.id;
  FOREACH r IN ARRAY public.declaration_push_recipients() LOOP
    IF r = auth.uid() THEN CONTINUE; END IF;
    INSERT INTO public.declaration_notifications (declaration_id, recipient_id, submission_no, event_key)
    VALUES (NEW.id, r, n, NEW.id::text || ':' || n::text || ':' || r::text)
    ON CONFLICT (event_key) DO NOTHING;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'declaration_submit_notify: %', SQLERRM;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.declaration_submit_notify() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER zz_declaration_submit_notify
  AFTER INSERT OR UPDATE OF status ON public.internal_declarations
  FOR EACH ROW EXECUTE FUNCTION public.declaration_submit_notify();