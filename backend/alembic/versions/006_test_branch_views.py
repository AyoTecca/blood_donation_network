"""Create views required by test-branch API routes (dispatches, provenance, audit)."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from db_migration_sql import execute_sql_script, sql_dir

revision: str = "006_test_branch_views"
down_revision: Union[str, Sequence[str], None] = "005_app_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    root = sql_dir()
    for name in (
        "create_view_dispatch.sql",
        "create_view_provenance.sql",
        "create_view_audit.sql",
    ):
        execute_sql_script(conn, root / name)


def downgrade() -> None:
    op.execute("BEGIN EXECUTE IMMEDIATE 'DROP VIEW vw_dispatch_detail'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;")
    op.execute("BEGIN EXECUTE IMMEDIATE 'DROP VIEW vw_unit_lineage'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;")
    op.execute("BEGIN EXECUTE IMMEDIATE 'DROP VIEW vw_audit_log'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;")
