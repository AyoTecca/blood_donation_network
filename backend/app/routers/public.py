"""Unauthenticated endpoints (e.g. auth landing stats)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas import NetworkStatsOut

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/network-stats", response_model=NetworkStatsOut)
def network_stats(db: Session = Depends(get_db)) -> NetworkStatsOut:
    """Row counts from seeded Oracle tables for the auth landing."""
    q = text(
        """
        SELECT
            (SELECT COUNT(*) FROM donors) AS donor_count,
            (SELECT COUNT(*) FROM patients) AS patient_count,
            (SELECT COUNT(*) FROM match_dispatches WHERE LOWER(TRIM(status)) = 'arrived')
                AS lives_saved_count
        FROM dual
        """
    )
    row = db.execute(q).mappings().one()
    return NetworkStatsOut(
        donor_count=int(row["donor_count"]),
        patient_count=int(row["patient_count"]),
        lives_saved_count=int(row["lives_saved_count"]),
    )
