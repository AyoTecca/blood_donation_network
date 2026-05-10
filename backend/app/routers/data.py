from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import get_current_user
from app.deps import get_db
from app.models_auth import AppUser
from app.schemas import OpenRequestFilterOptions, OpenRequestItem, PagedOpenRequests

router = APIRouter(prefix="/api", tags=["data"])

_ALLOWED_PAGE_SIZES = (10, 25, 50, 100)


def _distinct_strings(db: Session, sql: str, key: str) -> list[str]:
    rows = db.execute(text(sql)).mappings().all()
    out: list[str] = []
    for r in rows:
        v = r.get(key)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            out.append(s)
    return out


def _lower_keys(row: dict[str, Any]) -> dict[str, Any]:
    return {str(k).lower(): v for k, v in row.items()}


def _open_requests_filter_sql(
    status: str | None,
    facility_name: str | None,
    blood_type: str | None,
    urgency_min: int | None,
    urgency_max: int | None,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if status and status.strip():
        clauses.append("UPPER(TRIM(status)) = UPPER(TRIM(:st))")
        params["st"] = status.strip()
    if facility_name and facility_name.strip():
        clauses.append("UPPER(TRIM(facility_name)) = UPPER(TRIM(:fac))")
        params["fac"] = facility_name.strip()
    if blood_type and blood_type.strip():
        clauses.append("UPPER(TRIM(blood_type)) = UPPER(TRIM(:bt))")
        params["bt"] = blood_type.strip()
    if urgency_min is not None:
        clauses.append("urgency_level >= :umin")
        params["umin"] = urgency_min
    if urgency_max is not None:
        clauses.append("urgency_level <= :umax")
        params["umax"] = urgency_max
    where_sql = " AND ".join(clauses) if clauses else "1=1"
    return where_sql, params


@router.get("/open-requests/filter-options", response_model=OpenRequestFilterOptions)
def open_request_filter_options(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OpenRequestFilterOptions:
    statuses = _distinct_strings(
        db,
        """
        SELECT DISTINCT status AS v
        FROM vw_open_requests_by_facility
        WHERE status IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    facilities = _distinct_strings(
        db,
        """
        SELECT DISTINCT facility_name AS v
        FROM vw_open_requests_by_facility
        WHERE facility_name IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    blood_types = _distinct_strings(
        db,
        """
        SELECT DISTINCT blood_type AS v
        FROM vw_open_requests_by_facility
        WHERE blood_type IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    return OpenRequestFilterOptions(statuses=statuses, facilities=facilities, blood_types=blood_types)


@router.get("/open-requests", response_model=PagedOpenRequests)
def open_requests(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, description="One of 10, 25, 50, 100"),
    status: str | None = None,
    facility_name: str | None = None,
    blood_type: str | None = None,
    urgency_min: int | None = Query(None, ge=1, le=5),
    urgency_max: int | None = Query(None, ge=1, le=5),
) -> PagedOpenRequests:
    if page_size not in _ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"page_size must be one of {list(_ALLOWED_PAGE_SIZES)}",
        )
    if urgency_min is not None and urgency_max is not None and urgency_min > urgency_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="urgency_min cannot be greater than urgency_max",
        )

    where_sql, fparams = _open_requests_filter_sql(
        status,
        facility_name,
        blood_type,
        urgency_min,
        urgency_max,
    )

    count_q = text(f"SELECT COUNT(*) AS cnt FROM vw_open_requests_by_facility WHERE {where_sql}")
    total = int(db.execute(count_q, fparams).scalar_one())

    offset = (page - 1) * page_size
    data_params = {**fparams, "off": offset, "lim": page_size}
    data_q = text(
        f"""
        SELECT request_id, facility_id, facility_name, patient_name, blood_type,
               urgency_level, units_required, status, request_date
        FROM vw_open_requests_by_facility
        WHERE {where_sql}
        ORDER BY request_date DESC
        OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY
        """
    )
    rows = db.execute(data_q, data_params).mappings().all()
    items = [OpenRequestItem.model_validate(_lower_keys(dict(r))) for r in rows]
    return PagedOpenRequests(items=items, total=total, page=page, page_size=page_size)


@router.get("/compatibility/check")
def compatibility_check(
    donor_type_id: int,
    recipient_type_id: int,
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    q = text(
        """
        SELECT blood_network_pkg.check_compatibility(:d, :r) FROM DUAL
        """
    )
    result = db.execute(q, {"d": donor_type_id, "r": recipient_type_id}).scalar_one()
    return {"compatible_flag": str(result)}
