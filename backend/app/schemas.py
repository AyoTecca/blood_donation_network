from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    user_id: int
    email: str
    role: str

    model_config = {"from_attributes": True}


class NetworkStatsOut(BaseModel):
    donor_count: int
    patient_count: int
    lives_saved_count: int


class AdminRequestOverviewItem(BaseModel):
    request_id: int
    request_date: datetime | date
    urgency_level: int
    units_required: int
    request_status: str
    patient_id: int
    patient_name: str
    facility_id: int
    facility_name: str


class PagedAdminRequestOverview(BaseModel):
    items: list[AdminRequestOverviewItem]
    total: int
    page: int
    page_size: int


class OpenRequestItem(BaseModel):
    request_id: int
    facility_id: int
    facility_name: str
    patient_name: str
    blood_type: str
    urgency_level: int
    units_required: int
    status: str
    request_date: datetime | date


class PagedOpenRequests(BaseModel):
    items: list[OpenRequestItem]
    total: int
    page: int
    page_size: int


class OpenRequestFilterOptions(BaseModel):
    statuses: list[str]
    facilities: list[str]
    blood_types: list[str]


class AdminRequestFilterOptions(BaseModel):
    statuses: list[str]
    cities: list[str]
    blood_types: list[str]
