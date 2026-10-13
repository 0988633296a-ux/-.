-- Disaster Response Center: execute in a fresh Supabase project.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create type public.app_role as enum ('administrator','center_lead','dispatcher','field_staff','report_viewer');
create type public.incident_status as enum ('รับแจ้ง','ตรวจสอบ','จัดกำลัง','ออกปฏิบัติการ','ถึงเหตุ','ดำเนินการ','ควบคุมเหตุได้','เสร็จสิ้น','ยกเลิก');
create type public.severity as enum ('ทั่วไป','เฝ้าระวัง','เร่งด่วน','วิกฤต');
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.users(id uuid primary key references auth.users(id) on delete restrict,organization_id uuid not null references public.organizations(id),name text not null,role public.app_role not null default 'report_viewer',created_at timestamptz not null default now(),deleted_at timestamptz);
create table public.staff(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),user_id uuid unique references public.users(id),name text not null,position text not null,phone text,unit text,status text not null default 'พร้อม' check(status in ('พร้อม','ปฏิบัติงาน','ลา','ไม่พร้อม')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,unique(id,organization_id));
create table public.skills(id uuid primary key default gen_random_uuid(),name text not null unique);
insert into public.skills(name) values ('ดับเพลิง'),('กู้ภัย'),('กู้ชีพ'),('เรือ'),('ขับรถ'),('เครื่องตัดถ่าง'),('เลื่อยยนต์'),('สูบน้ำ'),('งานเชือก'),('SAR'),('ปฐมพยาบาล');
create table public.staff_skills(staff_id uuid not null references public.staff(id),skill_id uuid not null references public.skills(id),primary key(staff_id,skill_id));
create table public.vehicles(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,plate text,type text not null,water integer check(water>=0),status text not null default 'พร้อม' check(status in ('พร้อม','ปฏิบัติงาน','ซ่อม','ไม่พร้อม')),driver_id uuid,mileage integer check(mileage>=0),fuel numeric check(fuel between 0 and 100),notes text,lat double precision,lng double precision,position_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,unique(id,organization_id),foreign key(driver_id,organization_id) references public.staff(id,organization_id));
create table public.equipment(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,type text not null,total integer not null check(total>=0),broken integer not null default 0 check(broken>=0 and broken<=total),location text,checked_at timestamptz,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,unique(id,organization_id));
create table public.locations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,type text not null,address text,lat double precision not null check(lat between -90 and 90),lng double precision not null check(lng between -180 and 180),notes text,created_at timestamptz not null default now(),deleted_at timestamptz,unique(id,organization_id));
create table public.risk_locations(id uuid primary key default gen_random_uuid(),location_id uuid not null unique references public.locations(id),risk_type text not null,severity public.severity not null,details text,reviewed_at timestamptz,deleted_at timestamptz);
create sequence public.incident_number_seq;
create table public.incidents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),number text not null default ('DRC-'||(extract(year from now())::int+543)::text||'-'||lpad(nextval('public.incident_number_seq')::text,6,'0')),type text not null,title text not null,address text not null,area text,lat double precision not null check(lat between -90 and 90),lng double precision not null check(lng between -180 and 180),level public.severity not null default 'ทั่วไป',status public.incident_status not null default 'รับแจ้ง',reported_at timestamptz not null default now(),reporter text,phone text,channel text not null,description text,injured integer not null default 0 check(injured>=0),dead integer not null default 0 check(dead>=0),trapped integer not null default 0 check(trapped>=0),risks text[] not null default '{}',result text,damage text,problems text,commander_id uuid,commander_name text,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,unique(organization_id,number),unique(id,organization_id),foreign key(commander_id,organization_id) references public.staff(id,organization_id));
create table public.incident_timeline(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incidents(id),at timestamptz not null default now(),actor_id uuid not null references public.users(id),from_status public.incident_status,to_status public.incident_status not null,note text,operation_id uuid not null unique);
create table public.incident_staff(incident_id uuid not null,staff_id uuid not null,organization_id uuid not null,assigned_at timestamptz not null default now(),released_at timestamptz,primary key(incident_id,staff_id),foreign key(incident_id,organization_id) references public.incidents(id,organization_id),foreign key(staff_id,organization_id) references public.staff(id,organization_id));
create unique index staff_one_active_incident on public.incident_staff(staff_id) where released_at is null;
create table public.incident_vehicles(incident_id uuid not null,vehicle_id uuid not null,organization_id uuid not null,assigned_at timestamptz not null default now(),released_at timestamptz,primary key(incident_id,vehicle_id),foreign key(incident_id,organization_id) references public.incidents(id,organization_id),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id));
create unique index vehicle_one_active_incident on public.incident_vehicles(vehicle_id) where released_at is null;
create table public.incident_equipment(incident_id uuid not null,equipment_id uuid not null,organization_id uuid not null,quantity integer not null check(quantity>0),assigned_at timestamptz not null default now(),released_at timestamptz,primary key(incident_id,equipment_id),foreign key(incident_id,organization_id) references public.incidents(id,organization_id),foreign key(equipment_id,organization_id) references public.equipment(id,organization_id));
create table public.incident_photos(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incidents(id),phase text not null check(phase in ('ก่อนดำเนินการ','ระหว่างดำเนินการ','หลังดำเนินการ')),storage_path text not null unique,at timestamptz not null default now(),actor_id uuid not null references public.users(id),lat double precision check(lat between -90 and 90),lng double precision check(lng between -180 and 180),description text,deleted_at timestamptz);
create table public.checklists(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,incident_type text,deleted_at timestamptz);
create table public.checklist_items(id uuid primary key default gen_random_uuid(),checklist_id uuid not null references public.checklists(id),label text not null,required boolean not null default true,sort_order integer not null default 0,deleted_at timestamptz);
-- Snapshot labels preserve meaning after templates change.
create table public.incident_checklist_items(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incidents(id),template_item_id uuid references public.checklist_items(id),label text not null,required boolean not null default true,checked boolean not null default false,checked_by uuid references public.users(id),checked_at timestamptz,unique(incident_id,label));
create table public.reports(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incidents(id),revision integer not null,generated_by uuid not null references public.users(id),generated_at timestamptz not null default now(),snapshot jsonb not null,pdf_storage_path text,unique(incident_id,revision));
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),actor_id uuid references public.users(id),action text not null,entity text not null,entity_id uuid,at timestamptz not null default now(),old_value jsonb,new_value jsonb);
create table public.notification_outbox(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),incident_id uuid references public.incidents(id),kind text not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),delivered_at timestamptz,attempts integer not null default 0,last_error text);
create table public.sync_operations(id uuid primary key,organization_id uuid not null references public.organizations(id),actor_id uuid not null references public.users(id),result jsonb,created_at timestamptz not null default now());
create table public.external_integrations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),provider text not null,status text not null default 'รอเชื่อม API จริง',last_success_at timestamptz,unique(organization_id,provider));
create index incidents_org_status_date on public.incidents(organization_id,status,reported_at desc) where deleted_at is null;
create index incidents_area on public.incidents(organization_id,area);
create index timeline_incident_at on public.incident_timeline(incident_id,at);
create index audit_org_time on public.audit_logs(organization_id,at desc);
create index outbox_pending on public.notification_outbox(created_at) where delivered_at is null;

create index users_org on public.users(organization_id);
create index staff_org on public.staff(organization_id);
create index vehicles_org on public.vehicles(organization_id);
create index vehicles_driver_org on public.vehicles(driver_id,organization_id);
create index equipment_org on public.equipment(organization_id);
create index locations_org on public.locations(organization_id);
create index checklists_org on public.checklists(organization_id);
create index checklist_items_template on public.checklist_items(checklist_id);
create index staff_skills_skill on public.staff_skills(skill_id);
create index incident_created_by on public.incidents(created_by);
create index incident_commander on public.incidents(commander_id,organization_id);
create index timeline_actor on public.incident_timeline(actor_id);
create index assigned_staff_incident_org on public.incident_staff(incident_id,organization_id);
create index assigned_vehicle_incident_org on public.incident_vehicles(incident_id,organization_id);
create index assigned_equipment_incident_org on public.incident_equipment(incident_id,organization_id);
create index assigned_staff_org on public.incident_staff(organization_id);
create index assigned_staff_resource on public.incident_staff(staff_id,organization_id);
create index assigned_vehicle_org on public.incident_vehicles(organization_id);
create index assigned_vehicle_resource on public.incident_vehicles(vehicle_id,organization_id);
create index assigned_equipment_org on public.incident_equipment(organization_id);
create index assigned_equipment_resource on public.incident_equipment(equipment_id,organization_id);
create index photo_incident on public.incident_photos(incident_id);
create index photo_actor on public.incident_photos(actor_id);
create index incident_check_template on public.incident_checklist_items(template_item_id);
create index incident_check_actor on public.incident_checklist_items(checked_by);
create index report_actor on public.reports(generated_by);
create index audit_actor on public.audit_logs(actor_id);
create index outbox_org on public.notification_outbox(organization_id);
create index outbox_incident on public.notification_outbox(incident_id);
create index sync_org on public.sync_operations(organization_id);
create index sync_actor on public.sync_operations(actor_id);

-- Helpers bypass their own users RLS to avoid recursive policies.
create function private.my_org() returns uuid language sql stable security definer set search_path='' as $$select u.organization_id from public.users u join auth.users a on a.id=u.id where u.id=auth.uid() and u.deleted_at is null and a.email_confirmed_at is not null$$;
create function private.my_role() returns public.app_role language sql stable security definer set search_path='' as $$select u.role from public.users u join auth.users a on a.id=u.id where u.id=auth.uid() and u.deleted_at is null and a.email_confirmed_at is not null$$;
create function private.can_read_incident(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.incidents i where i.id=p_id and i.organization_id=private.my_org() and (private.my_role()<>'field_staff' or exists(select 1 from public.incident_staff a join public.staff s on s.id=a.staff_id where a.incident_id=i.id and s.user_id=auth.uid())))$$;
create function private.can_work_incident(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(
  private.can_read_incident(p_id)
  and private.my_role() in ('administrator','center_lead','dispatcher','field_staff')
  and (private.my_role()<>'field_staff' or exists(
   select 1 from public.incident_staff a join public.staff s on s.id=a.staff_id
   where a.incident_id=p_id and a.organization_id=private.my_org()
    and a.released_at is null and s.user_id=auth.uid() and s.deleted_at is null
  )),false)
$$;
create function private.is_center_editor() returns boolean language sql stable security definer set search_path='' as $$select coalesce(private.my_role() in ('administrator','center_lead','dispatcher'),false)$$;
-- RLS is enabled on EVERY public business table. No anonymous read policy.
do $$declare t text;begin foreach t in array array['organizations','users','staff','skills','staff_skills','vehicles','equipment','locations','risk_locations','incidents','incident_timeline','incident_staff','incident_vehicles','incident_equipment','incident_photos','checklists','checklist_items','incident_checklist_items','reports','audit_logs','notification_outbox','sync_operations','external_integrations'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy own_org on public.organizations for select to authenticated using(id=private.my_org());
create policy org_users on public.users for select to authenticated using(organization_id=private.my_org());
-- Role changes are performed by a guarded administrator RPC, never client UPDATE.
create policy skills_read on public.skills for select to authenticated using(true);
do $$declare t text;begin foreach t in array array['staff','vehicles','equipment','locations','checklists'] loop execute format('create policy org_read on public.%I for select to authenticated using (organization_id=private.my_org() and deleted_at is null)',t);end loop;end$$;
-- external_integrations has no deleted_at: replace its generated policy below.
create policy integration_read on public.external_integrations for select to authenticated using(organization_id=private.my_org());
create policy incident_read on public.incidents for select to authenticated using(private.can_read_incident(id) and deleted_at is null);
do $$declare t text;begin foreach t in array array['incident_timeline','incident_staff','incident_vehicles','incident_equipment','incident_photos','incident_checklist_items','reports'] loop execute format('create policy incident_read on public.%I for select to authenticated using(private.can_read_incident(incident_id))',t);end loop;end$$;
create policy staff_skills_read on public.staff_skills for select to authenticated using(exists(select 1 from public.staff s where s.id=staff_id and s.organization_id=private.my_org()));
create policy risk_read on public.risk_locations for select to authenticated using(exists(select 1 from public.locations l where l.id=location_id and l.organization_id=private.my_org()));
create policy checklist_read on public.checklist_items for select to authenticated using(exists(select 1 from public.checklists c where c.id=checklist_id and c.organization_id=private.my_org()));
create policy audit_read on public.audit_logs for select to authenticated using(organization_id=private.my_org() and private.my_role() in ('administrator','center_lead'));
create policy notifications_read on public.notification_outbox for select to authenticated using(organization_id=private.my_org() and private.my_role()<>'report_viewer');
create policy sync_read on public.sync_operations for select to authenticated using(actor_id=(select auth.uid()));
-- Resource writes use RLS; status occupancy still enforced by RPC & unique assignment index.
do $$declare t text;begin foreach t in array array['staff','vehicles','equipment','locations','checklists'] loop
 execute format('create policy center_insert on public.%I for insert to authenticated with check(organization_id=private.my_org() and private.is_center_editor())',t);
 execute format('create policy center_update on public.%I for update to authenticated using(organization_id=private.my_org() and private.is_center_editor()) with check(organization_id=private.my_org() and private.is_center_editor())',t);
end loop;end$$;
create policy photos_insert on public.incident_photos for insert to authenticated with check(private.can_work_incident(incident_id) and actor_id=(select auth.uid()) and storage_path like private.my_org()::text||'/'||incident_id::text||'/%');
create policy photos_update on public.incident_photos for update to authenticated using(private.can_work_incident(incident_id)) with check(private.can_work_incident(incident_id));
create policy check_update on public.incident_checklist_items for update to authenticated using(private.can_work_incident(incident_id)) with check(private.can_work_incident(incident_id) and checked_by=(select auth.uid()));
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare oldj jsonb;newj jsonb;org uuid;entity uuid;
begin oldj:=case when TG_OP='INSERT' then null else to_jsonb(old) end;newj:=case when TG_OP='DELETE' then null else to_jsonb(new) end;org:=coalesce((newj->>'organization_id')::uuid,(oldj->>'organization_id')::uuid);entity:=coalesce((newj->>'id')::uuid,(oldj->>'id')::uuid);if org is null then select organization_id into org from public.incidents where id=coalesce((newj->>'incident_id')::uuid,(oldj->>'incident_id')::uuid);end if;
insert into public.audit_logs(organization_id,actor_id,action,entity,entity_id,old_value,new_value) values(org,auth.uid(),TG_OP,TG_TABLE_NAME,entity,oldj,newj);return coalesce(new,old);end$$;
do $$declare t text;begin foreach t in array array['incidents','staff','vehicles','equipment','incident_staff','incident_vehicles','incident_equipment','incident_photos','incident_checklist_items','users'] loop execute format('create trigger audit_change after insert or update on public.%I for each row execute function public.audit_change()',t);end loop;end$$;
create function public.bump_version() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();new.version=old.version+1;return new;end$$;
do $$declare t text;begin foreach t in array array['incidents','staff','vehicles','equipment'] loop execute format('create trigger bump_version before update on public.%I for each row execute function public.bump_version()',t);end loop;end$$;
create function public.create_incident(p_operation uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=private.my_org();i public.incidents; prior jsonb;v_label text; result jsonb;
begin
 if not private.is_center_editor() then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 select s.result into prior from public.sync_operations s where s.id=p_operation and s.actor_id=auth.uid();if prior is not null then return prior;end if;
 insert into public.incidents(id,organization_id,type,title,address,area,lat,lng,level,reported_at,reporter,phone,channel,description,injured,dead,trapped,risks,created_by)
 values(coalesce((p_data->>'id')::uuid,gen_random_uuid()),org,p_data->>'type',coalesce(nullif(p_data->>'title',''),p_data->>'type'),p_data->>'address',p_data->>'area',(p_data->>'lat')::float8,(p_data->>'lng')::float8,(p_data->>'level')::public.severity,coalesce((p_data->>'reportedAt')::timestamptz,now()),p_data->>'reporter',p_data->>'phone',p_data->>'channel',p_data->>'description',coalesce((p_data->>'injured')::int,0),coalesce((p_data->>'dead')::int,0),coalesce((p_data->>'trapped')::int,0),array(select jsonb_array_elements_text(coalesce(p_data->'risks','[]'))),auth.uid()) returning * into i;
 insert into public.incident_timeline(incident_id,actor_id,to_status,operation_id) values(i.id,auth.uid(),'รับแจ้ง',p_operation);
 for v_label in select unnest(array['เจ้าหน้าที่ครบ','รถพร้อม','เชื้อเพลิงเพียงพอ','วิทยุพร้อม','PPE พร้อม','อุปกรณ์ครบ','ทราบพิกัดจุดเกิดเหตุ','ประเมินความเสี่ยงแล้ว']) loop insert into public.incident_checklist_items(incident_id,label) values(i.id,v_label);end loop;
 insert into public.incident_checklist_items(incident_id,template_item_id,label,required) select i.id,ci.id,ci.label,ci.required from public.checklist_items ci join public.checklists c on c.id=ci.checklist_id where c.organization_id=org and c.incident_type=i.type and c.deleted_at is null and ci.deleted_at is null on conflict(incident_id,label) do nothing;
 if i.type like '%ไฟ%' then insert into public.incident_checklist_items(incident_id,label) values(i.id,'ตรวจแหล่งน้ำและเส้นทางเข้าเหตุ') on conflict do nothing;elsif i.type='น้ำท่วม' then insert into public.incident_checklist_items(incident_id,label) values(i.id,'ตรวจเสื้อชูชีพและอุปกรณ์ทางน้ำ') on conflict do nothing;end if;
 insert into public.notification_outbox(organization_id,incident_id,kind,payload) values(org,i.id,case when i.level='วิกฤต' then 'critical_incident' else 'new_incident' end,jsonb_build_object('number',i.number));
 result:=to_jsonb(i);insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,org,auth.uid(),result);return result;
end$$;
create function public.transition_incident(p_operation uuid,p_incident uuid,p_expected_version integer,p_to public.incident_status,p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.incidents;prior jsonb;result jsonb;expected public.incident_status;order_states public.incident_status[]:=array['รับแจ้ง','ตรวจสอบ','จัดกำลัง','ออกปฏิบัติการ','ถึงเหตุ','ดำเนินการ','ควบคุมเหตุได้','เสร็จสิ้น']::public.incident_status[];
begin
 if not private.can_work_incident(p_incident) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 select s.result into prior from public.sync_operations s where s.id=p_operation and s.actor_id=auth.uid();if prior is not null then return prior;end if;
 select * into i from public.incidents where id=p_incident and deleted_at is null for update;
 if i.id is null then raise exception 'NOT_FOUND';end if;
 if i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_CLOSED';end if;
 if private.my_role()='field_staff' and p_to in ('ตรวจสอบ','จัดกำลัง','ยกเลิก') then raise exception 'FORBIDDEN';end if;
 expected:=order_states[array_position(order_states,i.status)+1];
 if p_to='ยกเลิก' then if nullif(trim(p_note),'') is null then raise exception 'CANCEL_REASON_REQUIRED';end if;else if p_to<>expected then raise exception 'INVALID_TRANSITION';end if;end if;
 if p_to='ออกปฏิบัติการ' then
 if not exists(select 1 from public.incident_staff where incident_id=i.id and released_at is null) or not exists(select 1 from public.incident_vehicles where incident_id=i.id and released_at is null) then raise exception 'TEAM_VEHICLE_REQUIRED';end if;
 if not exists(select 1 from public.incident_checklist_items where incident_id=i.id and required) or exists(select 1 from public.incident_checklist_items where incident_id=i.id and required and not checked) then raise exception 'CHECKLIST_INCOMPLETE';end if;end if;
 if p_to='เสร็จสิ้น' and (nullif(trim(i.result),'') is null or nullif(trim(i.commander_name),'') is null) then raise exception 'REPORT_REQUIRED';end if;
 update public.incidents set status=p_to,problems=case when p_to='ยกเลิก' then p_note else problems end where id=i.id returning to_jsonb(incidents.*) into result;
 insert into public.incident_timeline(incident_id,actor_id,from_status,to_status,note,operation_id) values(i.id,auth.uid(),i.status,p_to,p_note,p_operation);
 if p_to in ('เสร็จสิ้น','ยกเลิก') then
 update public.staff set status='พร้อม' where id in(select staff_id from public.incident_staff where incident_id=i.id and released_at is null);
 update public.vehicles set status='พร้อม' where id in(select vehicle_id from public.incident_vehicles where incident_id=i.id and released_at is null);
 update public.incident_staff set released_at=now() where incident_id=i.id and released_at is null;
 update public.incident_vehicles set released_at=now() where incident_id=i.id and released_at is null;
 update public.incident_equipment set released_at=now() where incident_id=i.id and released_at is null;
 end if;
 if p_to='เสร็จสิ้น' then insert into public.reports(incident_id,revision,generated_by,snapshot) values(i.id,(result->>'version')::int,auth.uid(),jsonb_build_object('incident',result,'timeline',(select jsonb_agg(t order by t.at) from public.incident_timeline t where t.incident_id=i.id),'staff',(select jsonb_agg(s) from public.staff s join public.incident_staff a on a.staff_id=s.id where a.incident_id=i.id),'vehicles',(select jsonb_agg(v) from public.vehicles v join public.incident_vehicles a on a.vehicle_id=v.id where a.incident_id=i.id),'equipment',(select jsonb_agg(jsonb_build_object('name',e.name,'quantity',a.quantity)) from public.equipment e join public.incident_equipment a on a.equipment_id=e.id where a.incident_id=i.id),'photos',(select jsonb_agg(p) from public.incident_photos p where p.incident_id=i.id and p.deleted_at is null)));end if;
 insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,i.organization_id,auth.uid(),result);return result;
end$$;
create function public.assign_resource(p_operation uuid,p_incident uuid,p_kind text,p_resource uuid,p_quantity integer default 1,p_release boolean default false,p_expected_version integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.incidents;prior jsonb;available integer;org uuid:=private.my_org();result jsonb;
begin
 if not private.is_center_editor() then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 select s.result into prior from public.sync_operations s where s.id=p_operation and s.actor_id=auth.uid();if prior is not null then return prior;end if;
 select * into i from public.incidents where id=p_incident and organization_id=org and deleted_at is null for update;
 if i.id is null or i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_UNAVAILABLE';end if;if p_expected_version is not null and i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if p_kind='staff' then
 perform 1 from public.staff where id=p_resource and organization_id=org and deleted_at is null for update;if not found then raise exception 'RESOURCE_NOT_FOUND';end if;
 if p_release then update public.incident_staff set released_at=now() where incident_id=i.id and staff_id=p_resource and released_at is null; if not found then raise exception 'NOT_ASSIGNED';end if;update public.staff set status='พร้อม' where id=p_resource;
 else if (select status from public.staff where id=p_resource)<>'พร้อม' then raise exception 'RESOURCE_BUSY';end if;insert into public.incident_staff(incident_id,staff_id,organization_id) values(i.id,p_resource,org) on conflict(incident_id,staff_id) do update set assigned_at=now(),released_at=null;update public.staff set status='ปฏิบัติงาน' where id=p_resource;end if;
 elsif p_kind='vehicles' then
 perform 1 from public.vehicles where id=p_resource and organization_id=org and deleted_at is null for update;if not found then raise exception 'RESOURCE_NOT_FOUND';end if;
 if p_release then update public.incident_vehicles set released_at=now() where incident_id=i.id and vehicle_id=p_resource and released_at is null;if not found then raise exception 'NOT_ASSIGNED';end if;update public.vehicles set status='พร้อม' where id=p_resource;
 else if (select status from public.vehicles where id=p_resource)<>'พร้อม' then raise exception 'RESOURCE_BUSY';end if;insert into public.incident_vehicles(incident_id,vehicle_id,organization_id) values(i.id,p_resource,org) on conflict(incident_id,vehicle_id) do update set assigned_at=now(),released_at=null;update public.vehicles set status='ปฏิบัติงาน' where id=p_resource;end if;
 elsif p_kind='equipment' then
 perform 1 from public.equipment where id=p_resource and organization_id=org and deleted_at is null for update;if not found then raise exception 'RESOURCE_NOT_FOUND';end if;
 if p_release then update public.incident_equipment set released_at=now() where incident_id=i.id and equipment_id=p_resource and released_at is null;
 else select e.total-e.broken-coalesce((select sum(a.quantity) from public.incident_equipment a where a.equipment_id=e.id and a.released_at is null and a.incident_id<>i.id),0) into available from public.equipment e where e.id=p_resource;if p_quantity<1 or p_quantity>available then raise exception 'INSUFFICIENT_EQUIPMENT';end if;
 insert into public.incident_equipment(incident_id,equipment_id,organization_id,quantity) values(i.id,p_resource,org,p_quantity) on conflict(incident_id,equipment_id) do update set quantity=p_quantity,assigned_at=now(),released_at=null;end if;
 else raise exception 'INVALID_RESOURCE_KIND';end if;
 update public.incidents set updated_at=now() where id=i.id returning to_jsonb(incidents.*) into result;
 insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,org,auth.uid(),result);return result;
end$$;
create function public.save_incident_result(p_operation uuid,p_incident uuid,p_expected_version integer,p_result text,p_damage text,p_problems text,p_commander text) returns jsonb language plpgsql security definer set search_path='' as $$declare i public.incidents;result jsonb;prior jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));select so.result into prior from public.sync_operations so where id=p_operation and actor_id=auth.uid();if prior is not null then return prior;end if;
 if not private.can_work_incident(p_incident) then raise exception 'FORBIDDEN';end if;select * into i from public.incidents where id=p_incident and deleted_at is null for update;if i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;if i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_CLOSED';end if;
 update public.incidents set result=p_result,damage=p_damage,problems=p_problems,commander_name=p_commander where id=i.id returning to_jsonb(incidents.*) into result;insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,i.organization_id,auth.uid(),result);return result;end$$;
create function public.soft_delete_incident(p_incident uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$begin
 if private.my_role() is null or private.my_role() not in ('administrator','center_lead') or nullif(trim(p_reason),'') is null then raise exception 'FORBIDDEN_OR_REASON_REQUIRED';end if;
 update public.incidents set deleted_at=now(),problems=coalesce(problems,'')||E'\nเหตุผลการซ่อน: '||p_reason where id=p_incident and organization_id=private.my_org() and status in ('เสร็จสิ้น','ยกเลิก');if not found then raise exception 'CLOSE_BEFORE_DELETE';end if;end$$;
-- Prevent role escalation; first administrator is provisioned by the agency using SQL.
create function public.set_user_role(p_user uuid,p_role public.app_role) returns void language plpgsql security definer set search_path='' as $$begin if private.my_role() is distinct from 'administrator' then raise exception 'FORBIDDEN';end if;if p_user=auth.uid() then raise exception 'SELF_ROLE_CHANGE_FORBIDDEN';end if;update public.users set role=p_role where id=p_user and organization_id=private.my_org();end$$;
create function public.set_incident_check(p_operation uuid,p_incident uuid,p_label text,p_checked boolean,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$declare i public.incidents;prior jsonb;result jsonb;begin
 if not private.can_work_incident(p_incident) then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));select s.result into prior from public.sync_operations s where id=p_operation and actor_id=auth.uid();if prior is not null then return prior;end if;
 select * into i from public.incidents where id=p_incident for update;if i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;if i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_CLOSED';end if;
 update public.incident_checklist_items set checked=p_checked,checked_by=auth.uid(),checked_at=now() where incident_id=p_incident and label=p_label;if not found then insert into public.incident_checklist_items(incident_id,label,checked,checked_by,checked_at) values(p_incident,p_label,p_checked,auth.uid(),now());end if;
 update public.incidents set updated_at=now() where id=p_incident returning to_jsonb(incidents.*) into result;insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,i.organization_id,auth.uid(),result);return result;end$$;
create function public.attach_incident_photos(p_operation uuid,p_incident uuid,p_photos jsonb,p_bump boolean default true,p_expected_version integer default null) returns jsonb language plpgsql security definer set search_path='' as $$declare i public.incidents;p jsonb;prior jsonb;result jsonb;photo_op uuid;begin
 if not private.can_work_incident(p_incident) then raise exception 'FORBIDDEN';end if;
 -- A create operation may include photos; derive a distinct idempotency key.
 photo_op:=case when not p_bump then md5(p_operation::text||'-photos')::uuid else p_operation end;
 perform pg_advisory_xact_lock(hashtextextended(photo_op::text,0));select s.result into prior from public.sync_operations s where id=photo_op and actor_id=auth.uid();if prior is not null then return prior;end if;
 select * into i from public.incidents where id=p_incident and deleted_at is null for update;if i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_CLOSED';end if;if p_expected_version is not null and i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 for p in select jsonb_array_elements(p_photos) loop
 if p->>'storage_path' not like i.organization_id::text||'/'||i.id::text||'/%' then raise exception 'INVALID_STORAGE_PATH';end if;
 insert into public.incident_photos(id,incident_id,phase,storage_path,at,actor_id,lat,lng,description) values((p->>'id')::uuid,i.id,p->>'phase',p->>'storage_path',(p->>'at')::timestamptz,auth.uid(),(p->>'lat')::float8,(p->>'lng')::float8,p->>'description') on conflict(id) do nothing;end loop;
 if p_bump then update public.incidents set updated_at=now() where id=i.id returning to_jsonb(incidents.*) into result;else result:=to_jsonb(i);end if;
 insert into public.sync_operations(id,organization_id,actor_id,result) values(photo_op,i.organization_id,auth.uid(),result);return result;end$$;
create function public.update_photo_description(p_operation uuid,p_incident uuid,p_photo uuid,p_description text,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$declare i public.incidents;prior jsonb;result jsonb;begin
 if not private.can_work_incident(p_incident) then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));select s.result into prior from public.sync_operations s where id=p_operation and actor_id=auth.uid();if prior is not null then return prior;end if;
 select * into i from public.incidents where id=p_incident and deleted_at is null for update;if i.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;if i.status in ('เสร็จสิ้น','ยกเลิก') then raise exception 'INCIDENT_CLOSED';end if;
 update public.incident_photos set description=p_description where id=p_photo and incident_id=i.id;if not found then raise exception 'PHOTO_NOT_FOUND';end if;update public.incidents set updated_at=now() where id=i.id returning to_jsonb(incidents.*) into result;insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,i.organization_id,auth.uid(),result);return result;end$$;
create function public.save_resource(p_operation uuid,p_kind text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare org uuid:=private.my_org();prior jsonb;result jsonb;rid uuid:=(p_data->>'id')::uuid;s text;begin
 if not private.is_center_editor() then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));select so.result into prior from public.sync_operations so where id=p_operation and actor_id=auth.uid();if prior is not null then return prior;end if;
 if p_kind='staff' then
 if exists(select 1 from public.staff where id=rid and organization_id<>org) then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from public.incident_staff where staff_id=rid and released_at is null) and p_data->>'status'<>'ปฏิบัติงาน' then raise exception 'RESOURCE_BUSY';end if;
 insert into public.staff(id,organization_id,name,position,phone,unit,status) values(rid,org,p_data->>'name',p_data->>'type',p_data->>'phone',p_data->>'unit',p_data->>'status') on conflict(id) do update set name=excluded.name,position=excluded.position,phone=excluded.phone,unit=excluded.unit,status=excluded.status returning to_jsonb(staff.*) into result;
 delete from public.staff_skills where staff_id=rid;
 for s in select jsonb_array_elements_text(coalesce(p_data->'skills','[]')) loop insert into public.staff_skills(staff_id,skill_id) select rid,id from public.skills where name=s on conflict do nothing;end loop;
 elsif p_kind='vehicles' then
 if exists(select 1 from public.vehicles where id=rid and organization_id<>org) then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from public.incident_vehicles where vehicle_id=rid and released_at is null) and p_data->>'status'<>'ปฏิบัติงาน' then raise exception 'RESOURCE_BUSY';end if;
 insert into public.vehicles(id,organization_id,name,type,plate,status,water,driver_id,mileage,fuel,notes) values(rid,org,p_data->>'name',p_data->>'type',p_data->>'plate',p_data->>'status',(p_data->>'water')::int,nullif(p_data->>'driver','')::uuid,(p_data->>'mileage')::int,(p_data->>'fuel')::numeric,p_data->>'notes') on conflict(id) do update set name=excluded.name,type=excluded.type,plate=excluded.plate,status=excluded.status,water=excluded.water,driver_id=excluded.driver_id,mileage=excluded.mileage,fuel=excluded.fuel,notes=excluded.notes returning to_jsonb(vehicles.*) into result;
 elsif p_kind='equipment' then
 if exists(select 1 from public.equipment where id=rid and organization_id<>org) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.equipment where id=rid for update;
 if coalesce((select sum(quantity) from public.incident_equipment where equipment_id=rid and released_at is null),0)>(p_data->>'total')::int-(p_data->>'broken')::int then raise exception 'EQUIPMENT_IN_USE';end if;
 insert into public.equipment(id,organization_id,name,type,total,broken,location,checked_at,notes) values(rid,org,p_data->>'name',p_data->>'type',(p_data->>'total')::int,(p_data->>'broken')::int,p_data->>'location',(p_data->>'checked')::timestamptz,p_data->>'notes') on conflict(id) do update set name=excluded.name,type=excluded.type,total=excluded.total,broken=excluded.broken,location=excluded.location,checked_at=excluded.checked_at,notes=excluded.notes returning to_jsonb(equipment.*) into result;
 else raise exception 'INVALID_RESOURCE_KIND';end if;
 insert into public.sync_operations(id,organization_id,actor_id,result) values(p_operation,org,auth.uid(),result);return result;end$$;

-- No RPC may be called anonymously.
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon;
grant execute on function private.my_org(),private.my_role(),private.can_read_incident(uuid),private.can_work_incident(uuid),private.is_center_editor(),public.create_incident(uuid,jsonb),public.transition_incident(uuid,uuid,integer,public.incident_status,text),public.assign_resource(uuid,uuid,text,uuid,integer,boolean,integer),public.save_incident_result(uuid,uuid,integer,text,text,text,text),public.soft_delete_incident(uuid,text),public.set_user_role(uuid,public.app_role),public.set_incident_check(uuid,uuid,text,boolean,integer),public.attach_incident_photos(uuid,uuid,jsonb,boolean,integer),public.update_photo_description(uuid,uuid,uuid,text,integer),public.save_resource(uuid,text,jsonb) to authenticated;
-- Supabase default privileges must not allow direct writes that bypass RPC guards.
revoke all on all tables in schema public from public,anon,authenticated;
revoke all on all sequences in schema public from public,anon,authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update on public.locations,public.checklists to authenticated;
-- Private storage: authenticated user must belong to the incident's organization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('incident-photos','incident-photos',false,15728640,array['image/jpeg','image/png','image/webp','image/heic']) on conflict(id) do nothing;
create policy incident_storage_read on storage.objects for select to authenticated using(bucket_id='incident-photos' and (storage.foldername(name))[1]=private.my_org()::text and private.can_read_incident(((storage.foldername(name))[2])::uuid));
create policy incident_storage_insert on storage.objects for insert to authenticated with check(bucket_id='incident-photos' and (storage.foldername(name))[1]=private.my_org()::text and private.can_work_incident(((storage.foldername(name))[2])::uuid));
commit;
