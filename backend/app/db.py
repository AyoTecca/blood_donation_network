from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.dotenv_load import load_project_env

load_project_env()


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    user = (os.environ.get("ORACLE_USER") or "").strip() or "SYSTEM"
    password = (os.environ.get("ORACLE_PASSWORD") or "").strip()
    host = (os.environ.get("ORACLE_HOST") or "").strip() or "localhost"
    port = (os.environ.get("ORACLE_PORT") or "").strip() or "1521"
    service = (os.environ.get("ORACLE_SERVICE") or "").strip() or "FREEPDB1"
    if not password:
        raise RuntimeError(
            "DATABASE_URL is not set and ORACLE_PASSWORD is empty. "
            "Set DATABASE_URL or ORACLE_PASSWORD in blood_donation_custom/.env (see .env.example)."
        )
    return f"oracle+oracledb://{user}:{password}@{host}:{port}/?service_name={service}"


engine = create_engine(_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
