-- 1. Ledger: at-most-once per bijeenkomst + kanaal + genormaliseerd adres
CREATE TABLE IF NOT EXISTS public.agenda_invite_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('outlook', 'email')),
  email text NOT NULL,
  source text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_invite_ledger_unique
  ON public.agenda_invite_ledger (event_id, channel, email);

GRANT SELECT ON public.agenda_invite_ledger TO authenticated;
GRANT ALL ON public.agenda_invite_ledger TO service_role;
ALTER TABLE public.agenda_invite_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board and admin can read invite ledger" ON public.agenda_invite_ledger;
CREATE POLICY "Board and admin can read invite ledger"
  ON public.agenda_invite_ledger FOR SELECT TO authenticated
  USING (public.has_role((select auth.uid()), 'admin') OR public.is_board_member((select auth.uid())));

-- 2. Normalisatie van ontvangeradressen
CREATE OR REPLACE FUNCTION public.agenda_normalize_email(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(btrim(lower(regexp_replace(coalesce(_email, ''), '^.*<|>.*$', '', 'g'))), '')
$$;

-- 3. Kill switch voor agenda-updates door nieuwe/gewijzigde aanmeldingen
CREATE TABLE IF NOT EXISTS public.agenda_outlook_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  registration_sync_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agenda_outlook_settings TO authenticated;
GRANT ALL ON public.agenda_outlook_settings TO service_role;
ALTER TABLE public.agenda_outlook_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board and admin can read agenda outlook settings" ON public.agenda_outlook_settings;
CREATE POLICY "Board and admin can read agenda outlook settings"
  ON public.agenda_outlook_settings FOR SELECT TO authenticated
  USING (public.has_role((select auth.uid()), 'admin') OR public.is_board_member((select auth.uid())));

INSERT INTO public.agenda_outlook_settings (id, registration_sync_enabled, updated_at)
VALUES (true, false, now())
ON CONFLICT (id) DO UPDATE SET registration_sync_enabled = false, updated_at = now();

-- 4. Atomair claimen: geeft alleen adressen terug die nog nooit een bevestiging kregen
CREATE OR REPLACE FUNCTION public.agenda_claim_invites(
  _event_id uuid,
  _channel text,
  _emails text[],
  _source text DEFAULT NULL
)
RETURNS TABLE (email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source)
  SELECT _event_id, _channel, e, _source
  FROM (
    SELECT DISTINCT public.agenda_normalize_email(x) AS e
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS x
  ) s
  WHERE s.e IS NOT NULL
  ON CONFLICT (event_id, channel, email) DO NOTHING
  RETURNING public.agenda_invite_ledger.email;
$$;

REVOKE ALL ON FUNCTION public.agenda_claim_invites(uuid, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_claim_invites(uuid, text, text[], text) TO authenticated, service_role;

-- 5. Dispatch respecteert de schakelaar voor aanmeldingsgestuurde syncs
CREATE OR REPLACE FUNCTION public.agenda_outlook_dispatch(_event_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  req_id bigint;
  allowed boolean;
BEGIN
  IF _action = 'attendees' THEN
    SELECT registration_sync_enabled INTO allowed FROM public.agenda_outlook_settings WHERE id;
    IF NOT coalesce(allowed, false) THEN
      RETURN;
    END IF;
  END IF;

  SELECT net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/agenda-outlook-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('event_id', _event_id, 'action', _action)
  ) INTO req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'agenda outlook dispatch failed: %', SQLERRM;
END;
$function$;

-- Aanmeldingen sturen voortaan de 'attendees'-variant (valt onder de schakelaar)
CREATE OR REPLACE FUNCTION public.agenda_registrations_outlook_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ev_id uuid := COALESCE(NEW.event_id, OLD.event_id);
  ev_type text;
BEGIN
  SELECT event_type INTO ev_type FROM public.agenda_events WHERE id = ev_id;
  IF ev_type = 'evenement' THEN
    PERFORM public.agenda_outlook_dispatch(ev_id, 'attendees');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 6. Seed: iedereen die al een agenda-uitnodiging of bevestigingsmail kreeg
INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source, sent_at)
SELECT DISTINCT ON (ev_id, em)
  ev_id, 'outlook', em, 'seed:outlook_sync_log', min_started
FROM (
  SELECT
    (l.details->>'event_id')::uuid AS ev_id,
    public.agenda_normalize_email(a->>0) AS em,
    l.started_at AS min_started
  FROM public.outlook_sync_log l
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(l.details->'verify'->'attendee_responses', '[]'::jsonb)) AS a
  WHERE l.trigger = 'agenda-outlook'
) s
WHERE ev_id IS NOT NULL AND em IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = ev_id)
ORDER BY ev_id, em, min_started
ON CONFLICT (event_id, channel, email) DO NOTHING;

INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source, sent_at)
SELECT DISTINCT ON (r.event_id, em)
  r.event_id, 'outlook', em, 'seed:registrations_invited', now()
FROM public.agenda_registrations r
CROSS JOIN LATERAL public.agenda_normalize_email(r.outlook_attendee_email) AS em
WHERE r.outlook_state = 'invited' AND em IS NOT NULL
ORDER BY r.event_id, em
ON CONFLICT (event_id, channel, email) DO NOTHING;

INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source, sent_at)
SELECT DISTINCT ON (ev_id, em)
  ev_id, 'email', em, 'seed:email_send_log', created_at
FROM (
  SELECT
    nullif(split_part(split_part(coalesce(l.metadata->>'idempotency_key', ''), 'agenda-reg-', 2), '-', 1), '') AS reg_id,
    public.agenda_normalize_email(l.recipient_email) AS em,
    l.created_at
  FROM public.email_send_log l
  WHERE l.template_name = 'agenda-registration-confirmation'
) x
JOIN LATERAL (
  SELECT r.event_id AS ev_id FROM public.agenda_registrations r
  WHERE x.reg_id IS NOT NULL AND r.id::text = x.reg_id
) j ON true
WHERE em IS NOT NULL
ORDER BY ev_id, em, created_at
ON CONFLICT (event_id, channel, email) DO NOTHING;

-- Ook e-mailkanaal beschermen voor iedereen die al een agenda-uitnodiging kreeg
INSERT INTO public.agenda_invite_ledger (event_id, channel, email, source, sent_at)
SELECT event_id, 'email', email, 'seed:from_outlook', sent_at
FROM public.agenda_invite_ledger
WHERE channel = 'outlook'
ON CONFLICT (event_id, channel, email) DO NOTHING;