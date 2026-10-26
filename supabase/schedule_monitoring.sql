create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('renderkeep-monitor-every-five-minutes')
where exists (
  select 1 from cron.job where jobname = 'renderkeep-monitor-every-five-minutes'
);

select cron.schedule(
  'renderkeep-monitor-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'renderkeep_supabase_url')
      || '/functions/v1/monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'renderkeep_monitor_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
