ALTER TABLE public.agenda_participant_mail_batches ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.agenda_create_participant_mail_batch(uuid, uuid, text, text, uuid, jsonb);
CREATE FUNCTION public.agenda_create_participant_mail_batch(_batch_id uuid, _event_id uuid, _subject text, _body text, _created_by uuid, _recipients jsonb, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _new boolean;
BEGIN
  INSERT INTO public.agenda_participant_mail_batches(id, event_id, subject, body, created_by, attachments)
  VALUES (_batch_id, _event_id, _subject, _body, _created_by, COALESCE(_attachments, '[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _new = ROW_COUNT;
  IF _new THEN
    INSERT INTO public.agenda_participant_mail_sends(batch_id, event_id, email, naam, status)
    SELECT _batch_id, _event_id, lower(trim(r->>'email')), r->>'naam', 'pending'
    FROM jsonb_array_elements(_recipients) r
    ON CONFLICT (batch_id, email) DO NOTHING;
  END IF;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.agenda_create_participant_mail_batch(uuid, uuid, text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_create_participant_mail_batch(uuid, uuid, text, text, uuid, jsonb, jsonb) TO service_role;

CREATE POLICY "Admins upload agenda mail attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agenda-mail-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read agenda mail attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agenda-mail-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete agenda mail attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agenda-mail-attachments' AND public.has_role(auth.uid(), 'admin'));