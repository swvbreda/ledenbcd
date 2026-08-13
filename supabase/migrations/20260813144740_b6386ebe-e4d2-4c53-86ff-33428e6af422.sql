select cron.schedule(
  'sync-catchup-temp',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/ponto-sync?action=all',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')),
    body := jsonb_build_object('trigger','catchup')
  );
  select net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=all',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')),
    body := jsonb_build_object('trigger','catchup')
  );
  $cron$
);