CREATE TABLE public.agenda_participant_mail_batches (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.agenda_participant_mail_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.agenda_participant_mail_batches(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('claimed','sent','skipped','failed')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, email)
);
GRANT ALL ON public.agenda_participant_mail_batches TO service_role;
GRANT ALL ON public.agenda_participant_mail_sends TO service_role;
ALTER TABLE public.agenda_participant_mail_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_participant_mail_sends ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_agenda_participant_mail_sends_updated
BEFORE UPDATE ON public.agenda_participant_mail_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomaire claim: nieuwe adressen of eerder mislukte; nooit 'claimed', 'sent' of 'skipped'.
CREATE OR REPLACE FUNCTION public.agenda_claim_participant_mail(_batch_id uuid, _event_id uuid, _emails text[])
RETURNS TABLE(email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ins AS (
    INSERT INTO public.agenda_participant_mail_sends(batch_id, event_id, email, status)
    SELECT _batch_id, _event_id, e, 'claimed' FROM unnest(_emails) AS e
    ON CONFLICT (batch_id, email) DO NOTHING
    RETURNING agenda_participant_mail_sends.email
  ), upd AS (
    UPDATE public.agenda_participant_mail_sends s SET status = 'claimed', note = NULL
    WHERE s.batch_id = _batch_id AND s.status = 'failed' AND s.email = ANY(_emails)
    RETURNING s.email
  )
  SELECT ins.email FROM ins UNION SELECT upd.email FROM upd;
END $$;
REVOKE ALL ON FUNCTION public.agenda_claim_participant_mail(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_claim_participant_mail(uuid, uuid, text[]) TO service_role;