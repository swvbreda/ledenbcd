-- Reviewed installation ONLY. Transaction prevents an active job ever being visible.
-- Reuses existing Vault name, never creates/prints a secret. No data backfill.
BEGIN;
ALTER TABLE public.outlook_deadline_settings ADD COLUMN scheduler_armed boolean NOT NULL DEFAULT false;
-- Replace the existing signature: the reviewed admin switch is the sole enable path.
CREATE OR REPLACE FUNCTION public.outlook_deadline_configure(_enabled boolean,_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000058);
 IF _actor IS NULL OR NOT coalesce(public.has_role(_actor,'admin'),false) THEN
  RAISE EXCEPTION 'Alleen beheerders' USING ERRCODE='42501';
 END IF;
 IF _enabled AND (
  NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='outlook-deadline-queue' AND command='SELECT public.outlook_deadline_scheduler_tick();' AND schedule='*/2 * * * *')
  OR NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='internal_webhook_secret')
 ) THEN RAISE EXCEPTION 'Deadlineplanning of interne koppeling ontbreekt'; END IF;
 INSERT INTO public.outlook_deadline_settings(id,enabled,scheduler_armed,updated_by)
 VALUES(true,_enabled,_enabled,_actor)
 ON CONFLICT(id) DO UPDATE SET enabled=EXCLUDED.enabled,scheduler_armed=EXCLUDED.scheduler_armed,updated_by=EXCLUDED.updated_by,updated_at=now();
 -- Enable only arms future queue writes; never wakes/backfills existing tasks here.
 -- Disable and pause commit together, under the same wake/drain lock.
 IF NOT _enabled THEN
  PERFORM cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='outlook-deadline-queue' AND active;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.outlook_deadline_configure(boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.outlook_deadline_configure(boolean,uuid) TO service_role;
CREATE FUNCTION public.outlook_deadline_scheduler_actor() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a uuid; BEGIN SELECT updated_by INTO a FROM public.outlook_deadline_settings WHERE id AND enabled AND scheduler_armed; IF a IS NULL OR NOT coalesce(public.has_role(a,'admin'),false) THEN RETURN NULL; END IF; RETURN a; END $$;
CREATE FUNCTION public.outlook_deadline_scheduler_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a uuid; j jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true); BEGIN a:=public.outlook_deadline_scheduler_actor(); IF a IS NULL THEN RETURN NULL; END IF; PERFORM set_config('request.jwt.claim.sub',a::text,true); j:=public.outlook_deadline_claim(); PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true); RETURN j; END $$;
CREATE FUNCTION public.outlook_deadline_scheduler_valid(_task uuid,_lock uuid,_revision bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a uuid; ok boolean; old_sub text:=current_setting('request.jwt.claim.sub',true); BEGIN a:=public.outlook_deadline_scheduler_actor(); IF a IS NULL THEN RETURN false; END IF; PERFORM set_config('request.jwt.claim.sub',a::text,true); ok:=public.outlook_deadline_valid(_task,_lock,_revision); PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true); RETURN ok; END $$;
CREATE FUNCTION public.outlook_deadline_scheduler_status() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('installed',exists(select 1 from cron.job where jobname='outlook-deadline-queue' and command='SELECT public.outlook_deadline_scheduler_tick();' and schedule='*/2 * * * *'),'active',coalesce((select active from cron.job where jobname='outlook-deadline-queue'),false),'armed',coalesce((select scheduler_armed from public.outlook_deadline_settings where id),false),'vaultConfigured',exists(select 1 from vault.secrets where name='internal_webhook_secret')) $$;
CREATE FUNCTION public.outlook_deadline_scheduler_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM pg_advisory_xact_lock(7700000000000058); IF public.outlook_deadline_scheduler_actor() IS NOT NULL AND EXISTS(SELECT 1 FROM public.outlook_deadline_outbox WHERE state IN ('pending','inflight')) AND EXISTS(SELECT 1 FROM vault.secrets WHERE name='internal_webhook_secret') THEN PERFORM cron.alter_job(jobid,active:=true) FROM cron.job WHERE jobname='outlook-deadline-queue' AND NOT active; END IF; RETURN NULL; END $$;
CREATE TRIGGER zz_deadline_scheduler_wake AFTER INSERT OR UPDATE ON public.outlook_deadline_outbox FOR EACH STATEMENT EXECUTE FUNCTION public.outlook_deadline_scheduler_wake();
CREATE FUNCTION public.outlook_deadline_scheduler_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM pg_advisory_xact_lock(7700000000000058); IF public.outlook_deadline_scheduler_actor() IS NULL OR NOT EXISTS(SELECT 1 FROM public.outlook_deadline_outbox WHERE state IN ('pending','inflight')) OR NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='internal_webhook_secret') THEN PERFORM cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='outlook-deadline-queue' AND active; RETURN; END IF; PERFORM net.http_post(url:='https://leden.coffeeshopbond.nl/api/public/outlook-deadline-dispatch',headers:=jsonb_build_object('Content-Type','application/json','x-internal-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_webhook_secret')),body:='{}'::jsonb,timeout_milliseconds:=130000); END $$;
REVOKE ALL ON FUNCTION public.outlook_deadline_scheduler_actor(),public.outlook_deadline_scheduler_claim(),public.outlook_deadline_scheduler_valid(uuid,uuid,bigint),public.outlook_deadline_scheduler_status(),public.outlook_deadline_scheduler_tick(),public.outlook_deadline_scheduler_wake() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.outlook_deadline_scheduler_actor(),public.outlook_deadline_scheduler_claim(),public.outlook_deadline_scheduler_valid(uuid,uuid,bigint),public.outlook_deadline_scheduler_status(),public.outlook_deadline_scheduler_tick() TO service_role;
-- Initial registration is always inactive. No secret in cron.command or request body.
DO $$ DECLARE j bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='internal_webhook_secret') THEN RAISE EXCEPTION 'Existing internal webhook secret missing'; END IF;
 j:=cron.schedule('outlook-deadline-queue','*/2 * * * *','SELECT public.outlook_deadline_scheduler_tick();');
 PERFORM cron.alter_job(j,active:=false);
END $$;
COMMIT;
-- Do NOT arm here. After separate release review, scheduler_armed may be enabled
-- by trusted configuration; future outbox changes wake this job, drain disarms it.
