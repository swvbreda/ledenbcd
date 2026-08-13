select cron.schedule(
  'ponto-sync-twice-daily',
  '0 6,18 * * *',
  $cron$
  select net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/ponto-sync?action=all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $cron$
);

select cron.schedule(
  'informer-sync-daily',
  '30 4 * * *',
  $cron$
  select net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $cron$
);