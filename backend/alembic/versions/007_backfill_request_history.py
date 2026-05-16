"""Backfill transfusion_request_history for CSV-loaded requests (pre-trigger data)."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from db_migration_sql import execute_sql_script, sql_dir

revision: str = "007_backfill_request_history"
down_revision: Union[str, Sequence[str], None] = "006_test_branch_views"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    execute_sql_script(conn, sql_dir() / "backfill_request_history.sql")


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM transfusion_request_history
        WHERE change_note = 'Backfilled from seed transfusion_requests'
        """
    )
