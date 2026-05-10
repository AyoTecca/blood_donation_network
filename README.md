# Blood Donation Network — Custom stack (FastAPI + React + Oracle)

Oracle APEX–free setup: **Oracle Database Free** in Docker, course **PL/SQL** scripts applied via **Alembic**, CSV **data** under `data/`, API **FastAPI**, UI **React (Vite)**.

## Prerequisites

- Docker Desktop (WSL2 backend recommended on Windows)
- Python **3.11+**
- [Poetry](https://python-poetry.org/docs/#installation)
- Node.js **18+** (for the frontend)

## Environment and secrets

1. Copy the template and edit **`.env`**. The app and Alembic load, in order: **`blood_donation_custom/.env`** (next to `docker-compose.yml`), then **`backend/.env`** if present (missing keys only; use one file to avoid confusion). **Do not commit `.env`** — it is listed in `.gitignore`.
2. Replace every `REPLACE_WITH_*` placeholder in [`.env.example`](.env.example) with real values for your machine.
3. **`ORACLE_PASSWORD`** must match **`DATABASE_URL`** (same user/password) and is passed into the Oracle container via Docker Compose.
4. **`JWT_SECRET`** is required by the FastAPI app (no default in code); use a long random string.
5. **`DEV_ADMIN_EMAIL`** and **`DEV_ADMIN_PASSWORD`** are required when you run Alembic revision **`005_app_users`** — they seed the first `admin` user. Use the same email/password when signing in at `/auth`.

Public API routes (no JWT): `/health`, `/api/auth/register`, `/api/auth/login`, and `/api/public/network-stats`.

## 1. Start Oracle Database Free

From this folder (`blood_donation_custom/`):

```powershell
copy .env.example .env
# Edit .env: set ORACLE_PASSWORD, DATABASE_URL, JWT_SECRET, DEV_ADMIN_*, etc.
docker compose up -d
```

Wait until the container reports healthy (~2–5 minutes first boot).

## 2. Backend (Poetry + in-project venv)

```powershell
cd backend
poetry config virtualenvs.in-project true
poetry install
```

Alembic and FastAPI read **`DATABASE_URL`**, **`JWT_SECRET`**, and related variables from **`blood_donation_custom/.env`** (two levels above `backend/app/`). See [`.env.example`](.env.example) for the full list.

Run migrations (creates tables, loads CSVs, runs Oracle SQL scripts, then **`app_users`** for JWT auth):

```powershell
poetry run alembic upgrade head
```

Start API:

```powershell
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health (no auth): `http://127.0.0.1:8000/health`
- OpenAPI docs: `http://127.0.0.1:8000/docs`

**Authentication:** All `/api/*` routes except `/api/auth/register`, `/api/auth/login`, `/api/public/*`, and `/health` require an `Authorization: Bearer <access_token>` header. The React app stores the token after sign-in and sends it automatically.

**Paged list APIs:** `GET /api/admin/request-overview` and `GET /api/open-requests` return a JSON object `{ "items": [...], "total": <number>, "page": <number>, "page_size": <number> }` instead of a bare array. Both accept `page` (default `1`) and `page_size` (must be **10**, **25**, **50**, or **100**). Optional filter query parameters are listed under **`/docs`** (e.g. admin: `request_status`, `city_name`, `blood_type`, `urgency_min` / `urgency_max`, `date_from` / `date_to`; open requests: `status`, `facility_name`, `blood_type`, urgency range). Dropdown values for the UIs come from **`GET /api/admin/request-overview/filter-options`** and **`GET /api/open-requests/filter-options`**.

**Seeded admin:** After `005_app_users` succeeds, sign in with **`DEV_ADMIN_EMAIL`** / **`DEV_ADMIN_PASSWORD`** from your `.env` (not documented here as literal credentials).

**Staff sign-up:** Use **Sign up** on `/auth`; new users get role **`staff`** and cannot open **Admin** until promoted in the database (update `app_users.role` to `admin` if needed).

## 3. Frontend

```powershell
cd ..\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. You will be redirected to **`/auth`** until you sign in. Vite proxies `/api` and `/health` to port **8000**. After login, **Home** loads dashboard insights; **Admin** appears in the sidebar only for users with role **`admin`**.

## Git / new repository

- Track **`.env.example`**; never commit **`.env`**.
- Root **`.gitignore`** covers `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`, caches, and env files. **`backend/.gitignore`** and **`frontend/.gitignore`** add extra safety if those folders are used alone.

## Migration order

| Revision | Purpose |
|----------|---------|
| `001_base_schema` | Core tables + `compatibility_matrix` |
| `002_blood_types_compat` | `BLOOD_TYPES.csv` + ABO/Rh compatibility pairs |
| `003_load_csv_data` | Remaining CSVs (locations, facilities, donors, …) |
| `004_run_oracle_plsql` | Your three Oracle scripts from `backend/sql/` |
| `005_app_users` | `app_users` table + bcrypt seed **admin** from **`DEV_ADMIN_EMAIL`** / **`DEV_ADMIN_PASSWORD`** |

`package_of_all.sql` demo blocks at the bottom are **skipped** during migration (see `db_migration_sql.strip_package_demo_blocks`).

## Troubleshooting

- **`Fatal error in launcher: Unable to create process ... python.exe`** (Windows): the `.venv` was created under an old folder path (e.g. after moving `blood_donation_custom`). From `backend/`, run `Remove-Item -Recurse -Force .venv`, then `poetry env remove --all`, then `poetry install` so `alembic.exe` / `uvicorn.exe` point at the current path.
- **`JWT_SECRET is not set`**: create/update **`blood_donation_custom/.env`** from `.env.example`.
- **`005_app_users: set DEV_ADMIN_EMAIL`**: set both dev admin variables in `.env`, then run `poetry run alembic upgrade head` again.
- **Alembic cannot connect**: confirm Docker is healthy, `FREEPDB1` service, host `localhost`, port `1521`, and that **`DATABASE_URL`** / **`ORACLE_PASSWORD`** match the container.
- **`ORA-` errors during `004`**: open SQL scripts in `backend/sql/` — they match the course repo; ensure `003` loaded without FK violations.
- **Heavy RAM**: Oracle Free needs several GB free RAM; close other apps if startup fails.
- **`005_app_users` / passlib + bcrypt errors**: this project pins **`bcrypt` below 4.1** so it works with **passlib 1.7.4**. If `alembic upgrade` failed mid-`005`, run `poetry run alembic downgrade 004` then `poetry run alembic upgrade head` again after `poetry install`.
- **`ORA-00955` on `app_users`**: an earlier failed run can leave **`app_users`** in Oracle while Alembic still points at `004`. Migration `005` now **drops `app_users` if it exists** before `CREATE TABLE`; run `poetry run alembic upgrade head` again.

## Project layout

```
blood_donation_custom/
  docker-compose.yml
  .env.example
  .gitignore
  data/                 # CSV datasets 
  backend/
    pyproject.toml
    alembic/
    sql/                # Oracle scripts 
    app/                # FastAPI
  frontend/             # React + Vite
```
