-- Run after line-notifications.sql on hosted Supabase. No secret is printed.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from vault.secrets where name='drc_line_worker_key') then
  perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'drc_line_worker_key','Private LINE scheduler authentication');
 end if;
end $$;
-- Only this narrowly scoped private helper reads Vault, never the public caller.
create function private.line_worker_matches_key(p_key text) returns boolean
language sql security definer stable set search_path='' as $$
 select p_key is not null and length(p_key) between 60 and 100 and exists(
 select 1 from vault.decrypted_secrets where name='drc_line_worker_key' and decrypted_secret=p_key)
$$;
revoke all on function private.line_worker_matches_key(text) from public,anon,authenticated;
grant execute on function private.line_worker_matches_key(text) to service_role;
create function public.authorize_line_worker(p_key text) returns boolean
 language sql security invoker stable set search_path='' as $$select private.line_worker_matches_key(p_key)$$;
revoke all on function public.authorize_line_worker(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.authorize_line_worker(text) to service_role;
-- Install only after the Edge Function is deployed. Requests carry a private Vault key.
select cron.schedule('drc-line-notify','* * * * *',
 $job$select net.http_post(
 url:='https://zkmaubtpxiptbbqtazfr.supabase.co/functions/v1/line-notify',
 headers:=jsonb_build_object('Content-Type','application/json','x-line-worker-key',
 (select decrypted_secret from vault.decrypted_secrets where name='drc_line_worker_key')),
 body:='{}'::jsonb,timeout_milliseconds:=120000);$job$);
commit;
