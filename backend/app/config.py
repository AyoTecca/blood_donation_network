from __future__ import annotations

import os
from pathlib import Path

from app.dotenv_load import load_project_env

load_project_env()

_raw_jwt = os.environ.get("JWT_SECRET", "").strip()
if not _raw_jwt:
    _app = Path(__file__).resolve().parent
    _proj = _app.parent.parent / ".env"
    _back = _app.parent / ".env"
    raise RuntimeError(
        "JWT_SECRET is not set or is empty. Add it to one of:\n"
        f"  - {_proj}\n"
        f"  - {_back}\n"
        "Copy blood_donation_custom/.env.example to .env, set JWT_SECRET to a long random string, "
        "and restart uvicorn (see README)."
    )
JWT_SECRET = _raw_jwt
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
