"""Load blood_types from CSV and populate compatibility_matrix (ABO/Rh rules)."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "002_blood_types_compat"
down_revision: Union[str, Sequence[str], None] = "001_base_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _abo_recipients_for_donor(donor_group: str) -> set[str]:
    return {
        "O": {"O", "A", "B", "AB"},
        "A": {"A", "AB"},
        "B": {"B", "AB"},
        "AB": {"AB"},
    }.get(donor_group, set())


def _rh_compatible(donor_rh: str, recipient_rh: str) -> bool:
    if recipient_rh == "-":
        return donor_rh == "-"
    return True


def upgrade() -> None:
    data_dir = _repo_root() / "data"
    csv_path = data_dir / "BLOOD_TYPES.csv"
    conn = op.get_bind()

    rows: list[dict] = []
    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                {
                    "blood_type_id": int(r["blood_type_id"]),
                    "type_group": r["type_group"].strip(),
                    "rh_factor": r["rh_factor"].strip(),
                }
            )

    if rows:
        conn.execute(
            text(
                """
                INSERT INTO blood_types (blood_type_id, type_group, rh_factor)
                VALUES (:blood_type_id, :type_group, :rh_factor)
                """
            ),
            rows,
        )

    pairs: list[dict] = []
    for d in rows:
        for r in rows:
            if r["type_group"] not in _abo_recipients_for_donor(d["type_group"]):
                continue
            if not _rh_compatible(d["rh_factor"], r["rh_factor"]):
                continue
            pairs.append(
                {
                    "donor_blood_type_id": d["blood_type_id"],
                    "recipient_blood_type_id": r["blood_type_id"],
                }
            )

    if pairs:
        conn.execute(
            text(
                """
                INSERT INTO compatibility_matrix (donor_blood_type_id, recipient_blood_type_id)
                VALUES (:donor_blood_type_id, :recipient_blood_type_id)
                """
            ),
            pairs,
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM compatibility_matrix"))
    conn.execute(text("DELETE FROM blood_types"))
