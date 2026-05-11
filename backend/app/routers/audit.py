from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/requests")
def get_audit_logs(db: Session = Depends(get_db)):
    try:
        query = text("SELECT * FROM vw_audit_log")
        result = db.execute(query)
        return [dict(row._mapping) for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))