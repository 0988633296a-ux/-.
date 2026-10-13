# Field Readiness Fix Implementation Plan

> **For agentic workers:** Use Superpowers TDD and a final independent review. User approved execution by “จัดการเลย” following the audit.

**Goal:** Fix the seven verified safety, offline and draft defects without losing existing incidents or pending operations.
**Architecture:** Preserve Next.js/static Sites and Supabase RPC. Restrict field write checks, restore user-scoped cached workspace, and atomically merge captured photos into current state. Store draft photos immediately in IndexedDB and namespace drafts by connection/account.
**Tech Stack:** React/TypeScript, Supabase/Postgres, IndexedDB, Playwright/PGlite.
**Spec:** /workspace/disaster-response-review-2026-10-13.md findings 1–7.

## Global Constraints
- Thai UI; retain historical incident read and audit trail; no deletion of queued data.
- No live incident creation or LINE test messages during QA.
- Preserve owner-private Sites access and current LINE group configuration.
- Legacy unscoped drafts must not migrate into another user's account implicitly.

## Review Focus
- Offline reload with cached authenticated session vs expired/no session.
- Account switch while asynchronous GPS/photo work is running.
- A deliberate historical reported time in a recovered draft.
- Storage/quota failure during photo save; invalid MIME before queuing.
- Field assignment revoked but history still readable.

## Tasks
1. Restrict field writes: schema.sql + field-access-fix.sql; tests/field-access.mjs. RED released authenticated field user can mutate; GREEN reject revoked writes, preserve active/center access and historical read.
2. Restore real offline workspace: page.tsx + cached account metadata scoped by connection/user. Browser RED offline reload displays demo; GREEN cached real data stays accessible, pending commands remain scoped, account/role validation occurs before online sync.
3. Capture photos safely: page.tsx. Browser RED delayed GPS overwrites checklist; GREEN merge only captured photos into latest matching incident; reject expired account epoch/closed incident; invalid MIME cannot enter queue.
4. Preserve scoped drafts and photos: IncidentForm.tsx + incident-drafts.ts. RED shared draft/photo loss; GREEN account isolation, durable blobs, visible recovered time and explicit current-time action, supported MIME checks.
5. Verify all suites + build, independent review; apply guarded DB patch and verify definition/grants; sync Sites/GitHub sources and publish owner-private archive.

## Execution Ledger
- Baseline: 10 suites + TypeScript passed during audit; added reproductions confirmed released write, offline restore, photo/checklist race and draft loss.
- Ruling: approval to “จัดการเลย” authorizes implementing the concrete audit fixes and routine reversible checkout/publish steps; no repeated approval flow.
- Ruling: no new LINE status notification feature in this bugfix; findings 1–7 are scope, optional improvements are separate.
- Ruling: independent file ownership permits database and form fixes in parallel; coordinator owns page.tsx, integration and publication.
- Tasks 1–4 complete: regressions fail on old code/bundle, pass after minimal fixes. Database helper deployed and definition/grants verified.
- Ruling: reviewer found scope keys alone insufficient during live connection change; added live connection guard, captured client/scope checks, and scoped outbox/cache. Unknown legacy queues retained with backup banner instead of automatic migration.
- Ruling: late GPS callback after closed intake could resurrect submitted draft; generation guard covers GPS/photo/save and remount.
- Final independent source review: prior Important findings addressed; no new Important findings in these fixes.
- Final tests: 14 suites, patch upgrade regression, build/type checking; publication retains owner-private audience.
