ALTER TABLE public.agenda_participant_mail_sends DROP CONSTRAINT agenda_participant_mail_sends_status_check;
ALTER TABLE public.agenda_participant_mail_sends
  ADD CONSTRAINT agenda_participant_mail_sends_status_check
  CHECK (status IN ('pending','claimed','sent','accepted','skipped','failed','uncertain'));
ALTER TABLE public.agenda_participant_mail_sends ADD COLUMN IF NOT EXISTS naam text;

DROP FUNCTION IF EXISTS public.agenda_claim_participant_mail(uuid, uuid, text[]);

-- Maakt batch + vaste ontvangerssnapshot atomair aan; bij bestaande batch niets wijzigen.
CREATE OR REPLACE FUNCTION public.agenda_create_participant_mail_batch(
  _batch_id uuid, _event_id uuid, _subject text, _body text, _created_by uuid, _recipients jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _new boolean;
BEGIN
  INSERT INTO public.agenda_participant_mail_batches(id, event_id, subject, body, created_by)
  VALUES (_batch_id, _event_id, _subject, _body, _created_by)
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

-- Claimt alleen snapshot-ontvangers die nog wachten of definitief mislukt zijn,
-- en die nu nog deelnemer zijn (_still_active). Nooit nieuwe adressen.
CREATE OR REPLACE FUNCTION public.agenda_claim_participant_mail(_batch_id uuid, _still_active text[])
RETURNS TABLE(email text)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.agenda_participant_mail_sends s
  SET status = 'claimed', note = NULL
  WHERE s.batch_id = _batch_id
    AND s.status IN ('pending','failed')
    AND s.email = ANY(_still_active)
  RETURNING s.email;
$$;

REVOKE ALL ON FUNCTION public.agenda_create_participant_mail_batch(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_claim_participant_mail(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_create_participant_mail_batch(uuid, uuid, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_claim_participant_mail(uuid, text[]) TO service_role;