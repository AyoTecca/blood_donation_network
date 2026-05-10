from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import require_admin
from app.deps import get_db
from app.models_auth import AppUser
from app.schemas import AdminRequestFilterOptions, AdminRequestOverviewItem, PagedAdminRequestOverview

router = APIRouter(prefix="/api/admin", tags=["admin"])

_ALLOWED_PAGE_SIZES = (10, 25, 50, 100)

_ADMIN_REQUEST_FROM = """
FROM transfusion_requests r
JOIN patients p ON p.patient_id = r.patient_id
JOIN facilities f ON f.facility_id = p.current_facility_id
JOIN geographic_locations gl ON gl.location_id = f.location_id
JOIN blood_types bt ON bt.blood_type_id = p.blood_type_id
"""


def _lower_keys(row: dict[str, Any]) -> dict[str, Any]:
    return {str(k).lower(): v for k, v in row.items()}


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


def _admin_filter_sql(
    request_status: str | None,
    city_name: str | None,
    blood_type: str | None,
    urgency_min: int | None,
    urgency_max: int | None,
    date_from: date | None,
    date_to: date | None,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if request_status and request_status.strip():
        clauses.append("UPPER(TRIM(r.status)) = UPPER(TRIM(:st))")
        params["st"] = request_status.strip()
    if city_name and city_name.strip():
        clauses.append("UPPER(TRIM(gl.city_name)) = UPPER(TRIM(:city))")
        params["city"] = city_name.strip()
    if blood_type and blood_type.strip():
        clauses.append("UPPER(TRIM(bt.type_group || bt.rh_factor)) = UPPER(TRIM(:btype))")
        params["btype"] = blood_type.strip()
    if urgency_min is not None:
        clauses.append("r.urgency_level >= :umin")
        params["umin"] = urgency_min
    if urgency_max is not None:
        clauses.append("r.urgency_level <= :umax")
        params["umax"] = urgency_max
    if date_from is not None:
        clauses.append("TRUNC(r.request_date) >= TRUNC(:df)")
        params["df"] = date_from
    if date_to is not None:
        clauses.append("TRUNC(r.request_date) <= TRUNC(:dt)")
        params["dt"] = date_to
    where_sql = " AND ".join(clauses) if clauses else "1=1"
    return where_sql, params


@router.get("/request-overview/filter-options", response_model=AdminRequestFilterOptions)
def admin_request_filter_options(
    _: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminRequestFilterOptions:
    statuses = _distinct_strings(
        db,
        """
        SELECT DISTINCT r.status AS v
        FROM transfusion_requests r
        WHERE r.status IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    cities = _distinct_strings(
        db,
        f"""
        SELECT DISTINCT gl.city_name AS v
        {_ADMIN_REQUEST_FROM}
        WHERE gl.city_name IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    blood_types = _distinct_strings(
        db,
        f"""
        SELECT DISTINCT TRIM(bt.type_group || bt.rh_factor) AS v
        {_ADMIN_REQUEST_FROM}
        WHERE bt.type_group IS NOT NULL
        ORDER BY 1
        """,
        "v",
    )
    return AdminRequestFilterOptions(statuses=statuses, cities=cities, blood_types=blood_types)


@router.get("/request-overview", response_model=PagedAdminRequestOverview)
def request_overview(
    _: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, description="One of 10, 25, 50, 100"),
    request_status: str | None = None,
    city_name: str | None = None,
    blood_type: str | None = None,
    urgency_min: int | None = Query(None, ge=1, le=5),
    urgency_max: int | None = Query(None, ge=1, le=5),
    date_from: date | None = None,
    date_to: date | None = None,
) -> PagedAdminRequestOverview:
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
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from cannot be after date_to",
        )

    where_sql, fparams = _admin_filter_sql(
        request_status,
        city_name,
        blood_type,
        urgency_min,
        urgency_max,
        date_from,
        date_to,
    )

    count_q = text(f"SELECT COUNT(*) AS cnt {_ADMIN_REQUEST_FROM} WHERE {where_sql}")
    total = int(db.execute(count_q, fparams).scalar_one())

    offset = (page - 1) * page_size
    data_params = {**fparams, "off": offset, "lim": page_size}
    data_q = text(
        f"""
        SELECT r.request_id, r.request_date, r.urgency_level, r.units_required, r.status AS request_status,
               p.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
               f.facility_id, f.facility_name
        {_ADMIN_REQUEST_FROM}
        WHERE {where_sql}
        ORDER BY r.request_date DESC
        OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY
        """
    )
    rows = db.execute(data_q, data_params).mappings().all()
    items = [AdminRequestOverviewItem.model_validate(_lower_keys(dict(r))) for r in rows]
    return PagedAdminRequestOverview(items=items, total=total, page=page, page_size=page_size)
