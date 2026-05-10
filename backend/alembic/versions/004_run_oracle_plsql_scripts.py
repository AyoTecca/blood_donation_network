"""Apply packaged Oracle PL/SQL from copied course scripts."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from db_migration_sql import execute_sql_script, sql_dir

revision: str = "004_run_oracle_plsql"
down_revision: Union[str, Sequence[str], None] = "003_load_csv_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    root = sql_dir()
    execute_sql_script(conn, root / "package_of_all.sql", preprocess="package_of_all")
    execute_sql_script(conn, root / "finalization_hardening.sql")
    execute_sql_script(conn, root / "workflow_gap_closure.sql")


def downgrade() -> None:
    """Minimal teardown — drops main packages (full view/trigger cleanup optional)."""
    stmts = [
        """BEGIN
             EXECUTE IMMEDIATE 'DROP PACKAGE blood_network_pkg';
           EXCEPTION WHEN OTHERS THEN
             IF SQLCODE != -4043 THEN RAISE; END IF;
           END;""",
        """BEGIN
             EXECUTE IMMEDIATE 'DROP PACKAGE pkg_request_workflow';
           EXCEPTION WHEN OTHERS THEN
             IF SQLCODE != -4043 THEN RAISE; END IF;
           END;""",
        """BEGIN
             EXECUTE IMMEDIATE 'DROP PACKAGE pkg_blood_management';
           EXCEPTION WHEN OTHERS THEN
             IF SQLCODE != -4043 THEN RAISE; END IF;
           END;""",
        """BEGIN
             EXECUTE IMMEDIATE 'DROP PACKAGE pkg_blood_operations';
           EXCEPTION WHEN OTHERS THEN
             IF SQLCODE != -4043 THEN RAISE; END IF;
           END;""",
    ]
    for s in stmts:
        op.execute(text(s))
