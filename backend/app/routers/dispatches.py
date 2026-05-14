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

@router.get("/map-points")
def get_map_points(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Returns all facilities with coordinates + activity stats for the map."""
    try:
        query = text("""
            SELECT
                f.facility_id,
                f.facility_name,
                f.facility_type,
                gl.city_name,
                gl.latitude,
                gl.longitude,
                (SELECT COUNT(*) FROM transfusion_requests tr
                 JOIN patients p ON p.patient_id = tr.patient_id
                 WHERE p.current_facility_id = f.facility_id
                   AND tr.status IN ('Pending', 'Partially Fulfilled')) AS active_requests,
                (SELECT COUNT(*) FROM match_dispatches md
                 JOIN transfusion_requests tr ON tr.request_id = md.request_id
                 JOIN patients p ON p.patient_id = tr.patient_id
                 WHERE p.current_facility_id = f.facility_id
                   AND md.status IN ('In Transit', 'Queued')) AS active_dispatches
            FROM facilities f
            JOIN geographic_locations gl ON gl.location_id = f.location_id
            ORDER BY f.facility_name
        """)
        result = db.execute(query).mappings().all()
        return [{k.lower(): v for k, v in dict(row).items()} for row in result]
    except Exception as e:
        logger.error(f"Error fetching map points: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not fetch map data")


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