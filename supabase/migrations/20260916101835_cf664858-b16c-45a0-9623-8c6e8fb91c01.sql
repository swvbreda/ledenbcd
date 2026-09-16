ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS lid_kvk_nummer text,
  ADD COLUMN IF NOT EXISTS lid_vergunninghouder text,
  ADD COLUMN IF NOT EXISTS lid_exploitant text,
  ADD COLUMN IF NOT EXISTS lid_opgave_member_id integer,
  ADD COLUMN IF NOT EXISTS lid_opgave_bijgewerkt_op timestamptz;

CREATE OR REPLACE FUNCTION public.compact_key(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(coalesce(_v, '')), '[^a-z0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.apply_member_register_opgave(_member_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base jsonb;
  _overlay jsonb;
  _data jsonb;
  _locaties jsonb;
  _link record;
  _loc jsonb;
  _match jsonb;
  _key text;
  _kvk text;
  _verg text;
  _expl text;
BEGIN
  SELECT data INTO _base FROM public.members_data WHERE id = _member_id;
  IF _base IS NULL THEN RETURN; END IF;

  SELECT data INTO _overlay FROM public.member_edits WHERE member_id = _member_id;
  _data := public.merge_member_locations(_base, coalesce(_overlay, '{}'::jsonb));
  _locaties := coalesce(_data -> 'locaties', '[]'::jsonb);

  FOR _link IN
    SELECT register_id, location_key
    FROM public.coffeeshop_member_links
    WHERE member_id = _member_id AND status = 'bevestigd'
  LOOP
    _match := NULL;
    _key := lower(coalesce(_link.location_key, ''));

    IF _key <> '' THEN
      FOR _loc IN SELECT jsonb_array_elements(_locaties) LOOP
        IF concat_ws('|',
              public.compact_key(_loc ->> 'naam'),
              public.compact_key(_loc ->> 'adres'),
              public.compact_key(_loc ->> 'postcode')) = _key THEN
          _match := _loc;
          EXIT;
        END IF;
      END LOOP;

      IF _match IS NULL THEN
        FOR _loc IN SELECT jsonb_array_elements(_locaties) LOOP
          IF (split_part(_key, '|', 3) <> ''
                AND public.compact_key(_loc ->> 'postcode') = split_part(_key, '|', 3))
             OR (split_part(_key, '|', 2) <> ''
                AND public.compact_key(_loc ->> 'adres') = split_part(_key, '|', 2)) THEN
            _match := _loc;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF _match IS NULL AND jsonb_array_length(_locaties) = 1 THEN
      _match := _locaties -> 0;
    END IF;

    _kvk := nullif(btrim(coalesce(_match ->> 'kvk', _data ->> 'kvk', _data ->> 'factuurKvk', '')), '');
    _verg := nullif(btrim(coalesce(_match ->> 'vergunninghouder', _data ->> 'vergunninghouder', '')), '');
    _expl := nullif(btrim(coalesce(_match ->> 'exploitant', _data ->> 'exploitant', _match ->> 'bedrijfsnaam', _data ->> 'bedrijfsnaam', '')), '');

    IF _kvk IS NULL AND _verg IS NULL AND _expl IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.coffeeshop_register r
    SET lid_kvk_nummer = coalesce(_kvk, r.lid_kvk_nummer),
        lid_vergunninghouder = coalesce(_verg, r.lid_vergunninghouder),
        lid_exploitant = coalesce(_expl, r.lid_exploitant),
        lid_opgave_member_id = _member_id,
        lid_opgave_bijgewerkt_op = now()
    WHERE r.id = _link.register_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_member_register_opgave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mid integer;
BEGIN
  IF TG_TABLE_NAME = 'members_data' THEN
    _mid := NEW.id;
  ELSIF TG_TABLE_NAME = 'member_edits' THEN
    _mid := NEW.member_id;
  ELSE
    IF NEW.status IS DISTINCT FROM 'bevestigd' THEN RETURN NEW; END IF;
    _mid := NEW.member_id;
  END IF;

  PERFORM public.apply_member_register_opgave(_mid);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_data_register_opgave ON public.members_data;
CREATE TRIGGER trg_members_data_register_opgave
AFTER INSERT OR UPDATE ON public.members_data
FOR EACH ROW EXECUTE FUNCTION public.trg_member_register_opgave();

DROP TRIGGER IF EXISTS trg_member_edits_register_opgave ON public.member_edits;
CREATE TRIGGER trg_member_edits_register_opgave
AFTER INSERT OR UPDATE ON public.member_edits
FOR EACH ROW EXECUTE FUNCTION public.trg_member_register_opgave();

DROP TRIGGER IF EXISTS trg_member_links_register_opgave ON public.coffeeshop_member_links;
CREATE TRIGGER trg_member_links_register_opgave
AFTER INSERT OR UPDATE ON public.coffeeshop_member_links
FOR EACH ROW EXECUTE FUNCTION public.trg_member_register_opgave();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT member_id FROM public.coffeeshop_member_links WHERE status = 'bevestigd' LOOP
    PERFORM public.apply_member_register_opgave(r.member_id);
  END LOOP;
END $$;