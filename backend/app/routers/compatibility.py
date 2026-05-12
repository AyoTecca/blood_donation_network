from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db
from app.auth_deps import get_current_user  

router = APIRouter(prefix="/api/compatibility", tags=["compatibility"])

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


@router.get("/compatibility/check") # Убедись, что путь правильный с учетом префикса роутера
def check_pair(
    donor_id: int, 
    recipient_id: int, 
    db: Session = Depends(get_db)
):
    # Вызываем PL/SQL пакет
    query = text("SELECT blood_network_pkg.check_compatibility(:d, :r) FROM DUAL")
    result = db.execute(query, {"d": donor_id, "r": recipient_id}).scalar()
    
    return {"compatible": result == 'Y'}