import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from app.deps import get_db
from app.auth_deps import get_current_user, require_admin

class RequestCreate(BaseModel):
    patient_id: int = Field(..., gt=0, description="Patient ID must be greater than 0")
    units_requested: int = Field(..., gt=0, description="Must request at least 1 unit")
    urgency_level: int

router = APIRouter(
    prefix="/api/requests",
    tags=["Requests Operations"]
)

@router.get("/", response_model=List[Dict[str, Any]])
def get_requests_list(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user) 
):
    user_email = getattr(current_user, 'email', 'unknown')
    
    try:
        query = text("""
            SELECT
                tr.request_id,
                tr.patient_id,
                p.first_name || ' ' || p.last_name AS patient_name,
                bt.type_group || bt.rh_factor AS blood_type,
                f.facility_name,
                p.current_facility_id AS requesting_facility_id,
                tr.units_required AS units_requested,
                tr.status,
                CASE
                    WHEN tr.urgency_level = 1 THEN '1 - Critical'
                    WHEN tr.urgency_level = 2 THEN '2 - Urgent'
                    WHEN tr.urgency_level = 3 THEN '3 - Moderate'
                    WHEN tr.urgency_level = 4 THEN '4 - Routine'
                    WHEN tr.urgency_level = 5 THEN '5 - Low'
                    ELSE TO_CHAR(tr.urgency_level)
                END AS urgency_level,
                tr.request_date
            FROM transfusion_requests tr
            JOIN patients p ON tr.patient_id = p.patient_id
            JOIN blood_types bt ON p.blood_type_id = bt.blood_type_id
            JOIN facilities f ON p.current_facility_id = f.facility_id
            ORDER BY tr.request_date DESC
        """)
        
        result = db.execute(query).mappings().all()
        return [{k.lower(): v for k, v in dict(row).items()} for row in result]
        
    except Exception as e:
        logger.error(f"Failed to fetch requests list: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching requests data.")



@router.post("/")
def create_request(
    req: RequestCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    try:
        
        query = text("""
            INSERT INTO transfusion_requests 
            (request_id, patient_id, units_required, urgency_level, status, request_date)
            VALUES (
                (SELECT COALESCE(MAX(request_id), 0) + 1 FROM transfusion_requests),
                :pid, :units, :urgency, 'Pending', TRUNC(SYSDATE)
            )
        """)
        
        db.execute(query, {
            "pid": req.patient_id,
            "units": req.units_requested,
            "urgency": req.urgency_level
        })
        db.commit()
        
        return {"status": "success", "message": "Request created successfully."}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/patients", response_model=List[Dict[str, Any]])
def list_patients(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    try:
        query = text("""
            SELECT
                p.patient_id,
                p.first_name || ' ' || p.last_name AS full_name,
                bt.type_group || bt.rh_factor AS blood_type,
                f.facility_name
            FROM patients p
            JOIN blood_types bt ON p.blood_type_id = bt.blood_type_id
            JOIN facilities f ON p.current_facility_id = f.facility_id
            ORDER BY p.last_name, p.first_name
        """)
        result = db.execute(query).mappings().all()
        return [{k.lower(): v for k, v in dict(row).items()} for row in result]
    except Exception as e:
        logger.error(f"Failed to fetch patients: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching patients list.")


def _matching_snapshot(db: Session) -> dict[str, int]:
    row = db.execute(
        text(
            """
            SELECT
                (SELECT COUNT(*) FROM transfusion_requests
                  WHERE status IN ('Pending', 'Partially Fulfilled')) AS open_requests,
                (SELECT COUNT(*) FROM blood_units
                  WHERE status = 'Available' AND expiry_date > TRUNC(SYSDATE)) AS available_units,
                (SELECT COUNT(*) FROM blood_units
                  WHERE status = 'Reserved' AND expiry_date > TRUNC(SYSDATE)) AS reserved_units
            FROM DUAL
            """
        )
    ).mappings().one()
    return {k: int(row[k]) for k in row.keys()}


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
        before = _matching_snapshot(db)
        db.execute(text("BEGIN pkg_blood_operations.process_blood_matches; END;"))
        db.commit()
        after = _matching_snapshot(db)

        open_delta = after["open_requests"] - before["open_requests"]
        avail_delta = after["available_units"] - before["available_units"]
        reserved_delta = after["reserved_units"] - before["reserved_units"]

        if before["open_requests"] == 0:
            hint = (
                " No open requests (Pending / Partially Fulfilled). "
                "On Dashboard, click Prepare Demo for Matching, then run again."
            )
        elif avail_delta == 0 and reserved_delta == 0:
            hint = (
                " Matching ran but inventory did not change — likely no compatible "
                "Available units for open requests."
            )
        else:
            hint = ""

        logger.info("Blood matching PL/SQL procedure executed successfully.")
        return {
            "status": "success",
            "open_requests_before": before["open_requests"],
            "open_requests_after": after["open_requests"],
            "available_before": before["available_units"],
            "available_after": after["available_units"],
            "reserved_before": before["reserved_units"],
            "reserved_after": after["reserved_units"],
            "message": (
                f"Matching finished. Open requests: {before['open_requests']} → {after['open_requests']} "
                f"({open_delta:+d}). Available units: {before['available_units']} → {after['available_units']} "
                f"({avail_delta:+d}). Reserved: {before['reserved_units']} → {after['reserved_units']} "
                f"({reserved_delta:+d}).{hint}"
            ),
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Oracle PL/SQL execution failed during blood matching: {str(e)}")
        raise HTTPException(status_code=500, detail="Oracle PL/SQL execution failed. Please check backend logs.")
    
class DonationCreate(BaseModel):
    donor_id: int
    facility_id: int

@router.post("/events")
def create_donation_event(
    donation: DonationCreate, 
    db: Session = Depends(get_db)
):
    try:
        
        query = text("""
            INSERT INTO donation_events (donor_id, facility_id, donation_date)
            VALUES (:did, :fid, SYSDATE)
        """)
        db.execute(query, {"did": donation.donor_id, "fid": donation.facility_id})
        db.commit()
        
        return {"status": "success", "message": "Donation event recorded successfully!"}

    except Exception as e:
        db.rollback()
        error_msg = str(e)
        
        
        if "ORA-20003" in error_msg:
            
            raise HTTPException(status_code=400, detail="Donor is not eligible yet. Minimum wait time is 56 days.")
            
        elif "ORA-20004" in error_msg:
            raise HTTPException(status_code=404, detail=f"Donor ID {donation.donor_id} not found in the system.")
            
        else:
            
            print(f"Database error: {error_msg}")
            raise HTTPException(status_code=500, detail="Internal server error while processing donation.")