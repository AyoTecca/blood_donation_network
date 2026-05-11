import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

from app.deps import get_db
from app.auth_deps import get_current_user, require_admin

router = APIRouter(
    prefix="/api/requests",
    tags=["Requests Operations"]
)

@router.get("/", response_model=List[Dict[str, Any]])
def get_requests_list(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user) 
):
    """
    Retrieves a list of blood transfusion requests.
    Joins with the patients table to get facility and blood type info.
    """
    user_email = getattr(current_user, 'email', 'unknown')
    logger.info(f"User {user_email} requested the transfusion requests list.")
    
    try:
        query = text("""
            SELECT 
                tr.request_id, 
                p.current_facility_id AS requesting_facility_id, 
                tr.patient_id, 
                p.blood_type_id, 
                tr.units_required AS units_requested, 
                tr.status, 
                CASE 
                    WHEN tr.urgency_level = 1 THEN 'Critical' 
                    ELSE 'Routine' 
                END AS urgency_level, 
                tr.request_date
            FROM transfusion_requests tr
            JOIN patients p ON tr.patient_id = p.patient_id
            ORDER BY tr.request_date DESC
        """)
        
        result = db.execute(query).mappings().all()
        logger.info(f"Successfully retrieved {len(result)} requests from the database.")
        
        return [{k.lower(): v for k, v in dict(row).items()} for row in result]
        
    except Exception as e:
        logger.error(f"Failed to fetch requests list: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching requests data.")

@router.post("/run-matching")
def run_blood_matching(
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_admin)
):
    """
    Triggers the PL/SQL procedure pkg_blood_operations.process_blood_matches
    to automatically allocate available blood units to pending requests.
    Requires Admin privileges.
    """
    user_email = getattr(current_user, 'email', 'unknown')
    logger.info(f"Admin {user_email} initiated the blood matching process.")
    
    try:
        db.execute(text("BEGIN pkg_blood_operations.process_blood_matches; END;"))
        db.commit()
        
        logger.info("Blood matching PL/SQL procedure executed successfully.")
        return {
            "status": "success", 
            "message": "Blood matching algorithm executed successfully in the database."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Oracle PL/SQL execution failed during blood matching: {str(e)}")
        raise HTTPException(status_code=500, detail="Oracle PL/SQL execution failed. Please check backend logs.")