from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import get_current_user
from app.deps import get_db
from app.models_auth import AppUser

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _row_dict(row: Any) -> dict[str, Any]:
    return {str(k).lower(): v for k, v in dict(row._mapping).items()}


@router.get("/requests")
def get_audit_logs(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        query = text(
            """
            SELECT history_id, request_id, operation_type, old_status, new_status,
                   change_time, user_id, change_note
            FROM vw_audit_log
            ORDER BY change_time DESC, history_id DESC
            """
        )
        result = db.execute(query)
        return [_row_dict(row) for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e