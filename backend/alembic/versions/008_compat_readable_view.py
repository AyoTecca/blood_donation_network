"""Create vw_compat_pairs_readable for Blood Lab matrix API."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from db_migration_sql import execute_sql_script, sql_dir

revision: str = "008_compat_readable_view"
down_revision: Union[str, Sequence[str], None] = "007_backfill_request_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    execute_sql_script(conn, sql_dir() / "create_view_compat_table.sql")


def downgrade() -> None:
    op.execute(
        "BEGIN EXECUTE IMMEDIATE 'DROP VIEW vw_compat_pairs_readable'; "
        "EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;"
    )
