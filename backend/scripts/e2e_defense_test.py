#!/usr/bin/env python3
"""
End-to-end API tests for DEFENSE_PREP.md integrations.

Usage (from backend/, Oracle + uvicorn running):
  poetry run python scripts/e2e_defense_test.py
  poetry run python scripts/e2e_defense_test.py --base-url http://127.0.0.1:8000
  poetry run python scripts/e2e_defense_test.py --skip-writes   # read-only
  poetry run python scripts/e2e_defense_test.py --oracle        # also verify PL/SQL in DB

Loads blood_donation_network/.env for DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# Load .env from blood_donation_network/ (and backend/ fallback)
_ROOT = Path(__file__).resolve().parents[2]
_BACKEND = Path(__file__).resolve().parents[1]


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(_ROOT / ".env")
        load_dotenv(_BACKEND / ".env")
        return
    except ImportError:
        pass
    for env_path in (_ROOT / ".env", _BACKEND / ".env"):
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()


@dataclass
class Case:
    defense_ref: str
    name: str
    method: str
    path: str
    ok: bool = False
    status: int | None = None
    detail: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


def _wait_for_health(base: str, attempts: int = 30, delay_sec: float = 1.0) -> None:
    """Wait until FastAPI is up (avoids racing uvicorn reload)."""
    last_err: Exception | None = None
    for _ in range(attempts):
        try:
            status, _ = _request(base, "GET", "/health", retries=0)
            if status == 200:
                return
        except Exception as e:
            last_err = e
        time.sleep(delay_sec)
    raise RuntimeError(
        f"Backend not ready at {base}/health after {attempts}s. "
        "Start: poetry run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    ) from last_err


def _request(
    base: str,
    method: str,
    path: str,
    *,
    token: str | None = None,
    body: dict | None = None,
    query: dict | None = None,
    retries: int = 5,
) -> tuple[int, Any]:
    url = base.rstrip("/") + path
    if query:
        qs = urlencode({k: v for k, v in query.items() if v is not None})
        url = f"{url}?{qs}" if qs else url
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method.upper())

    last_conn_err: Exception | None = None
    for attempt in range(max(1, retries)):
        try:
            with urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                status = resp.status
            last_conn_err = None
            break
        except HTTPError as e:
            status = e.code
            raw = e.read().decode("utf-8", errors="replace")
            last_conn_err = None
            break
        except (URLError, ConnectionResetError, OSError) as e:
            last_conn_err = e
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            hint = (
                " Connection reset — uvicorn may be reloading (WinError 10054). "
                "Restart API without --reload, or wait until reload finishes."
            )
            raise RuntimeError(f"Cannot reach {url}: {e}.{hint}") from e

    if last_conn_err is not None:
        raise RuntimeError(f"Cannot reach {url}: {last_conn_err}") from last_conn_err

    try:
        parsed = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        parsed = raw
    return status, parsed


def _expect_2xx(status: int) -> bool:
    return 200 <= status < 300


def _admin_login_hint() -> str:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return ""
    try:
        from sqlalchemy import create_engine, text

        with create_engine(db_url).connect() as conn:
            rows = conn.execute(
                text("SELECT email, role FROM app_users ORDER BY role, email")
            ).mappings().all()
        if not rows:
            return "  (app_users is empty — run: poetry run alembic upgrade head)"
        lines = ["  Accounts in app_users:"]
        for r in rows:
            lines.append(f"    - {r['email']} ({r['role']})")
        return "\n".join(lines)
    except Exception as e:
        return f"  (Could not list app_users: {e})"


def run_oracle_checks() -> list[Case]:
    """Direct DB checks for objects not exposed via FastAPI."""
    cases: list[Case] = []
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        cases.append(
            Case(
                "§3.3 pkg_request_workflow",
                "Oracle direct (skipped)",
                "-",
                "-",
                ok=False,
                detail="DATABASE_URL not set in .env",
            )
        )
        return cases

    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        cases.append(
            Case("Oracle", "sqlalchemy import", "-", "-", ok=False, detail="sqlalchemy missing")
        )
        return cases

    engine = create_engine(db_url)

    def add(ref: str, name: str, sql: str, check) -> None:
        try:
            with engine.connect() as conn:
                row = conn.execute(text(sql)).mappings().first()
            ok = bool(check(row))
            cases.append(
                Case(ref, name, "SQL", sql[:60] + "...", ok=ok, detail=str(dict(row) if row else {}))
            )
        except Exception as e:
            err = str(e)
            hint = ""
            if "ORA-00942" in err and "vw_compat" in name.lower():
                hint = " Run backend/sql/create_view_compat_table.sql"
            cases.append(Case(ref, name, "SQL", "-", ok=False, detail=err[:200] + hint))

    add(
        "§3.1 pkg_blood_operations",
        "check_compatibility via package",
        "SELECT pkg_blood_operations.check_compatibility(1, 1) AS flag FROM DUAL",
        lambda r: r and r["flag"] in ("Y", "N"),
    )
    add(
        "§3.1 calculate_distance_km",
        "distance function",
        """SELECT pkg_blood_operations.calculate_distance_km(
            (SELECT MIN(location_id) FROM geographic_locations),
            (SELECT MAX(location_id) FROM geographic_locations)
        ) AS km FROM DUAL""",
        lambda r: r is not None and float(r["km"]) >= 0,
    )
    add(
        "§3.4 blood_network_pkg",
        "wrapper check_compatibility",
        "SELECT blood_network_pkg.check_compatibility(1, 2) AS flag FROM DUAL",
        lambda r: r and r["flag"] in ("Y", "N"),
    )
    add(
        "§6 vw_compat_pairs_readable",
        "compat view row count",
        "SELECT COUNT(*) AS cnt FROM vw_compat_pairs_readable",
        lambda r: r and int(r["cnt"]) > 0,
    )
    add(
        "§6 vw_request_history_timeline",
        "history timeline view",
        "SELECT COUNT(*) AS cnt FROM vw_request_history_timeline",
        lambda r: r and int(r["cnt"]) > 0,
    )
    add(
        "§4 transfusion_request_history",
        "history table rows",
        "SELECT COUNT(*) AS cnt FROM transfusion_request_history",
        lambda r: r and int(r["cnt"]) > 0,
    )
    add(
        "§4 app_notifications",
        "notifications table",
        "SELECT COUNT(*) AS cnt FROM app_notifications",
        lambda r: r is not None,
    )
    add(
        "§4 blood_unit_status_audit",
        "unit status audit table",
        "SELECT COUNT(*) AS cnt FROM blood_unit_status_audit",
        lambda r: r is not None,
    )

  # pkg_request_workflow reads same rows as get_request_history (demo in SQL*Plus)
    try:
        with engine.connect() as conn:
            rid = conn.execute(text("SELECT MIN(request_id) FROM transfusion_requests")).scalar()
            cnt = conn.execute(
                text("SELECT COUNT(*) FROM transfusion_request_history WHERE request_id = :rid"),
                {"rid": rid},
            ).scalar()
        cnt = int(cnt) if cnt is not None else 0
        cases.append(
            Case(
                "§3.3 pkg_request_workflow",
                "get_request_history data present",
                "SQL",
                "-",
                ok=rid is not None and cnt >= 0,
                detail=f"request_id={rid} history_rows={cnt} (call package in SQL*Plus for demo)",
            )
        )
    except Exception as e:
        cases.append(
            Case("§3.3 pkg_request_workflow", "get_request_history data", "-", "-", ok=False, detail=str(e))
        )

    return cases


def main() -> int:
    parser = argparse.ArgumentParser(description="DEFENSE_PREP end-to-end API tests")
    parser.add_argument("--base-url", default=os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--skip-writes", action="store_true", help="Do not POST create/match/expire")
    parser.add_argument("--oracle", action="store_true", help="Run direct Oracle SQL checks")
    parser.add_argument(
        "--db-only",
        action="store_true",
        help="Only run Oracle SQL checks (no API / no admin password)",
    )
    parser.add_argument("--admin-email", default=os.environ.get("DEV_ADMIN_EMAIL", ""))
    parser.add_argument("--admin-password", default=os.environ.get("DEV_ADMIN_PASSWORD", ""))
    args = parser.parse_args()
    base = args.base_url

    if args.db_only:
        return _print_report(run_oracle_checks())

    try:
        _wait_for_health(base)
    except RuntimeError as e:
        print(f"ERROR: {e}")
        return 1

    admin_email = (
        (args.admin_email or "").strip()
        or os.environ.get("E2E_ADMIN_EMAIL", "").strip()
    )
    admin_password = args.admin_password or os.environ.get("E2E_ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        hint = _admin_login_hint()
        print("ERROR: Admin credentials required for E2E tests.")
        print("  Add to blood_donation_network/.env:")
        print("    DEV_ADMIN_EMAIL=admin@local.dev")
        print("    DEV_ADMIN_PASSWORD=<your login password>")
        print("  Or run:")
        print("    poetry run python scripts/e2e_defense_test.py --admin-email YOU --admin-password YOU")
        if hint:
            print(hint)
        return 1

    results: list[Case] = []
    token: str | None = None
    staff_token: str | None = None

    def run(
        ref: str,
        name: str,
        method: str,
        path: str,
        *,
        auth: bool = True,
        body: dict | None = None,
        query: dict | None = None,
        token_override: str | None = None,
        expect_status: int | None = None,
    ) -> tuple[int, Any]:
        t = token_override if token_override is not None else (token if auth else None)
        status, data = _request(base, method, path, token=t, body=body, query=query)
        ok = status == expect_status if expect_status is not None else _expect_2xx(status)
        detail = ""
        if isinstance(data, dict) and "detail" in data:
            detail = str(data["detail"])[:120]
        elif not ok:
            detail = str(data)[:120] if data else ""
        results.append(
            Case(ref, name, method, path, ok=ok, status=status, detail=detail, extra={"sample": _sample(data)})
        )
        return status, data

    def _sample(data: Any) -> Any:
        if isinstance(data, list):
            return f"list[{len(data)}]"
        if isinstance(data, dict):
            if "items" in data:
                return {"total": data.get("total"), "items": len(data.get("items") or [])}
            return {k: data[k] for k in list(data.keys())[:5]}
        return data

    # ── Public / health ─────────────────────────────────────────────────────
    run("§7", "Health", "GET", "/health", auth=False)
    run("§7 Auth", "Public network stats", "GET", "/api/public/network-stats", auth=False)

    # ── Login ───────────────────────────────────────────────────────────────
    st, data = run("§4 app_users", "Admin login", "POST", "/api/auth/login", auth=False, body={
        "email": admin_email,
        "password": admin_password,
    })
    if not _expect_2xx(st) or not isinstance(data, dict):
        print("FATAL: admin login failed — start uvicorn and check .env")
        _print_report(results)
        return 1
    token = data["access_token"]

    run("§7 Auth", "Auth me", "GET", "/api/auth/me")

    # Staff register + login (for 403 checks)
    staff_email = f"e2e-staff-{uuid.uuid4().hex[:8]}@local.dev"
    st_reg, _ = _request(
        base, "POST", "/api/auth/register", body={
            "email": staff_email,
            "password": "E2eStaffPass1!",
        }
    )
    if st_reg == 200:
        _, staff_data = _request(
            base, "POST", "/api/auth/login", body={
                "email": staff_email,
                "password": "E2eStaffPass1!",
            }
        )
        if isinstance(staff_data, dict):
            staff_token = staff_data.get("access_token")

    # ── Views: Home / Admin / Dashboard ───────────────────────────────────────
    run("§6 vw_open_requests", "Open requests paged", "GET", "/api/open-requests", query={
        "page": 1, "page_size": 10,
    })
    run("§6 vw_open_requests", "Open requests filter-options", "GET", "/api/open-requests/filter-options")
    run("§6 vw_dashboard_*", "Dashboard inventory by status", "GET", "/api/dashboard/inventory-by-status")
    run("§6 vw_dashboard_*", "Dashboard requests by status", "GET", "/api/dashboard/requests-by-status")
    run("§6 vw_dashboard_*", "Dispatch performance view", "GET", "/api/dashboard/dispatch-performance")
    run("§6 vw_dashboard_*", "Dashboard KPI", "GET", "/api/dashboard/kpi")
    run("§6 vw_notifications_feed", "Notifications feed", "GET", "/api/dashboard/notifications", query={"limit": 10})
    run("§6 vw_open_requests", "Open by facility (dashboard)", "GET", "/api/dashboard/open-by-facility")
    run("§6", "Analytics summary", "GET", "/api/analytics/summary")

    st_fac, fac_data = run("§3.1 distance", "List facilities", "GET", "/api/dashboard/facilities")
    fac1 = fac2 = None
    if isinstance(fac_data, list) and len(fac_data) >= 2:
        fac1 = fac_data[0].get("facility_id")
        fac2 = fac_data[1].get("facility_id")
        if fac1 == fac2 and len(fac_data) > 2:
            fac2 = fac_data[2].get("facility_id")
    if fac1 is not None and fac2 is not None:
        run(
            "§3.1 pkg_blood_operations.calculate_distance_km",
            "Distance calculator",
            "GET",
            "/api/dashboard/distance",
            query={"fac1": fac1, "fac2": fac2},
        )

    # ── Admin overview (vw_admin pattern) ─────────────────────────────────────
    run("§6 vw_admin_request_overview", "Admin request overview", "GET", "/api/admin/request-overview", query={
        "page": 1, "page_size": 10,
    })
    run("§6 vw_admin_request_overview", "Admin filter-options", "GET", "/api/admin/request-overview/filter-options")

    # ── Audit / Logistics / Provenance / Compatibility ────────────────────────
    run("§6 vw_audit_log", "Audit log", "GET", "/api/audit/requests")
    run("§6 vw_dispatch_detail", "Dispatches list", "GET", "/api/dispatches/")
    run("§6 vw_dispatch_detail", "Dispatch map points", "GET", "/api/dispatches/map-points")
    run("§6 vw_unit_lineage", "Provenance units list", "GET", "/api/provenance/units")

    st_u, units = run("§6 vw_unit_lineage", "Provenance unit detail", "GET", "/api/provenance/1")
    if isinstance(units, dict) and units.get("detail"):
        # try first id from list
        st_l, lst = _request(base, "GET", "/api/provenance/units", token=token)
        if isinstance(lst, list) and lst:
            uid = lst[0].get("unit_id") or lst[0].get("UNIT_ID")
            if uid:
                run("§6 vw_unit_lineage", f"Provenance unit {uid}", "GET", f"/api/provenance/{uid}")

    run("§6 vw_compat_pairs_readable", "Compatibility matrix", "GET", "/api/compatibility/matrix")
    run("§6", "Blood types", "GET", "/api/compatibility/blood-types")

    st_bt, btypes = _request(base, "GET", "/api/compatibility/blood-types", token=token)
    donor_id = recip_id = None
    if isinstance(btypes, list) and btypes:
        donor_id = btypes[0].get("id") or btypes[0].get("ID")
        recip_id = btypes[-1].get("id") if len(btypes) > 1 else donor_id
    if recip_id is not None:
        run("§6 vw_compat_pairs_readable", "Compatible donors for recipient", "GET",
            f"/api/compatibility/for-recipient/{recip_id}")
    if donor_id is not None and recip_id is not None:
        run("§3", "Compatibility check (Python rules)", "GET", "/api/compatibility/check", query={
            "donor_type_id": donor_id, "recipient_type_id": recip_id,
        })
        run(
            "§3.4 blood_network_pkg.check_compatibility",
            "Compatibility check (PL/SQL wrapper)",
            "GET",
            "/api/plsql/compatibility/check",
            query={"donor_type_id": donor_id, "recipient_type_id": recip_id},
        )

    st_req, req_list = run("§7 Requests", "Requests list", "GET", "/api/requests/")
    request_id_for_history = None
    if isinstance(req_list, list) and req_list:
        request_id_for_history = req_list[0].get("request_id")
    if request_id_for_history:
        run(
            "§4 transfusion_request_history",
            "Request history by id",
            "GET",
            f"/api/compatibility/request-history/{request_id_for_history}",
        )

    run("§7 Requests", "Patients for new request", "GET", "/api/requests/patients")

    # ── Write paths (triggers + PL/SQL) ───────────────────────────────────────
    if not args.skip_writes:
        st_p, patients = _request(base, "GET", "/api/requests/patients", token=token)
        patient_id = None
        if isinstance(patients, list) and patients:
            patient_id = patients[0].get("patient_id")

        audit_before = 0
        st_a, audit_data = _request(base, "GET", "/api/audit/requests", token=token)
        if isinstance(audit_data, list):
            audit_before = len(audit_data)

        run(
            "Demo restore",
            "Restore demo inventory (admin)",
            "POST",
            "/api/dashboard/demo-restore-inventory",
        )

        if patient_id:
            run(
                "§5 trg_transfusion_requests_history/notify",
                "Create transfusion request (triggers)",
                "POST",
                "/api/requests/",
                body={
                    "patient_id": patient_id,
                    "units_requested": 1,
                    "urgency_level": 3,
                },
            )
            time.sleep(0.3)
            st_a2, audit_after_data = _request(base, "GET", "/api/audit/requests", token=token)
            audit_after = len(audit_after_data) if isinstance(audit_after_data, list) else 0
            results.append(
                Case(
                    "§5 triggers",
                    "Audit grew after create",
                    "-",
                    "-",
                    ok=audit_after > audit_before,
                    detail=f"before={audit_before} after={audit_after}",
                )
            )

        run(
            "§3.1 process_blood_matches",
            "Run auto-matching (admin)",
            "POST",
            "/api/requests/run-matching",
        )

        if staff_token:
            run(
                "§3.1 process_blood_matches",
                "Run matching denied for staff",
                "POST",
                "/api/requests/run-matching",
                token_override=staff_token,
                expect_status=403,
            )

        run(
            "§3.2 expire_old_blood_units",
            "Expire old units (admin)",
            "POST",
            "/api/dashboard/expire-units",
        )

    if args.oracle:
        results.extend(run_oracle_checks())

    return _print_report(results)


def _print_report(results: list[Case]) -> int:
    passed = sum(1 for r in results if r.ok)
    failed = [r for r in results if not r.ok]
    print("\n" + "=" * 72)
    print("DEFENSE E2E TEST REPORT")
    print("=" * 72)
    for r in results:
        mark = "PASS" if r.ok else "FAIL"
        print(f"[{mark}] {r.defense_ref:12} | {r.name}")
        print(f"         {r.method} {r.path}  HTTP {r.status or '-'}")
        if r.detail:
            print(f"         -> {r.detail}")
        if r.extra.get("sample") is not None and r.ok:
            print(f"         sample: {r.extra['sample']}")
    print("-" * 72)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {len(failed)}")
    if failed:
        print("\nFailed cases:")
        for r in failed:
            print(f"  - {r.name}: {r.detail or r.status}")
        print("\nCommon fixes:")
        print("  - Start backend: cd backend && poetry run python -m uvicorn app.main:app --reload --port 8000")
        print("  - Start Oracle:  docker start blood-oracle-free")
        print("  - ORA-00942 vw_compat_pairs_readable: run backend/sql/create_view_compat_table.sql")
        print("  - Empty audit: run alembic upgrade head (007 backfill)")
        print(
            "  - ConnectionResetError / WinError 10054: stop uvicorn --reload during tests; "
            "use: poetry run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
        )
    print("=" * 72)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
