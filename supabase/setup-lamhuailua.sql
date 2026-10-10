-- รันหลัง schema.sql ใน Supabase SQL Editor โดยผู้ดูแลโปรเจกต์
-- สร้างบัญชีใน Authentication > Users ก่อน แล้วแทนอีเมลด้านล่าง
-- ไฟล์นี้ไม่สร้างเหตุ กำลังพล รถ หรืออุปกรณ์ตัวอย่างลงฐานข้อมูลจริง
begin;
do $$
declare
  v_admin_email text := 'REPLACE_WITH_ADMIN_EMAIL';
  v_admin_name text := 'ผู้ดูแล ปภ. ลำห้วยหลัว';
  v_org_name text := 'ปภ. ตำบลลำห้วยหลัว อำเภอสมเด็จ จังหวัดกาฬสินธุ์';
  v_auth_id uuid;
  v_org_id uuid;
  v_existing public.users%rowtype;
  v_count integer;
begin
  if v_admin_email = 'REPLACE_WITH_ADMIN_EMAIL' or position('@' in v_admin_email) = 0 then
    raise exception 'แทน REPLACE_WITH_ADMIN_EMAIL ด้วยอีเมลบัญชีผู้ดูแลที่สร้างใน Authentication ก่อนรัน';
  end if;
  select count(*), min(id::text)::uuid into v_count, v_auth_id
    from auth.users where lower(email) = lower(trim(v_admin_email));
  if v_count <> 1 then
    raise exception 'ต้องพบบัญชี Authentication ตรงกับอีเมลผู้ดูแลเพียงหนึ่งบัญชี กรุณาตรวจสอบ Authentication > Users';
  end if;
  -- Serialize organization setup to prevent duplicate agencies when run concurrently.
  perform pg_advisory_xact_lock(hashtextextended(v_org_name, 0));
  select count(*), min(id::text)::uuid into v_count, v_org_id
    from public.organizations where name = v_org_name;
  if v_count > 1 then
    raise exception 'พบชื่อหน่วยงานซ้ำ กรุณาตรวจสอบ organizations ก่อนผูกบัญชี';
  elsif v_count = 0 then
    insert into public.organizations(name) values(v_org_name) returning id into v_org_id;
  end if;
  select * into v_existing from public.users where id = v_auth_id;
  if found then
    if v_existing.organization_id <> v_org_id then
      raise exception 'บัญชีนี้ผูกกับหน่วยงานอื่นแล้ว ไฟล์ตั้งค่าจะไม่ย้ายหน่วยงานให้โดยอัตโนมัติ';
    end if;
    if v_existing.deleted_at is not null or v_existing.role <> 'administrator' then
      raise exception 'บัญชีเดิมไม่ได้เป็นผู้ดูแลที่เปิดใช้งาน กรุณาให้ผู้ดูแลโปรเจกต์ตรวจสอบสิทธิ์ก่อน';
    end if;
  else
    if exists(select 1 from public.users where organization_id = v_org_id and role = 'administrator' and deleted_at is null) then
      raise exception 'หน่วยงานมีผู้ดูแลแล้ว กรุณาใช้บัญชีผู้ดูแลเดิม ไฟล์ตั้งค่าจะไม่เพิ่มผู้ดูแลคนใหม่อัตโนมัติ';
    end if;
    insert into public.users(id, organization_id, name, role)
      values(v_auth_id, v_org_id, v_admin_name, 'administrator');
  end if;
end $$;
commit;
-- แสดงเพียงหน่วยงานและจำนวนบัญชี ไม่แสดงรหัสผ่านหรือคีย์
select o.name as organization,
       count(u.id) filter(where u.deleted_at is null) as active_users,
       count(u.id) filter(where u.role = 'administrator' and u.deleted_at is null) as administrators
from public.organizations o left join public.users u on u.organization_id = o.id
where o.name = 'ปภ. ตำบลลำห้วยหลัว อำเภอสมเด็จ จังหวัดกาฬสินธุ์'
group by o.id, o.name;
