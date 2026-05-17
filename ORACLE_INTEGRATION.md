# Oracle and Application Integration Notes

**Project:** Blood Donation Compatibility Network  
**Stack:** Oracle (Docker) + FastAPI + React  
**SQL sources:** `backend/sql/` · applied by Alembic migrations in `backend/alembic/versions/`

This document explains how the Oracle database objects support the FastAPI and React application. It is written for someone opening the project for the first time: what each package, trigger, view, and supporting table does, where it is installed, and where it appears in the UI.

## 1. Object Map

| Oracle object | Type | App page / route | How it is used |
|---------------|------|------------------|----------------|
| `pkg_blood_operations` | Package | **Requests**, **Dashboard** | `process_blood_matches`; `calculate_distance_km` |
| `pkg_blood_management` | Package | **Dashboard** | `expire_old_blood_units` (admin) |
| `pkg_request_workflow` | Package | SQL/API extension point | Request lifecycle helpers and history lookup |
| `blood_network_pkg` | Package (wrapper) | API/E2E | Compatibility wrapper used by PL/SQL compatibility checks |
| `transfusion_request_history` | Table | **Audit Log**, **Blood Lab** | Filled by trigger + backfill; read by views/API |
| `app_notifications` | Table | **Dashboard** | Filled by notify trigger; read via `vw_notifications_feed` |
| `blood_unit_status_audit` | Table | *(DB audit)* | Filled by `trg_blood_units_audit_status` when unit status changes |
| `app_users` | Table | **Auth** | JWT login (`005` migration) |
| `vw_open_requests_by_facility` | View | **Home** | `GET /api/open-requests` |
| `vw_dashboard_*` (3 views) | Views | **Home**, **Dashboard**, **Analytics** | KPI charts |
| `vw_notifications_feed` | View | **Dashboard** | Recent notifications panel |
| `vw_audit_log` | View | **Audit Log** | `GET /api/audit/requests` |
| `vw_dispatch_detail` | View | **Logistics** | `GET /api/dispatches/` |
| `vw_unit_lineage` | View | **Blood Lab** (Provenance) | `GET /api/provenance/*` |
| `vw_compat_pairs_readable` | View | **Blood Lab** | `GET /api/compatibility/matrix` |
| `vw_admin_request_overview` | View | *(defined for APEX)* | Admin uses similar SQL inline in `admin.py` |
| `vw_staff_request_overview` | View | *(defined for APEX)* | Staff-scoped overview (not wired to React yet) |
| `vw_request_history_timeline` | View | *(defined)* | Enriched history; API queries table directly |
| 7 validation/audit triggers | Triggers | **All writes** | Enforce rules; populate audit/history/notifications |

## 2. Migration Order

| Revision | What it adds |
|----------|----------------|
| `001_base_schema` | Core tables: locations, blood types, compatibility matrix, facilities, donors, patients, donations, units, requests, transfers, dispatches |
| `002` | Blood types CSV + ABO/Rh rules into `compatibility_matrix` |
| `003` | Remaining CSV seed data |
| `004_run_oracle_plsql` | `package_of_all.sql` → `finalization_hardening.sql` → `workflow_gap_closure.sql` |
| `005_app_users` | `app_users` + admin account from `.env` |
| `006_test_branch_views` | `vw_dispatch_detail`, `vw_unit_lineage`, `vw_audit_log` |
| `007_backfill_request_history` | Backfill `transfusion_request_history` for pre-trigger seed rows |
| `008_compat_readable_view` | Installs `vw_compat_pairs_readable` for the Blood Lab compatibility matrix |

Run all migrations from `backend/`:

```powershell
poetry run python -m alembic upgrade head
```

Use `python -m alembic` instead of `poetry run alembic` if Windows launchers still reference an old virtual environment path.

## 3. PL/SQL Packages

### 3.1 `pkg_blood_operations` — core network operations

**File:** `backend/sql/package_of_all.sql`  
**Main ideas:** nested collections, `BULK COLLECT`, `FORALL`, Haversine distance, compatibility-driven matching.

| Member | Kind | Purpose |
|--------|------|---------|
| `check_compatibility(donor_id, recipient_id)` | Function → `'Y'/'N'` | Looks up `compatibility_matrix` |
| `calculate_distance_km(loc1, loc2)` | Function → km | Haversine on `geographic_locations` |
| `get_request_list(role, facility_id)` | Function → `t_request_tab` | Admin: all requests; Staff: one facility (`BULK COLLECT`) |
| `process_blood_matches` | Procedure | Auto-reserve compatible `Available` units for open requests |

`process_blood_matches` is the procedure behind the Requests page’s **Run Auto-Matching Algorithm** button.

1. Loop requests with status `Pending` or `Partially Fulfilled`.
2. For each, select up to `units_required` blood units: `Available`, not expired, donor type compatible with patient.
3. `FORALL` update units → `Reserved`.
4. Set request → `Completed` if count = required, else `Partially Fulfilled`.
5. `COMMIT`.

**App integration:**

| UI | API | PL/SQL call |
|----|-----|-------------|
| **Requests** → “Run Auto-Matching Algorithm” | `POST /api/requests/run-matching` | `BEGIN pkg_blood_operations.process_blood_matches; END;` |
| **Dashboard** → distance tool | `GET /api/dashboard/distance?fac1=&fac2=` | `pkg_blood_operations.calculate_distance_km(...)` in SQL |

The API now returns a more descriptive matching message with before/after counts for open requests, available units, and reserved units. This prevents the UI from showing a misleading success message when the procedure ran but had no open requests to process.

Current scope: matching reserves compatible units and updates request status. It does not create `match_dispatches` rows, does not store a request-to-unit assignment table, and does not currently sort by urgency before reserving.

### 3.2 `pkg_blood_management` — inventory & compatibility collections

**File:** `backend/sql/package_of_all.sql`

| Member | Kind | Purpose |
|--------|------|---------|
| `check_compatibility` | Function | Same matrix lookup as operations package |
| `get_compatible_donor_types(recipient_id)` | Function → nested table of IDs | `BULK COLLECT` from `compatibility_matrix` |
| `expire_old_blood_units` | Procedure | `BULK COLLECT` expired `Available` units → `FORALL` set `Expired` |

**App integration:**

| UI | API | PL/SQL call |
|----|-----|-------------|
| **Dashboard** → “Expire Old Units” (admin) | `POST /api/dashboard/expire-units` | `BEGIN pkg_blood_management.expire_old_blood_units; END;` |
| **Blood Lab** → compatible donors | `GET /api/compatibility/for-recipient/{id}` | Uses **view** `vw_compat_pairs_readable` (same data; package available for live demo in SQL*Plus) |

This package provides the second bulk operation in the project: batch-expiring old available units.

### 3.3 `pkg_request_workflow` — request lifecycle in PL/SQL

**File:** `backend/sql/workflow_gap_closure.sql`

| Member | Kind | Purpose |
|--------|------|---------|
| `create_request(...)` | Procedure | Validates patient, inserts `Pending` request |
| `update_request(...)` | Procedure | Blocks edit if `Completed`/`Cancelled` |
| `cancel_request(...)` | Procedure | Sets request + open dispatches cancelled; optional reason on history |
| `get_request_history(request_id)` | Function → collection | Reads `transfusion_request_history` |

**App integration today:**

| Path | What happens |
|------|----------------|
| **Requests** → “+ New Request” | FastAPI **direct `INSERT`** into `transfusion_requests` (triggers still fire) |
| **Blood Lab** → request history lookup | `GET /api/compatibility/request-history/{id}` reads **`transfusion_request_history` table** (not the package function) |
| SQL*Plus / APEX | Call `pkg_request_workflow.create_request` etc. |

The React app currently uses direct SQL inserts in FastAPI for request creation. The database triggers still fire, so request history and notifications remain consistent. The package can be treated as the database-side workflow API if the app is later moved to package calls.

### 3.4 `blood_network_pkg` — thin wrapper

**File:** `backend/sql/workflow_gap_closure.sql`

Delegates to `pkg_blood_operations`:

- `calculate_distance_km`
- `process_blood_matches`
- `check_compatibility`

**App integration:**

| API | Call |
|-----|------|
| `GET /api/plsql/compatibility/check?donor_type_id=&recipient_type_id=` | `SELECT blood_network_pkg.check_compatibility(:d, :r) FROM DUAL` |

## 4. Supporting Tables Added Around the Base Schema

### 4.1 `transfusion_request_history`

| Column | Role |
|--------|------|
| `history_id` | Identity PK |
| `request_id` | FK logical to request |
| `operation_type` | `INSERT` / `UPDATE` / `DELETE` |
| `old_status`, `new_status` | Status transitions |
| `old_units_required`, `new_units_required` | Unit count changes |
| `changed_at`, `changed_by` | Audit metadata |
| `change_note` | Free text |

**Populated by:** `trg_transfusion_requests_history` (after I/U/D on `transfusion_requests`).  
**Backfill:** `007` + `backfill_request_history.sql` for rows loaded before the trigger existed.  
**Read by:** `vw_audit_log`, `vw_request_history_timeline`, Audit page, Blood Lab history lookup.

The history table stores lifecycle facts, while the reporting views can join patient, facility, and blood type context around those facts.

### 4.2 `app_notifications`

| Column | Role |
|--------|------|
| `notification_id` | Identity PK |
| `request_id`, `facility_id` | Context |
| `recipient_role` | e.g. `STAFF` |
| `event_type` | `REQUEST_CREATED`, `STATUS_CHANGED` |
| `message_text` | Human-readable |
| `is_read` | `Y`/`N` |
| `created_at`, `created_by` | Metadata |

**Populated by:** `trg_transfusion_requests_notify` on insert and status change.  
**Read by:** `vw_notifications_feed` → Dashboard Notifications Feed.

These are in-app notifications, not browser push notifications. They are created automatically by the database trigger when a request is inserted or its status changes.

### 4.3 `blood_unit_status_audit`

| Column | Role |
|--------|------|
| `audit_id` | Identity PK |
| `unit_id` | Which unit |
| `old_status`, `new_status` | Transition |
| `changed_at`, `changed_by` | Metadata |

**Populated by:** `trg_blood_units_audit_status` when `blood_units.status` changes (e.g. auto-matching → `Reserved`, expiry → `Expired`).  
**App:** No dedicated page yet; available as a database-level audit trail for inventory integrity.

### 4.4 `app_users`

| Column | Role |
|--------|------|
| `user_id` | Identity PK |
| `email`, `password_hash` | Login |
| `role` | `admin` or `staff` |

**App:** `POST /api/auth/login`, JWT on all protected routes; admin-only actions (matching, expire units, admin page).

## 5. Triggers

### 5.1 Workflow and audit triggers (`workflow_gap_closure.sql`)

| Trigger | When | Effect |
|---------|------|--------|
| `trg_transfusion_requests_history` | AFTER INSERT/UPDATE/DELETE on `transfusion_requests` | Inserts row into `transfusion_request_history` when status or units change |
| `trg_transfusion_requests_notify` | AFTER INSERT or UPDATE OF `status` | Inserts into `app_notifications` (created / status changed) |

Creating a request produces history and notification rows. Running auto-matching can produce status-change history and notifications when requests move from `Pending` to `Completed` or `Partially Fulfilled`.

### 5.2 Validation and inventory audit triggers (`finalization_hardening.sql`)

| Trigger | When | Effect |
|---------|------|--------|
| `trg_blood_units_validate` | BEFORE INSERT/UPDATE on `blood_units` | Valid status enum; block `Available`/`Reserved` if past expiry |
| `trg_blood_units_audit_status` | AFTER UPDATE OF `status` on `blood_units` | Insert into `blood_unit_status_audit` |
| `trg_transfusion_requests_validate` | BEFORE INSERT/UPDATE on `transfusion_requests` | `units_required > 0`, date not future, valid status enum |
| `trg_unit_transfers_validate` | BEFORE INSERT/UPDATE on `unit_transfers` | Different facilities; no future transfer date |
| `trg_match_dispatches_validate` | BEFORE INSERT/UPDATE on `match_dispatches` | Non-negative distance; no future dispatch; valid dispatch status |

These triggers keep important invariants inside Oracle. For example, an expired unit cannot be set to `Available`, and an invalid request status cannot be inserted even if a client bypasses the frontend.

## 6. Views

### 6.1 Operational/UI views

| View | Definition gist | App |
|------|-----------------|-----|
| `vw_open_requests_by_facility` | Pending + partial requests with patient, blood type, facility | **Home** — `GET /api/open-requests` |
| `vw_audit_log` | Request history with formatted time and change metadata; SQL source also includes joins for patient/facility context | **Audit Log** — `GET /api/audit/requests` |
| `vw_dispatch_detail` | Dispatch + request urgency + destination facility | **Logistics** — `GET /api/dispatches/` |
| `vw_unit_lineage` | Unit → donation → donor → blood type | **Blood Lab** — provenance APIs |
| `vw_compat_pairs_readable` | Donor/recipient labels on `compatibility_matrix` | **Blood Lab** — matrix & donor lookup |
| `vw_notifications_feed` | Notifications + facility name | **Dashboard** — `GET /api/dashboard/notifications` |
| `vw_request_history_timeline` | History + patient + facility names | Available in DB; API uses base table |

### 6.2 Role & dashboard views (`finalization_hardening.sql`)

| View | Purpose | App |
|------|---------|-----|
| `vw_admin_request_overview` | All requests with facility | Pattern used by **Admin** (inline SQL joins same tables) |
| `vw_staff_request_overview` | Requests with `facility_id` for staff filter | Ready for staff-scoped UI |
| `vw_dashboard_inventory_by_status` | `COUNT(*)` by unit status | **Home**, **Dashboard**, **Analytics** |
| `vw_dashboard_requests_by_status` | `COUNT(*)` by request status | Same |
| `vw_dashboard_dispatch_performance` | Count + avg distance by dispatch status | **Home**, **Dashboard** |

### 6.3 `vw_compat_pairs_readable` and migration `008`

The compatibility matrix table uses numeric foreign keys. That is good for referential integrity, but not friendly for UI screens. `vw_compat_pairs_readable` joins `compatibility_matrix` to `blood_types` twice:

- once for the donor blood type label
- once for the recipient blood type label

The view powers the Blood Lab compatibility matrix and donor lookup endpoints. It is installed by `008_compat_readable_view.py`, which executes `backend/sql/create_view_compat_table.sql`.

## 7. Demo and repeatable data preparation

The app now includes a small demo helper for repeated local presentations:

- SQL file: `backend/sql/demo_restore_inventory.sql`
- API route: `POST /api/dashboard/demo-restore-inventory`
- UI: **Dashboard** → **Prepare Auto-Matching Demo**

This helper is not a replacement for seed data. It prepares the current dev database for another matching run by:

1. Moving a bounded number of non-expired `Reserved` units back to `Available`.
2. Creating a few `Pending` demo requests if the open request queue is empty.

This solves the common local-development issue where repeated matching tests leave all requests `Completed`, so running the matching procedure again becomes a valid no-op. After the helper runs, `process_blood_matches` has both available inventory and open requests to process.

## 8. App Pages and Database Touchpoints

| Page | Route | Main DB objects |
|------|-------|-----------------|
| **Home** | `/` | `vw_open_requests_by_facility`, `vw_dashboard_*` |
| **Audit Log** | `/audit` | `vw_audit_log` ← `transfusion_request_history` |
| **Requests** | `/requests` | `transfusion_requests` + triggers; `pkg_blood_operations.process_blood_matches` |
| **Dashboard** | `/dashboard` | Dashboard views, `vw_notifications_feed`, KPI SQL, `pkg_blood_operations`, `pkg_blood_management` |
| **Logistics** | `/dispatches` | `vw_dispatch_detail`, `match_dispatches`, map SQL on facilities |
| **Blood Lab** | `/compatibility` | `vw_compat_pairs_readable`, `vw_unit_lineage`, `transfusion_request_history`, `blood_network_pkg` |
| **Admin** | `/admin` | `transfusion_requests` + joins (same shape as `vw_admin_request_overview`) |
| **Auth** | `/auth` | `app_users` |

## 9. Useful SQL Checks

```sql
-- Compatibility
SELECT pkg_blood_operations.check_compatibility(1, 3) FROM DUAL;

-- Distance between two location IDs
SELECT pkg_blood_operations.calculate_distance_km(1, 2) FROM DUAL;

-- Auto-matching (same as the button)
BEGIN pkg_blood_operations.process_blood_matches; END;
/

-- Expire units (same as Dashboard admin button)
BEGIN pkg_blood_management.expire_old_blood_units; END;
/

-- Wrapper package
SELECT blood_network_pkg.check_compatibility(1, 3) FROM DUAL;

-- Request workflow (package API)
DECLARE v_id NUMBER; BEGIN
  pkg_request_workflow.create_request(901, 2, 2, TRUNC(SYSDATE), v_id);
END;
/

-- Prove audit trigger
SELECT * FROM transfusion_request_history WHERE request_id = :id ORDER BY changed_at DESC;

-- Views
SELECT COUNT(*) FROM vw_open_requests_by_facility;
SELECT * FROM vw_audit_log FETCH FIRST 10 ROWS ONLY;
```

## 10. Repository Reference

| Topic | Path |
|-------|------|
| Packages 1–2 | `backend/sql/package_of_all.sql` |
| Packages 3–4 + workflow triggers/views | `backend/sql/workflow_gap_closure.sql` |
| Validation triggers + dashboard views + `blood_unit_status_audit` | `backend/sql/finalization_hardening.sql` |
| Dispatch / provenance / audit views | `backend/sql/create_view_*.sql` |
| Compatibility matrix view | `backend/sql/create_view_compat_table.sql`, `backend/alembic/versions/008_compat_readable_view.py` |
| Demo data preparation | `backend/sql/demo_restore_inventory.sql`, `POST /api/dashboard/demo-restore-inventory` |
| API routers | `backend/app/routers/*.py` |
| Frontend pages | `frontend/src/pages/*.tsx` |

## Integration Checks

Run:

`cd backend && poetry run python scripts/e2e_defense_test.py --oracle`

(Add `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` to `.env`, or pass `--admin-email` / `--admin-password`. Use `--db-only` to test Oracle without API login.)
