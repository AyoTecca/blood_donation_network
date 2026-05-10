from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import logging

from app.deps import get_db
from app.auth_deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"]
)

@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    try:
        inventory_query = text("SELECT * FROM vw_dashboard_inventory_by_status")
        inventory_data = db.execute(inventory_query).mappings().all()
        
        requests_query = text("SELECT * FROM vw_dashboard_requests_by_status")
        requests_data = db.execute(requests_query).mappings().all()

        return {
            "inventory": [{k.lower(): v for k, v in dict(row).items()} for row in inventory_data],
            "requests": [{k.lower(): v for k, v in dict(row).items()} for row in requests_data]
        }
    except Exception as e:
        logger.error(f"Analytics error: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not fetch analytics data")