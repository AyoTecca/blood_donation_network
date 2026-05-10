from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import get_current_user
from app.deps import get_db
from app.models_auth import AppUser

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/inventory-by-status")
def inventory_by_status(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = text(
        """
        SELECT status, unit_count
        FROM vw_dashboard_inventory_by_status
        ORDER BY status
        """
    )
    rows = db.execute(q).mappings().all()
    return [dict(r) for r in rows]


@router.get("/requests-by-status")
def requests_by_status(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = text(
        """
        SELECT status, request_count
        FROM vw_dashboard_requests_by_status
        ORDER BY status
        """
    )
    rows = db.execute(q).mappings().all()
    return [dict(r) for r in rows]


@router.get("/dispatch-performance")
def dispatch_performance(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = text(
        """
        SELECT status, dispatch_count, avg_distance_km
        FROM vw_dashboard_dispatch_performance
        ORDER BY status
        """
    )
    rows = db.execute(q).mappings().all()
    return [dict(r) for r in rows]
