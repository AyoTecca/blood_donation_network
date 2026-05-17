from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import get_current_user, require_admin
from app.deps import get_db
from app.models_auth import AppUser

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _lower(row: dict) -> dict:
    return {str(k).lower(): v for k, v in row.items()}


# ── Existing views ──────────────────────────────────────────────────────────

@router.get("/inventory-by-status")
def inventory_by_status(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "SELECT status, unit_count FROM vw_dashboard_inventory_by_status ORDER BY status"
    )).mappings().all()
    return [dict(r) for r in rows]


@router.get("/requests-by-status")
def requests_by_status(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "SELECT status, request_count FROM vw_dashboard_requests_by_status ORDER BY status"
    )).mappings().all()
    return [dict(r) for r in rows]


@router.get("/dispatch-performance")
def dispatch_performance(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "SELECT status, dispatch_count, avg_distance_km FROM vw_dashboard_dispatch_performance ORDER BY status"
    )).mappings().all()
    return [dict(r) for r in rows]


# ── NEW: KPI summary ────────────────────────────────────────────────────────

@router.get("/kpi")
def kpi_summary(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    row = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM blood_units WHERE status = 'Available')          AS available_units,
            (SELECT COUNT(*) FROM blood_units WHERE status = 'Reserved')           AS reserved_units,
            (SELECT COUNT(*) FROM blood_units WHERE status = 'Expired')            AS expired_units,
            (SELECT COUNT(*) FROM transfusion_requests WHERE status = 'Pending')   AS pending_requests,
            (SELECT COUNT(*) FROM transfusion_requests WHERE status = 'Partially Fulfilled') AS partial_requests,
            (SELECT COUNT(*) FROM transfusion_requests WHERE status = 'Completed') AS completed_requests,
            (SELECT COUNT(*) FROM match_dispatches WHERE status = 'In Transit')    AS in_transit,
            (SELECT COUNT(*) FROM patients)                                        AS total_patients,
            (SELECT COUNT(*) FROM donors)                                          AS total_donors
        FROM DUAL
    """)).mappings().one()
    return _lower(dict(row))


# ── NEW: Notifications feed ─────────────────────────────────────────────────

@router.get("/notifications")
def recent_notifications(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> list[dict[str, Any]]:
    try:
        rows = db.execute(text("""
            SELECT notification_id, request_id, facility_name,
                   event_type, message_text, is_read, created_at
            FROM vw_notifications_feed
            ORDER BY created_at DESC
            FETCH FIRST :lim ROWS ONLY
        """), {"lim": limit}).mappings().all()
        return [_lower(dict(r)) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── NEW: Open requests by facility ──────────────────────────────────────────

@router.get("/open-by-facility")
def open_requests_by_facility(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    try:
        rows = db.execute(text("""
            SELECT request_id, facility_name, patient_name,
                   blood_type, urgency_level, units_required, status, request_date
            FROM vw_open_requests_by_facility
            ORDER BY urgency_level ASC, request_date DESC
            FETCH FIRST 50 ROWS ONLY
        """)).mappings().all()
        return [_lower(dict(r)) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── NEW: Facilities list (for distance calculator dropdown) ─────────────────

@router.get("/facilities")
def list_facilities(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = db.execute(text("""
        SELECT f.facility_id, f.facility_name, f.facility_type,
               gl.city_name, f.location_id
        FROM facilities f
        JOIN geographic_locations gl ON gl.location_id = f.location_id
        ORDER BY f.facility_name
    """)).mappings().all()
    return [_lower(dict(r)) for r in rows]


# ── NEW: Distance calculator (PL/SQL function) ──────────────────────────────

@router.get("/distance")
def calculate_distance(
    fac1: int = Query(..., description="First facility ID"),
    fac2: int = Query(..., description="Second facility ID"),
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if fac1 == fac2:
        return {"distance_km": 0.0, "note": "Same facility"}
    try:
        result = db.execute(text("""
            SELECT
                pkg_blood_operations.calculate_distance_km(
                    (SELECT location_id FROM facilities WHERE facility_id = :f1),
                    (SELECT location_id FROM facilities WHERE facility_id = :f2)
                ) AS distance_km,
                f1.facility_name AS facility_1,
                f2.facility_name AS facility_2
            FROM facilities f1, facilities f2
            WHERE f1.facility_id = :f1 AND f2.facility_id = :f2
        """), {"f1": fac1, "f2": fac2}).mappings().one()
        return _lower(dict(result))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── NEW: Expire old blood units (PL/SQL procedure, admin only) ───────────────

@router.post("/expire-units")
def expire_old_units(
    _: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        expired_before = db.execute(text(
            "SELECT COUNT(*) AS cnt FROM blood_units WHERE status = 'Expired'"
        )).scalar_one()

        db.execute(text("BEGIN pkg_blood_management.expire_old_blood_units; END;"))
        db.commit()

        expired_after = db.execute(text(
            "SELECT COUNT(*) AS cnt FROM blood_units WHERE status = 'Expired'"
        )).scalar_one()

        newly_expired = int(expired_after) - int(expired_before)
        return {
            "status": "success",
            "newly_expired": newly_expired,
            "message": f"Procedure executed. {newly_expired} unit(s) marked as Expired."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ── Demo: restore Available inventory (admin only, before live matching demo) ─

@router.post("/demo-restore-inventory")
def demo_restore_inventory(
    _: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
    unit_cap: int = Query(300, ge=50, le=500, description="Max Reserved units to release"),
) -> dict[str, Any]:
    """
    Moves non-expired Reserved blood units back to Available so
    pkg_blood_operations.process_blood_matches can run again for presentations.
    """
    try:
        available_before = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM blood_units
                    WHERE status = 'Available' AND expiry_date > TRUNC(SYSDATE)
                    """
                )
            ).scalar_one()
        )

        result = db.execute(
            text(
                """
                UPDATE blood_units
                   SET status = 'Available'
                 WHERE unit_id IN (
                       SELECT unit_id FROM (
                             SELECT bu.unit_id
                               FROM blood_units bu
                              WHERE bu.status = 'Reserved'
                                AND bu.expiry_date > TRUNC(SYSDATE)
                              ORDER BY bu.unit_id
                              FETCH FIRST :cap ROWS ONLY
                       )
                 )
                """
            ),
            {"cap": unit_cap},
        )
        restored = int(result.rowcount)

        available_after = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM blood_units
                    WHERE status = 'Available' AND expiry_date > TRUNC(SYSDATE)
                    """
                )
            ).scalar_one()
        )
        db.commit()

        return {
            "status": "success",
            "units_restored": restored,
            "available_before": available_before,
            "available_after": available_after,
            "message": (
                f"Demo inventory restored. {restored} unit(s) moved Reserved → Available. "
                f"Available now: {available_after}. "
                "Go to Requests → Run Auto-Matching Algorithm."
            ),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) from e
