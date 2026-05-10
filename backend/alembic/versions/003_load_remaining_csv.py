"""Load geographic, facilities, donors, patients, events, units, requests, transfers, dispatches."""

from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "003_load_csv_data"
down_revision: Union[str, Sequence[str], None] = "002_blood_types_compat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _parse_date(s: str):
    return datetime.strptime(s.strip(), "%Y-%m-%d").date()


def upgrade() -> None:
    conn = op.get_bind()

    geo_rows: list[dict] = []
    with (_repo_root() / "data" / "GEOGRAPHIC_LOCATIONS_KZ.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            geo_rows.append(
                {
                    "location_id": int(r["location_id"]),
                    "city_name": r["city_name"].strip(),
                    "latitude": float(r["latitude"]),
                    "longitude": float(r["longitude"]),
                }
            )
    if geo_rows:
        conn.execute(
            text(
                "INSERT INTO geographic_locations (location_id, city_name, latitude, longitude) "
                "VALUES (:location_id, :city_name, :latitude, :longitude)"
            ),
            geo_rows,
        )

    fac_rows: list[dict] = []
    with (_repo_root() / "data" / "FACILITIES_KZ.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            fac_rows.append(
                {
                    "facility_id": int(r["facility_id"]),
                    "facility_name": r["facility_name"].strip(),
                    "facility_type": r["facility_type"].strip(),
                    "location_id": int(r["location_id"]),
                }
            )
    if fac_rows:
        conn.execute(
            text(
                "INSERT INTO facilities (facility_id, facility_name, facility_type, location_id) "
                "VALUES (:facility_id, :facility_name, :facility_type, :location_id)"
            ),
            fac_rows,
        )

    donor_rows: list[dict] = []
    with (_repo_root() / "data" / "DONORS_KZ.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            donor_rows.append(
                {
                    "donor_id": int(r["donor_id"]),
                    "first_name": r["first_name"].strip(),
                    "last_name": r["last_name"].strip(),
                    "blood_type_id": int(r["blood_type_id"]),
                    "last_donation_date": _parse_date(r["last_donation_date"]),
                    "location_id": int(r["location_id"]),
                }
            )
    if donor_rows:
        conn.execute(
            text(
                "INSERT INTO donors (donor_id, first_name, last_name, blood_type_id, last_donation_date, location_id) "
                "VALUES (:donor_id, :first_name, :last_name, :blood_type_id, :last_donation_date, :location_id)"
            ),
            donor_rows,
        )

    patient_rows: list[dict] = []
    with (_repo_root() / "data" / "PATIENTS.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            patient_rows.append(
                {
                    "patient_id": int(r["patient_id"]),
                    "first_name": r["first_name"].strip(),
                    "last_name": r["last_name"].strip(),
                    "blood_type_id": int(r["blood_type_id"]),
                    "current_facility_id": int(r["current_facility_id"]),
                }
            )
    if patient_rows:
        conn.execute(
            text(
                "INSERT INTO patients (patient_id, first_name, last_name, blood_type_id, current_facility_id) "
                "VALUES (:patient_id, :first_name, :last_name, :blood_type_id, :current_facility_id)"
            ),
            patient_rows,
        )

    patient_ids = {r["patient_id"] for r in patient_rows}

    de_rows: list[dict] = []
    with (_repo_root() / "data" / "DONATION_EVENTS.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            de_rows.append(
                {
                    "donation_id": int(r["donation_id"]),
                    "donor_id": int(r["donor_id"]),
                    "facility_id": int(r["facility_id"]),
                    "donation_date": _parse_date(r["donation_date"]),
                    "medical_screening_status": r["medical_screening_status"].strip(),
                }
            )
    if de_rows:
        conn.execute(
            text(
                "INSERT INTO donation_events (donation_id, donor_id, facility_id, donation_date, medical_screening_status) "
                "VALUES (:donation_id, :donor_id, :facility_id, :donation_date, :medical_screening_status)"
            ),
            de_rows,
        )

    bu_rows: list[dict] = []
    with (_repo_root() / "data" / "BLOOD_UNITS.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            bu_rows.append(
                {
                    "unit_id": int(r["unit_id"]),
                    "donation_id": int(r["donation_id"]),
                    "component_type": r["component_type"].strip(),
                    "expiry_date": _parse_date(r["expiry_date"]),
                    "status": r["status"].strip(),
                    "current_facility_id": int(r["current_facility_id"]),
                }
            )
    if bu_rows:
        conn.execute(
            text(
                "INSERT INTO blood_units (unit_id, donation_id, component_type, expiry_date, status, current_facility_id) "
                "VALUES (:unit_id, :donation_id, :component_type, :expiry_date, :status, :current_facility_id)"
            ),
            bu_rows,
        )

    unit_ids = {r["unit_id"] for r in bu_rows}
    facility_ids = {r["facility_id"] for r in fac_rows}

    tr_rows: list[dict] = []
    with (_repo_root() / "data" / "TRANSFUSION_REQUESTS.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            tr_rows.append(
                {
                    "request_id": int(r["request_id"]),
                    "patient_id": int(r["patient_id"]),
                    "urgency_level": int(r["urgency_level"]),
                    "units_required": int(r["units_required"]),
                    "request_date": _parse_date(r["request_date"]),
                    "status": r["status"].strip(),
                }
            )

    tr_rows_filtered = [r for r in tr_rows if r["patient_id"] in patient_ids]

    valid_request_ids = {r["request_id"] for r in tr_rows_filtered}

    if tr_rows_filtered:
        conn.execute(
            text(
                "INSERT INTO transfusion_requests (request_id, patient_id, urgency_level, units_required, request_date, status) "
                "VALUES (:request_id, :patient_id, :urgency_level, :units_required, :request_date, :status)"
            ),
            tr_rows_filtered,
        )

    ut_rows: list[dict] = []
    with (_repo_root() / "data" / "UNIT_TRANSFERS.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            ut_rows.append(
                {
                    "transfer_id": int(r["transfer_id"]),
                    "unit_id": int(r["unit_id"]),
                    "from_facility_id": int(r["from_facility_id"]),
                    "to_facility_id": int(r["to_facility_id"]),
                    "transfer_date": _parse_date(r["transfer_date"]),
                }
            )
    ut_rows_filtered = [
        r
        for r in ut_rows
        if r["unit_id"] in unit_ids
        and r["from_facility_id"] in facility_ids
        and r["to_facility_id"] in facility_ids
    ]

    if ut_rows_filtered:
        conn.execute(
            text(
                "INSERT INTO unit_transfers (transfer_id, unit_id, from_facility_id, to_facility_id, transfer_date) "
                "VALUES (:transfer_id, :unit_id, :from_facility_id, :to_facility_id, :transfer_date)"
            ),
            ut_rows_filtered,
        )

    md_rows: list[dict] = []
    with (_repo_root() / "data" / "MATCH_DISPATCHES.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            md_rows.append(
                {
                    "dispatch_id": int(r["dispatch_id"]),
                    "request_id": int(r["request_id"]),
                    "unit_id": int(r["unit_id"]),
                    "dispatch_date": _parse_date(r["dispatch_date"]),
                    "distance_km": float(r["distance_km"]),
                    "status": r["status"].strip(),
                }
            )
    md_rows_filtered = [
        r
        for r in md_rows
        if r["request_id"] in valid_request_ids and r["unit_id"] in unit_ids
    ]

    if md_rows_filtered:
        conn.execute(
            text(
                "INSERT INTO match_dispatches (dispatch_id, request_id, unit_id, dispatch_date, distance_km, status) "
                "VALUES (:dispatch_id, :request_id, :unit_id, :dispatch_date, :distance_km, :status)"
            ),
            md_rows_filtered,
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM match_dispatches"))
    conn.execute(text("DELETE FROM unit_transfers"))
    conn.execute(text("DELETE FROM transfusion_requests"))
    conn.execute(text("DELETE FROM blood_units"))
    conn.execute(text("DELETE FROM donation_events"))
    conn.execute(text("DELETE FROM patients"))
    conn.execute(text("DELETE FROM donors"))
    conn.execute(text("DELETE FROM facilities"))
    conn.execute(text("DELETE FROM geographic_locations"))
