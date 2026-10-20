-- Isolated transaction: no messages, conversations, notifications, or external calls.
BEGIN;
DO $$
DECLARE n integer;
BEGIN
  IF has_function_privilege('authenticated','public.whatsapp_connector_receive(text,text,jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.whatsapp_connector_receive(text,text,jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.whatsapp_connector_process(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Privileged connector RPC exposed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='whatsapp_webhook_events' AND cmd='SELECT'
    AND qual LIKE '%has_role%admin%') THEN
    RAISE EXCEPTION 'Admin receipt policy missing';
  END IF;
  PERFORM public.whatsapp_connector_receive('isolated-receipt-regression', 'whatsapp.unknown',
    '{"entry":[{"changes":[{"value":{"unknown":"preserved"}}]}]}', '[]');
  PERFORM public.whatsapp_connector_receive('isolated-receipt-regression', 'whatsapp.unknown',
    '{"entry":[{"changes":[{"value":{"unknown":"replaced"}}]}]}', '[]');
  SELECT count(*) INTO n FROM public.whatsapp_webhook_events WHERE delivery_id='isolated-receipt-regression';
  IF n<>1 THEN RAISE EXCEPTION 'Duplicate receipt'; END IF;
  IF NOT public.whatsapp_connector_process('isolated-receipt-regression') THEN
    RAISE EXCEPTION 'Processing failed';
  END IF;
  PERFORM public.whatsapp_connector_process('isolated-receipt-regression');
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_webhook_events WHERE delivery_id='isolated-receipt-regression'
    AND processed_at IS NOT NULL AND attempts=1
    AND payload #>> '{entry,0,changes,0,value,unknown}'='preserved') THEN
    RAISE EXCEPTION 'Replay changed receipt/completion';
  END IF;
END;
$$;
ROLLBACK;