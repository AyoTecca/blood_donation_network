"""Load `.env` from project root (`blood_donation_custom/`) and/or `backend/` (second fills missing keys)."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_project_env() -> None:
    app_dir = Path(__file__).resolve().parent
    backend_root = app_dir.parent
    project_root = backend_root.parent
    load_dotenv(project_root / ".env")
    load_dotenv(backend_root / ".env")
