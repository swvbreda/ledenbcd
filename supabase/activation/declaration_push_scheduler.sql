-- NIET automatisch toegepast. Handmatige activatiestap na review (agent kan vault-verwijzingen niet uitvoeren).
-- Daarna: SELECT cron.schedule('declaration-push-queue','* * * * *','SELECT public.declaration_push_scheduler_tick()'); direct gevolgd door cron.alter_job(..., active:=false);
-- en pas na review: UPDATE declaration_push_settings SET scheduler_armed=true.
-- Wekker (cron-job 'declaration-push-queue' wordt NIET door deze migratie aangemaakt).
CREATE OR REPLACE FUNCTION public.declaration_push_scheduler_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(7700000000000063);
  IF NOT coalesce((SELECT enabled AND scheduler_armed FROM public.declaration_push_settings WHERE id), false)
     OR NOT EXISTS (SELECT 1 FROM public.declaration_notifications WHERE push_attempts < 5
         AND (push_status IN ('pending','sending') OR push_status = 'failed'))
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_webhook_secret') THEN
    PERFORM cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname = 'declaration-push-queue' AND active;
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/declaration-push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
END $$;
REVOKE ALL ON FUNCTION public.declaration_push_scheduler_tick() FROM PUBLIC, anon, authenticated;
