CREATE POLICY sticker_enquete_geen_directe_insert ON public.survey_responses AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (survey_id <> '48979e13-3dcf-4ed4-abbe-e2f3d365b658'::uuid);

CREATE OR REPLACE FUNCTION public.submit_sticker_request(p_aanvrager text, p_coffeeshop text, p_answers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sid constant uuid := '48979e13-3dcf-4ed4-abbe-e2f3d365b658';
  v_uid uuid := auth.uid();
  v_req uuid := gen_random_uuid();
  q record;
  v_val jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '42501'; END IF;
  IF NOT (EXISTS (SELECT 1 FROM member_profiles WHERE user_id = v_uid) OR has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM surveys WHERE id = v_sid AND active) THEN RAISE EXCEPTION 'Enquête gesloten'; END IF;
  IF length(trim(coalesce(p_aanvrager,''))) = 0 OR length(trim(coalesce(p_coffeeshop,''))) = 0 THEN
    RAISE EXCEPTION 'Naam aanvrager en naam coffeeshop zijn verplicht';
  END IF;
  IF length(p_aanvrager) > 200 OR length(p_coffeeshop) > 200 OR jsonb_typeof(coalesce(p_answers,'null')) <> 'object' THEN
    RAISE EXCEPTION 'Ongeldige invoer';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers) k WHERE NOT EXISTS (SELECT 1 FROM survey_questions WHERE survey_id = v_sid AND id::text = k)) THEN
    RAISE EXCEPTION 'Onbekende vraag';
  END IF;
  INSERT INTO survey_completions (survey_id, user_id, location_name) VALUES (v_sid, v_uid, NULL);
  FOR q IN SELECT id, required FROM survey_questions WHERE survey_id = v_sid ORDER BY sort_order LOOP
    v_val := p_answers -> q.id::text;
    IF q.required AND (v_val IS NULL OR v_val = 'null'::jsonb OR (jsonb_typeof(v_val) = 'string' AND trim(v_val #>> '{}') = '') OR (jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0)) THEN
      RAISE EXCEPTION 'Niet alle verplichte vragen zijn beantwoord';
    END IF;
    INSERT INTO survey_responses (survey_id, question_id, answer, status)
    VALUES (v_sid, q.id, jsonb_build_object('value', coalesce(v_val, 'null'::jsonb), 'aanvrager', trim(p_aanvrager), 'coffeeshop', trim(p_coffeeshop), 'request_id', v_req, 'source', 'Ledenportaal'), 'approved');
  END LOOP;
  RETURN v_req;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Je hebt de stickers al aangevraagd';
END $$;

REVOKE ALL ON FUNCTION public.submit_sticker_request(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_sticker_request(text, text, jsonb) TO authenticated;