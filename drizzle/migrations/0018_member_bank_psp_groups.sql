CREATE OR REPLACE FUNCTION public.get_member_bank_groups()
RETURNS TABLE(bank text, aantal integer, totaal_leden integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role IN ('extern'::app_role,'inhuur'::app_role))
     AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.is_board_member(v_uid)
          OR EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = v_uid)) THEN
    RAISE EXCEPTION 'Geen geldige ledenkoppeling' USING ERRCODE = '42501';
  END IF;
  -- Zelfde regels als bankFromIban: alleen banknaam/categorie, nooit rekeningdelen.
  RETURN QUERY
  WITH codes(code, naam) AS (VALUES ('INGB','ING'),('RABO','Rabobank'),('ABNA','ABN AMRO'),('SNSB','SNS Bank'),('ASNB','ASN Bank'),('RBRB','RegioBank'),('KNAB','Knab'),('BUNQ','bunq'),('TRIO','Triodos Bank'),('FVLB','Van Lanschot'),('REVO','Revolut'),('DEUT','Deutsche Bank'),('NWAB','Nederlandse Waterschapsbank'),('BNGH','BNG Bank'),('HAND','Svenska Handelsbanken'),('BCIT','Intesa Sanpaolo'),('ANDL','Anadolubank'),('LOYD','Lloyds Bank'),('CITI','Citibank'),('CHAS','JPMorgan Chase'),('CITC','CIT Bank'),('CLRB','Clear Bank'),('CNBA','Coöperatieve Rabobank'),('CRLY','Crédit Lyonnais'),('CRUN','Credit Europe Bank'),('CVBA','Van Doorn'),('CVSL','Credit Vision'),('CENL','Commerzbank'),('CMCI','Commerzbank'),('CSFP','Credit Suisse'),('CSTP','Coöperatieve Rabobank'),('CVIS','Cardif'),('FBHL','Credit Europe'),('FLOR','Demir-Halk Bank'),('FRGH','Ffrees'),('FTSB','FTSB'),('FRNX','Franx'),('GILL','Insinger Gilissen'),('HSBC','HSBC'),('ICBK','ICBC'),('ISBK','Isbank'),('KABA','Yapi Kredi'),('KOEX','KEB Hana Bank'),('KRED','KBC Bank'),('MHCB','Mizuho Bank'),('NNBA','Nationale-Nederlanden Bank'),('PCBC','China Construction Bank'),('RABN','Rabobank'),('SOGE','Société Générale'),('UGBI','Garanti Bank'),('VOWA','Volkswagen Bank'),('ZWLB','Zwitserleven')),
  leden AS (
    SELECT m.id, COALESCE(e.data->'ibans', m.data->'ibans') AS ibans
    FROM public.members_data m LEFT JOIN public.member_edits e ON e.member_id = m.id
    WHERE m.member_type = 'member'
  ), ibans AS (
    SELECT l.id, regexp_replace(upper(x), '[^A-Z0-9]', '', 'g') AS iban
    FROM leden l CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(l.ibans)='array' THEN l.ibans ELSE '[]'::jsonb END) x
  ), banken AS (
    SELECT i.id,
      CASE
        WHEN length(i.iban) < 8 THEN 'Onbekend'
        WHEN left(i.iban,2) <> 'NL' THEN COALESCE(c.naam || ' (' || left(i.iban,2) || ')', 'Buitenlands (' || left(i.iban,2) || ')')
        ELSE COALESCE(c.naam, CASE WHEN substr(i.iban,5,4) ~ '^[A-Z]{4}$' THEN 'Overig (' || substr(i.iban,5,4) || ')' ELSE 'Overig' END)
      END AS bank
    FROM ibans i LEFT JOIN codes c ON c.code = substr(i.iban,5,4)
    WHERE i.iban <> ''
  ), per_lid AS (
    SELECT DISTINCT l.id, COALESCE(b.bank, 'Onbekend') AS bank
    FROM leden l LEFT JOIN banken b ON b.id = l.id
  )
  SELECT p.bank, count(*)::int, (SELECT count(*)::int FROM leden)
  FROM per_lid p GROUP BY p.bank;
END $$;
REVOKE ALL ON FUNCTION public.get_member_bank_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_bank_groups() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_member_bank_aggregate() FROM authenticated;
COMMENT ON FUNCTION public.get_member_bank_aggregate() IS 'DEPRECATED: replaced by get_member_bank_groups';

CREATE OR REPLACE FUNCTION public.get_member_psp_groups()
RETURNS TABLE(naam text, aantal integer, pct integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role IN ('extern'::app_role,'inhuur'::app_role))
     AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.is_board_member(v_uid)
          OR EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = v_uid)) THEN
    RAISE EXCEPTION 'Geen geldige ledenkoppeling' USING ERRCODE = '42501';
  END IF;
  -- Zelfde normalisatie als usePinverwerkers; onbekende vrije tekst wordt 'Anders'.
  RETURN QUERY
  WITH known(ord, k) AS (VALUES (0,'Worldline'),(1,'CCV'),(2,'EMS / Fiserv'),(3,'Adyen'),(4,'Rabobank'),(5,'SumUp'),(6,'YourSafe'),(7,'CM.com'),(8,'Mollie'),(9,'Buckaroo'),(10,'ING'),(11,'ABN AMRO')),
  resp AS (
    SELECT r.id,
      CASE WHEN jsonb_typeof(r.answer->'location')='string' THEN r.answer->>'location' ELSE 'Onbekende vestiging' END AS loc,
      COALESCE(r.answer->'value', r.answer) AS val
    FROM public.survey_responses r
    WHERE r.question_id IN (SELECT q.id FROM public.survey_questions q
                            WHERE q.question_text ILIKE '%betaaldienstverlener gebruikt u momenteel%')
  ), raw AS (
    SELECT r.id, r.loc, regexp_replace(x, '^\s+|\s+$', '', 'g') AS v
    FROM resp r CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(r.val) AS x WHERE jsonb_typeof(r.val)='array'
      UNION ALL SELECT r.val #>> '{}' WHERE jsonb_typeof(r.val)='string') s
  ), kand AS (
    SELECT id, loc, v, COALESCE(NULLIF(regexp_replace(regexp_replace(v, '^anders[,:]?\s*(namelijk)?[:]?\s*', '', 'i'), '^\s+|\s+$', '', 'g'), ''), v) AS kd
    FROM raw WHERE v <> ''
  ), norm AS (
    SELECT k.id, k.loc,
      COALESCE(
        (SELECT kn.k FROM known kn WHERE lower(kn.k) = lower(k.kd) OR position(lower(kn.k) IN lower(k.kd)) > 0 ORDER BY kn.ord LIMIT 1),
        CASE WHEN k.v ~* '^anders' THEN 'Anders'
             WHEN k.v ~* '^(weet ik niet|niet van toepassing|n\.v\.t\.?)$' THEN NULL
             ELSE k.kd END) AS nm
    FROM kand k
  ), per_naam AS (
    SELECT DISTINCT n.nm, n.loc FROM norm n WHERE n.nm IS NOT NULL
  ), tot AS (SELECT GREATEST(count(*),1)::numeric AS t FROM per_naam)
  SELECT g.nm, g.cnt::int, round(g.cnt * 100 / (SELECT t FROM tot))::int
  FROM (
    SELECT CASE WHEN p.nm IN (SELECT k FROM known) THEN p.nm ELSE 'Anders' END AS nm,
           count(DISTINCT p.loc) AS cnt
    FROM per_naam p GROUP BY 1
  ) g;
END $$;
REVOKE ALL ON FUNCTION public.get_member_psp_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_psp_groups() TO authenticated;