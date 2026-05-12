from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db
from app.auth_deps import get_current_user

router = APIRouter(prefix="/api/provenance", tags=["provenance"])

@router.get("/{unit_id}")
def get_unit_provenance(
    unit_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = text("SELECT * FROM vw_unit_lineage WHERE unit_id = :uid")
    result = db.execute(query, {"uid": unit_id}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Blood unit not found")
        
    return dict(result._mapping)