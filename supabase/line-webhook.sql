-- LINE group discovery only. A discovered group never receives alerts automatically.
begin;
create table public.line_group_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 group_id text not null check (group_id ~ '^C[0-9a-fA-F]{32}$'),
 name text not null default 'กลุ่ม LINE (รอยืนยัน)',
 enabled boolean not null default false,
 available boolean not null default true,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 approved_by uuid references public.users(id),
 approved_at timestamptz,
 deleted_at timestamptz,
 unique (organization_id,group_id),
 check (not enabled or (approved_by is not null and approved_at is not null and available and deleted_at is null))
);
create index line_group_connections_org on public.line_group_connections(organization_id);
create index line_group_connections_approver on public.line_group_connections(approved_by);
create table public.line_webhook_receipts (
 event_id text primary key,
 received_at timestamptz not null default now()
);
create index line_webhook_receipts_received on public.line_webhook_receipts(received_at);
alter table public.line_group_connections enable row level security;
alter table public.line_webhook_receipts enable row level security;
revoke all on public.line_group_connections,public.line_webhook_receipts from public,anon,authenticated;
grant select on public.line_group_connections to authenticated;
grant all on public.line_group_connections,public.line_webhook_receipts to service_role;
create policy line_group_admin_read on public.line_group_connections for select to authenticated
 using (organization_id=(select private.my_org()) and (select private.my_role()) in ('administrator','center_lead') and deleted_at is null);
create trigger audit_change after insert or update on public.line_group_connections for each row execute function public.audit_change();
-- Only the verified webhook (service role) may register a candidate. Atomic deduplication.
create function public.record_line_group_event(p_event_id text,p_organization uuid,p_group text,p_event text)
 returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_event not in ('join','connect','leave') or p_group !~ '^C[0-9a-fA-F]{32}$' then raise exception 'Invalid LINE event'; end if;
 insert into public.line_webhook_receipts(event_id) values(p_event_id) on conflict do nothing;
 if not found then return false; end if;
 if p_event='leave' then
   update public.line_group_connections set available=false,enabled=false,last_seen_at=now() where organization_id=p_organization and group_id=p_group;
 else
   insert into public.line_group_connections(organization_id,group_id) values(p_organization,p_group)
   on conflict(organization_id,group_id) do update set available=true,last_seen_at=now();
 end if;
 return true;
end $$;
revoke all on function public.record_line_group_event(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_line_group_event(text,uuid,text,text) to service_role;
commit;
