
-- 1. Gedeelde bevestigingspoort: één claim per bijeenkomst + genormaliseerd adres,
--    ongeacht via welk kanaal de bevestiging loopt.
CREATE TABLE public.agenda_confirmation_gate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'attempted',
  first_channel text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

GRANT SELECT ON public.agenda_confirmation_gate TO authenticated;
GRANT ALL ON public.agenda_confirmation_gate TO service_role;

ALTER TABLE public.agenda_confirmation_gate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bestuur en beheer lezen bevestigingspoort"
ON public.agenda_confirmation_gate
FOR SELECT
TO authenticated
USING (public.is_board_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER agenda_confirmation_gate_updated_at
BEFORE UPDATE ON public.agenda_confirmation_gate
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Conservatieve seeding uit alle bestaande kanaalgeschiedenis.
INSERT INTO public.agenda_confirmation_gate (event_id, email, status, first_channel, note)
SELECT l.event_id,
       public.agenda_normalize_email(l.email) AS email,
       'sent',
       min(l.channel),
       'seed:agenda_invite_ledger'
FROM public.agenda_invite_ledger l
WHERE public.agenda_normalize_email(l.email) IS NOT NULL
GROUP BY l.event_id, public.agenda_normalize_email(l.email)
ON CONFLICT (event_id, email) DO NOTHING;

-- 3. Atomisch claimen; kanaalgeschiedenis blijft apart bewaard.
CREATE OR REPLACE FUNCTION public.agenda_claim_confirmations(
  _event_id uuid,
  _channel text,
  _emails text[],
  _source text DEFAULT NULL
)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fresh text[];
BEGIN
  WITH norm AS (
    SELECT DISTINCT public.agenda_normalize_email(x) AS e
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS x
  ),
  ins AS (
    INSERT INTO public.agenda_confirmation_gate (event_id, email, status, first_channel, note)
    SELECT _event_id, n.e, 'attempted', _channel, _source
    FROM norm n
    WHERE n.e IS NOT NULL
    ON CONFLICT (event_id, email) DO NOTHING
    RETURNING public.agenda_confirmation_gate.email AS e
  )
  SELECT array_agg(ins.e) INTO fresh FROM ins;

  fresh := coalesce(fresh, ARRAY[]::text[]);

  INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source)
  SELECT _event_id, _channel, u, _source
  FROM unnest(fresh) AS u
  ON CONFLICT (event_id, channel, email) DO NOTHING;

  RETURN QUERY SELECT u FROM unnest(fresh) AS u;
END;
$$;

-- 4. Uitkomst vastleggen. Verwijdert nooit een claim: een onzekere aflevering
--    mag nooit automatisch opnieuw geprobeerd worden.
CREATE OR REPLACE FUNCTION public.agenda_mark_confirmations(
  _event_id uuid,
  _emails text[],
  _status text,
  _note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  IF _status NOT IN ('sent', 'uncertain') THEN
    RAISE EXCEPTION 'ongeldige status %', _status;
  END IF;

  UPDATE public.agenda_confirmation_gate g
  SET status = _status,
      note = coalesce(_note, g.note),
      updated_at = now()
  WHERE g.event_id = _event_id
    AND g.status <> 'sent'
    AND g.email IN (
      SELECT public.agenda_normalize_email(x) FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS x
    );

  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_claim_confirmations(uuid, text, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_mark_confirmations(uuid, text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_claim_confirmations(uuid, text, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_mark_confirmations(uuid, text[], text, text) TO service_role;

-- 5. Eén gekozen bevestigingskanaal.
ALTER TABLE public.agenda_outlook_settings
  ADD COLUMN IF NOT EXISTS confirmation_channel text NOT NULL DEFAULT 'email';
