# Backend

Use the root [README.md](../README.md) for full setup.

Quick reference:

```powershell
poetry config virtualenvs.in-project true
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Copy **`.env.example`** to **`blood_donation_custom/.env`** (recommended, same folder as `docker-compose.yml`) or optionally **`backend/.env`**. Set **`JWT_SECRET`** and DB variables in at least one of those files — they are not read from code defaults.
