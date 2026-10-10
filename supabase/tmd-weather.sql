-- Add after schema.sql. Service-only cache; never stores API tokens.
begin;
create table public.external_weather_cache (
  id text primary key check (id = 'tmd_lamhuailua'),
  payload jsonb,
  fetched_at timestamptz,
  next_attempt_at timestamptz not null default '-infinity',
  last_error text
);
alter table public.external_weather_cache enable row level security;
revoke all on public.external_weather_cache from public,anon,authenticated;
grant all on public.external_weather_cache to service_role;
create function public.claim_tmd_weather_refresh() returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed boolean;
begin
  insert into public.external_weather_cache(id) values('tmd_lamhuailua') on conflict do nothing;
  update public.external_weather_cache set next_attempt_at=now()+interval '15 minutes'
    where id='tmd_lamhuailua' and next_attempt_at<=now() returning true into claimed;
  return coalesce(claimed,false);
end $$;
revoke all on function public.claim_tmd_weather_refresh() from public,anon,authenticated;
grant execute on function public.claim_tmd_weather_refresh() to service_role;
commit;
