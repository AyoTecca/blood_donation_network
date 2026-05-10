"""Base relational schema for CSV data + compatibility_matrix."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "001_base_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _run(ddl: str) -> None:
    op.execute(text(ddl))


def upgrade() -> None:
    _run(
        """
        CREATE TABLE geographic_locations (
            location_id     NUMBER NOT NULL,
            city_name       VARCHAR2(200) NOT NULL,
            latitude        NUMBER NOT NULL,
            longitude       NUMBER NOT NULL,
            CONSTRAINT pk_geographic_locations PRIMARY KEY (location_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE blood_types (
            blood_type_id   NUMBER NOT NULL,
            type_group      VARCHAR2(10) NOT NULL,
            rh_factor       VARCHAR2(2) NOT NULL,
            CONSTRAINT pk_blood_types PRIMARY KEY (blood_type_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE compatibility_matrix (
            donor_blood_type_id     NUMBER NOT NULL,
            recipient_blood_type_id NUMBER NOT NULL,
            CONSTRAINT pk_compatibility_matrix PRIMARY KEY (donor_blood_type_id, recipient_blood_type_id),
            CONSTRAINT fk_cm_donor_bt FOREIGN KEY (donor_blood_type_id) REFERENCES blood_types (blood_type_id),
            CONSTRAINT fk_cm_recipient_bt FOREIGN KEY (recipient_blood_type_id) REFERENCES blood_types (blood_type_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE facilities (
            facility_id     NUMBER NOT NULL,
            facility_name   VARCHAR2(200) NOT NULL,
            facility_type   VARCHAR2(50) NOT NULL,
            location_id     NUMBER NOT NULL,
            CONSTRAINT pk_facilities PRIMARY KEY (facility_id),
            CONSTRAINT fk_facilities_loc FOREIGN KEY (location_id) REFERENCES geographic_locations (location_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE donors (
            donor_id            NUMBER NOT NULL,
            first_name          VARCHAR2(100) NOT NULL,
            last_name           VARCHAR2(100) NOT NULL,
            blood_type_id       NUMBER NOT NULL,
            last_donation_date  DATE NOT NULL,
            location_id         NUMBER NOT NULL,
            CONSTRAINT pk_donors PRIMARY KEY (donor_id),
            CONSTRAINT fk_donors_bt FOREIGN KEY (blood_type_id) REFERENCES blood_types (blood_type_id),
            CONSTRAINT fk_donors_loc FOREIGN KEY (location_id) REFERENCES geographic_locations (location_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE patients (
            patient_id           NUMBER NOT NULL,
            first_name           VARCHAR2(100) NOT NULL,
            last_name            VARCHAR2(100) NOT NULL,
            blood_type_id        NUMBER NOT NULL,
            current_facility_id  NUMBER NOT NULL,
            CONSTRAINT pk_patients PRIMARY KEY (patient_id),
            CONSTRAINT fk_patients_bt FOREIGN KEY (blood_type_id) REFERENCES blood_types (blood_type_id),
            CONSTRAINT fk_patients_fac FOREIGN KEY (current_facility_id) REFERENCES facilities (facility_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE donation_events (
            donation_id               NUMBER NOT NULL,
            donor_id                  NUMBER NOT NULL,
            facility_id               NUMBER NOT NULL,
            donation_date             DATE NOT NULL,
            medical_screening_status  VARCHAR2(50) NOT NULL,
            CONSTRAINT pk_donation_events PRIMARY KEY (donation_id),
            CONSTRAINT fk_de_donor FOREIGN KEY (donor_id) REFERENCES donors (donor_id),
            CONSTRAINT fk_de_fac FOREIGN KEY (facility_id) REFERENCES facilities (facility_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE blood_units (
            unit_id               NUMBER NOT NULL,
            donation_id           NUMBER NOT NULL,
            component_type        VARCHAR2(50) NOT NULL,
            expiry_date           DATE NOT NULL,
            status                VARCHAR2(50) NOT NULL,
            current_facility_id   NUMBER NOT NULL,
            CONSTRAINT pk_blood_units PRIMARY KEY (unit_id),
            CONSTRAINT fk_bu_de FOREIGN KEY (donation_id) REFERENCES donation_events (donation_id),
            CONSTRAINT fk_bu_fac FOREIGN KEY (current_facility_id) REFERENCES facilities (facility_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE transfusion_requests (
            request_id      NUMBER NOT NULL,
            patient_id      NUMBER NOT NULL,
            urgency_level   NUMBER NOT NULL,
            units_required  NUMBER NOT NULL,
            request_date    DATE NOT NULL,
            status          VARCHAR2(50) NOT NULL,
            CONSTRAINT pk_transfusion_requests PRIMARY KEY (request_id),
            CONSTRAINT fk_tr_patient FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE unit_transfers (
            transfer_id         NUMBER NOT NULL,
            unit_id             NUMBER NOT NULL,
            from_facility_id    NUMBER NOT NULL,
            to_facility_id      NUMBER NOT NULL,
            transfer_date       DATE NOT NULL,
            CONSTRAINT pk_unit_transfers PRIMARY KEY (transfer_id),
            CONSTRAINT fk_ut_unit FOREIGN KEY (unit_id) REFERENCES blood_units (unit_id),
            CONSTRAINT fk_ut_from FOREIGN KEY (from_facility_id) REFERENCES facilities (facility_id),
            CONSTRAINT fk_ut_to FOREIGN KEY (to_facility_id) REFERENCES facilities (facility_id)
        )
        """
    )
    _run(
        """
        CREATE TABLE match_dispatches (
            dispatch_id    NUMBER NOT NULL,
            request_id     NUMBER NOT NULL,
            unit_id        NUMBER NOT NULL,
            dispatch_date  DATE NOT NULL,
            distance_km    NUMBER NOT NULL,
            status         VARCHAR2(50) NOT NULL,
            CONSTRAINT pk_match_dispatches PRIMARY KEY (dispatch_id),
            CONSTRAINT fk_md_req FOREIGN KEY (request_id) REFERENCES transfusion_requests (request_id),
            CONSTRAINT fk_md_unit FOREIGN KEY (unit_id) REFERENCES blood_units (unit_id)
        )
        """
    )


def downgrade() -> None:
    for tbl in (
        "match_dispatches",
        "unit_transfers",
        "transfusion_requests",
        "blood_units",
        "donation_events",
        "patients",
        "donors",
        "facilities",
        "compatibility_matrix",
        "blood_types",
        "geographic_locations",
    ):
        op.execute(text(f'DROP TABLE {tbl}'))
