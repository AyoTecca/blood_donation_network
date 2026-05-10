from __future__ import annotations

import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def get_url() -> str:
    url = (os.environ.get("DATABASE_URL") or "").strip()
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
            "Set them in blood_donation_custom/.env (see .env.example)."
        )
    return f"oracle+oracledb://{user}:{password}@{host}:{port}/?service_name={service}"


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
