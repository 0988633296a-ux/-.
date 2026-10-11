begin;
create table public.line_notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null references public.notification_outbox(id),
 connection_id uuid not null references public.line_group_connections(id),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped')),
 retry_key uuid not null default gen_random_uuid(),
 claim_token uuid,
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 first_attempt_at timestamptz,
 sent_at timestamptz,
 last_error text,
 request_id text,
 incident_snapshot jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(outbox_id,connection_id)
);
create index line_delivery_connection on public.line_notification_deliveries(connection_id);
create index line_delivery_due on public.line_notification_deliveries(next_attempt_at) where status in ('pending','processing');
alter table public.line_notification_deliveries enable row level security;
revoke all on public.line_notification_deliveries from public,anon,authenticated;
grant all on public.line_notification_deliveries to service_role;
grant select on public.line_notification_deliveries to authenticated;
create policy line_delivery_admin_read on public.line_notification_deliveries for select to authenticated
 using(exists(select 1 from public.line_group_connections g where g.id=connection_id and g.organization_id=(select private.my_org()) and (select private.my_role()) in ('administrator','center_lead')));

-- Claim and lease atomically. Retry keys stay stable across process crashes.
create function public.claim_line_notifications(p_organization uuid,p_limit integer default 10)
 returns table(delivery_id uuid,claim_token uuid,retry_key uuid,group_id text,kind text,incident jsonb)
 language plpgsql security invoker set search_path='' as $$
begin
 insert into public.line_notification_deliveries(outbox_id,connection_id,incident_snapshot)
 select o.id,g.id,case when o.kind='line_connection_test' then '{}'::jsonb else
 jsonb_build_object('number',i.number,'type',i.type,'level',i.level,'address',i.address,'lat',i.lat,'lng',i.lng,'reported_at',i.reported_at) end
 from public.notification_outbox o join public.line_group_connections g on g.organization_id=o.organization_id
 left join public.incidents i on i.id=o.incident_id and i.organization_id=o.organization_id
 where o.organization_id=p_organization and o.delivered_at is null and o.created_at>=g.approved_at
 and g.enabled and g.available and g.deleted_at is null and o.kind in ('new_incident','critical_incident','line_connection_test')
 and (o.kind='line_connection_test' or exists(select 1 from public.incidents i where i.id=o.incident_id and i.organization_id=o.organization_id and i.deleted_at is null))
 on conflict(outbox_id,connection_id) do nothing;
 update public.notification_outbox o set delivered_at=now(),last_error=null
 where o.organization_id=p_organization and o.delivered_at is null
 and exists(select 1 from public.line_notification_deliveries d where d.outbox_id=o.id)
 and not exists(select 1 from public.line_notification_deliveries d where d.outbox_id=o.id and d.status<>'sent');
 update public.line_notification_deliveries d set status='failed',last_error='RETRY_WINDOW_EXPIRED'
 where d.status in ('pending','processing') and (d.lease_until is null or d.lease_until<now())
 and (d.attempts>=8 or d.first_attempt_at<now()-interval '23 hours')
 and exists(select 1 from public.notification_outbox o where o.id=d.outbox_id and o.organization_id=p_organization);
 return query
 with candidates as (
 select d.id from public.line_notification_deliveries d
 join public.notification_outbox o on o.id=d.outbox_id
 join public.line_group_connections g on g.id=d.connection_id
 where o.organization_id=p_organization and g.enabled and g.available and g.deleted_at is null
 and (o.kind='line_connection_test' or exists(select 1 from public.incidents i where i.id=o.incident_id and i.organization_id=o.organization_id and i.deleted_at is null))
 and d.status in ('pending','processing') and d.next_attempt_at<=now() and (d.lease_until is null or d.lease_until<now())
 order by d.created_at limit least(greatest(p_limit,1),10) for update of d skip locked
 ), claimed as (
 update public.line_notification_deliveries d set status='processing',attempts=d.attempts+1,
 claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(d.first_attempt_at,now())
 from candidates c where d.id=c.id returning d.*
 )
 select d.id,d.claim_token,d.retry_key,g.group_id,o.kind,d.incident_snapshot
 from claimed d join public.notification_outbox o on o.id=d.outbox_id join public.line_group_connections g on g.id=d.connection_id;
end $$;

create function public.finish_line_notification(p_delivery uuid,p_claim uuid,p_sent boolean,p_error text default null,p_request text default null)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare row public.line_notification_deliveries; oid uuid;
begin
 select * into row from public.line_notification_deliveries where id=p_delivery and claim_token=p_claim and status='processing' for update;
 if not found then return false; end if;
 oid:=row.outbox_id;
 update public.line_notification_deliveries set
 status=case when p_sent then 'sent' when row.attempts>=8 or row.first_attempt_at<now()-interval '23 hours' or p_error in ('LINE_HTTP_400','LINE_HTTP_403','RETRY_CONFLICT_UNCONFIRMED') then 'failed' else 'pending' end,
 sent_at=case when p_sent then now() else null end,lease_until=null,claim_token=null,
 next_attempt_at=now()+make_interval(secs=>least(3600,60*(2^row.attempts)::integer)),
 last_error=case when p_sent then null else left(p_error,100) end,request_id=left(p_request,200)
 where id=p_delivery;
 update public.notification_outbox set attempts=attempts+1,last_error=case when p_sent then null else left(p_error,100) end,
 delivered_at=case when p_sent and not exists(select 1 from public.line_notification_deliveries where outbox_id=oid and status<>'sent') then now() else delivered_at end
 where id=oid;
 return true;
end $$;
revoke all on function public.claim_line_notifications(uuid,integer),public.finish_line_notification(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.claim_line_notifications(uuid,integer),public.finish_line_notification(uuid,uuid,boolean,text,text) to service_role;
commit;
