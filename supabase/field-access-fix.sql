-- Existing projects: restrict field writes to current, non-deleted staff assignments.
-- Historical incident reads and existing function privileges remain unchanged.
begin;
create or replace function private.can_work_incident(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(
  private.can_read_incident(p_id)
  and private.my_role() in ('administrator','center_lead','dispatcher','field_staff')
  and (private.my_role()<>'field_staff' or exists(
   select 1 from public.incident_staff a join public.staff s on s.id=a.staff_id
   where a.incident_id=p_id and a.organization_id=private.my_org()
    and a.released_at is null and s.user_id=auth.uid() and s.deleted_at is null
  )),false)
$$;
commit;
