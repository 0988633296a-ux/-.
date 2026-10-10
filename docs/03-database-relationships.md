# Schema & Relationships

users → auth.users + organizations; incidents → organizations + users + staff(commander)
incident_timeline/photos/reports → incidents; incident_staff/vehicles/equipment → incidents + respective resource
checklist_items → checklists; incident_checklist_items → incidents + checklist_items
staff_skills → staff + skills; vehicles.driver_id → staff
locations → organizations; risk_locations → locations; audit_logs → users; notification_outbox → incidents
FK/unique pair; soft delete ข้อมูลหลัก; timeline/audit append-only; RLS หน่วยงาน/บทบาท
SQL implementation: supabase/schema.sql
