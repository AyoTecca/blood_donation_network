from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db
from app.auth_deps import get_current_user

router = APIRouter(prefix="/api/provenance", tags=["provenance"])


@router.get("/units")
def list_provenance_units(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """All blood units with donor name — used to populate the provenance picker."""
    query = text("""
        SELECT unit_id, blood_type, unit_status, donor_name
        FROM vw_unit_lineage
        ORDER BY donor_name, unit_id
    """)
    result = db.execute(query).mappings().all()
    return [dict(row) for row in result]


@router.get("/{unit_id}")
def get_unit_provenance(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = text("SELECT * FROM vw_unit_lineage WHERE unit_id = :uid")
    result = db.execute(query, {"uid": unit_id}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Blood unit not found")

    return dict(result._mapping)