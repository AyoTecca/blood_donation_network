from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Any
import logging

from app.deps import get_db
from app.auth_deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compatibility", tags=["compatibility"])


@router.get("/blood-types")
def list_blood_types(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Returns one row per unique blood type (deduplicates blood_types table)."""
    query = text("""
        SELECT MIN(blood_type_id) AS id,
               type_group || rh_factor AS type
        FROM blood_types
        GROUP BY type_group, rh_factor
        ORDER BY
            DECODE(type_group, 'O', 1, 'A', 2, 'B', 3, 'AB', 4),
            DECODE(rh_factor,  '-', 0, 1)
    """)
    result = db.execute(query).mappings().all()
    return [dict(row) for row in result]


@router.get("/matrix")
def get_compatibility_matrix(db: Session = Depends(get_db)):
    query = text("SELECT * FROM vw_compat_pairs_readable")
    result = db.execute(query)
    return [dict(row._mapping) for row in result]


@router.get("/for-recipient/{recipient_id}")
def get_compatible_donors(recipient_id: int, db: Session = Depends(get_db)):
    query = text("""
        SELECT donor_blood_type_id, donor_blood_type
        FROM vw_compat_pairs_readable
        WHERE recipient_blood_type_id = :rec_id
    """)
    result = db.execute(query, {"rec_id": recipient_id})
    return [dict(row._mapping) for row in result]


@router.get("/check")
def check_pair(
    donor_type_id: int,
    recipient_type_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    # Standard ABO/Rh compatibility rules (donor → set of valid recipient types)
    COMPAT: dict[str, set[str]] = {
        "O-":  {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"},
        "O+":  {"O+", "A+", "B+", "AB+"},
        "A-":  {"A-", "A+", "AB-", "AB+"},
        "A+":  {"A+", "AB+"},
        "B-":  {"B-", "B+", "AB-", "AB+"},
        "B+":  {"B+", "AB+"},
        "AB-": {"AB-", "AB+"},
        "AB+": {"AB+"},
    }
    row = db.execute(text("""
        SELECT d.type_group || d.rh_factor AS donor_type,
               r.type_group || r.rh_factor AS recipient_type
        FROM blood_types d, blood_types r
        WHERE d.blood_type_id = :did
          AND r.blood_type_id = :rid
    """), {"did": donor_type_id, "rid": recipient_type_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Blood type ID not found")

    return {"compatible": row.recipient_type in COMPAT.get(row.donor_type, set())}


@router.get("/request-history/{request_id}")
def get_request_history(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    try:
        query = text("""
            SELECT
                history_id,
                request_id,
                operation_type,
                old_status,
                new_status,
                old_units_required,
                new_units_required,
                TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS changed_at,
                changed_by,
                change_note
            FROM transfusion_request_history
            WHERE request_id = :rid
            ORDER BY changed_at DESC, history_id DESC
        """)
        result = db.execute(query, {"rid": request_id}).mappings().all()
        return [dict(row) for row in result]
    except Exception as e:
        logger.error(f"Error fetching request history: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch request history")