from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
import logging

from app.deps import get_db
from app.auth_deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/dispatches",
    tags=["Dispatches"]
)

@router.get("/")
def get_dispatches(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    try:
        
        query = text("SELECT * FROM vw_dispatch_detail ORDER BY dispatch_id DESC")
        result = db.execute(query).mappings().all()
        
        
        return [{k.lower(): v for k, v in dict(row).items()} for row in result]
    except Exception as e:
        logger.error(f"Error fetching dispatches: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not fetch dispatch data")