ALTER TABLE public.member_reconfirmation_requests ADD COLUMN send_status text NOT NULL DEFAULT 'unsent', ADD COLUMN send_claim uuid, ADD COLUMN send_started_at timestamptz, ADD COLUMN recipient_email text, ADD COLUMN recipient_name text, ADD COLUMN provider_id text, ADD COLUMN provider_status integer, ADD COLUMN send_error text;
CREATE OR REPLACE FUNCTION public.member_reconfirmation_recipient(_member integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; e text; n text; shop text;
BEGIN
 SELECT m.data || coalesce(ed.data,'{}'::jsonb) INTO d FROM public.members_data m LEFT JOIN public.member_edits ed ON ed.member_id=m.id WHERE m.id=_member AND coalesce(m.member_type,'member')='member';
 IF d IS NULL THEN RAISE EXCEPTION 'Geen actief lid'; END IF;
 e:=lower(trim(coalesce(d->>'email',''))); n:=trim(coalesce(d->>'contactpersoon','')); shop:=trim(coalesce(d->>'naam',''));
 IF e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR n='' OR shop='' THEN RAISE EXCEPTION 'Contactgegevens ontbreken of zijn ongeldig'; END IF;
 IF lower(shop) IN ('baba','papillion','koffie en dromen') THEN RAISE EXCEPTION 'Uitgesloten lid'; END IF;
 IF EXISTS(SELECT 1 FROM public.removed_contact_emails WHERE member_id=_member AND lower(email)=e) THEN RAISE EXCEPTION 'Contacttoegang ingetrokken'; END IF;
 RETURN jsonb_build_object('email',e,'name',n,'shop',shop);
END $$;
REVOKE ALL ON FUNCTION public.member_reconfirmation_recipient(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.member_reconfirmation_recipient(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.member_reconfirmation_claim(_id uuid,_actor uuid,_hash text,_claim uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.member_reconfirmation_requests; contact jsonb;
BEGIN
 IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Geen toegang'; END IF;
 IF _hash IS NULL OR _hash !~ '^[a-f0-9]{64}$' OR _claim IS NULL THEN RAISE EXCEPTION 'Ongeldige claim'; END IF;
 SELECT * INTO r FROM public.member_reconfirmation_requests WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR r.campaign<>'contributie-2026-11' OR r.member_id NOT IN (10,25,34,75,78,79,91,99,107,110,114) OR r.activated_at IS NULL OR r.revoked_at IS NOT NULL OR r.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'Niet goedgekeurd voor verzending'; END IF;
 IF r.sent_at IS NOT NULL OR r.send_claim IS NOT NULL OR r.send_status<>'unsent' THEN RETURN jsonb_build_object('claimed',false,'status',r.send_status); END IF;
 contact:=public.member_reconfirmation_recipient(r.member_id);
 IF EXISTS(SELECT 1 FROM public.suppressed_emails WHERE lower(email)=contact->>'email') OR EXISTS(SELECT 1 FROM public.email_unsubscribe_tokens WHERE lower(email)=contact->>'email' AND used_at IS NOT NULL) THEN
 UPDATE public.member_reconfirmation_requests SET send_status='suppressed',recipient_email=contact->>'email',recipient_name=contact->>'name' WHERE id=r.id;
 RETURN jsonb_build_object('claimed',false,'status','suppressed');
 END IF;
 UPDATE public.member_reconfirmation_requests SET send_claim=_claim,send_status='sending',send_started_at=now(),token_hash=_hash,recipient_email=contact->>'email',recipient_name=contact->>'name' WHERE id=r.id;
 INSERT INTO public.email_send_log(message_id,template_name,recipient_email,status,metadata) VALUES(_claim::text,'membership-reconfirmation',contact->>'email','pending',jsonb_build_object('request_id',r.id,'idempotency_key','membership-reconfirmation:'||r.id::text));
 RETURN contact || jsonb_build_object('claimed',true,'invoice_number',r.invoice_number,'idempotency_key','membership-reconfirmation:'||r.id::text);
END $$;
REVOKE ALL ON FUNCTION public.member_reconfirmation_claim(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.member_reconfirmation_claim(uuid,uuid,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.member_reconfirmation_finish(_id uuid,_claim uuid,_status text,_provider_id text DEFAULT NULL,_http integer DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.member_reconfirmation_requests; accepted timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO r FROM public.member_reconfirmation_requests WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR r.send_claim IS DISTINCT FROM _claim OR r.send_status<>'sending' THEN RAISE EXCEPTION 'Claim ongeldig of reeds afgerond'; END IF;
 IF _status NOT IN ('sent','failed','unknown','suppressed') THEN RAISE EXCEPTION 'Ongeldige status'; END IF;
 IF _status='sent' AND (coalesce(_provider_id,'')='' OR _http IS NULL OR _http<200 OR _http>=300) THEN RAISE EXCEPTION 'Provideracceptatie niet bewezen'; END IF;
 UPDATE public.member_reconfirmation_requests SET send_status=_status,provider_id=_provider_id,provider_status=_http,send_error=CASE WHEN _status='sent' THEN NULL ELSE _status END,sent_at=CASE WHEN _status='sent' THEN accepted ELSE NULL END,deadline=CASE WHEN _status='sent' THEN accepted+interval '30 days' ELSE deadline END WHERE id=r.id;
 INSERT INTO public.email_send_log(message_id,template_name,recipient_email,status,metadata) VALUES(_claim::text,'membership-reconfirmation',r.recipient_email,_status,jsonb_build_object('request_id',r.id,'provider','resend','resend_id',_provider_id,'provider_status',_http,'idempotency_key','membership-reconfirmation:'||r.id::text));
 IF _status='sent' THEN INSERT INTO public.member_notes(member_id,note,created_by) VALUES(r.member_id,'Lidmaatschapsbevestigingsmail voor contributiefactuur '||r.invoice_number||' van 15 januari 2026 door de mailprovider geaccepteerd. Reactietermijn: 30 dagen vanaf verzending. Geen betaalbevestiging of wijziging van lidstatus.',r.created_by); END IF;
END $$;
REVOKE ALL ON FUNCTION public.member_reconfirmation_finish(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.member_reconfirmation_finish(uuid,uuid,text,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.member_reconfirmation_answer(_hash text,_confirm boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.member_reconfirmation_requests;
BEGIN
 IF _hash IS NULL OR _hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('valid',false); END IF;
 SELECT * INTO r FROM public.member_reconfirmation_requests WHERE token_hash=_hash FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL OR r.activated_at IS NULL OR r.sent_at IS NULL THEN RETURN jsonb_build_object('valid',false); END IF;
 IF r.confirmed_at IS NOT NULL THEN RETURN jsonb_build_object('valid',true,'confirmed',true,'deadline',r.deadline); END IF;
 IF r.deadline<now() THEN RETURN jsonb_build_object('valid',false); END IF;
 IF _confirm THEN
 UPDATE public.member_reconfirmation_requests SET confirmed_at=now() WHERE id=r.id;
 INSERT INTO public.member_notes(member_id,note,created_by) VALUES(r.member_id,'Lidmaatschapsbevestiging ontvangen via de persoonlijke link van het secretariaat. Het lid wil aangesloten blijven en ledencommunicatie ontvangen. Dit is geen betaalbevestiging.',r.created_by);
 END IF;
 RETURN jsonb_build_object('valid',true,'confirmed',_confirm,'deadline',r.deadline);
END $$;
REVOKE ALL ON FUNCTION public.member_reconfirmation_answer(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.member_reconfirmation_answer(text,boolean) TO service_role;