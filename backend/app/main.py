from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, dashboard, data, public, requests, analytics, dispatches, audit, compatibility
from app.routers import provenance

app = FastAPI(title="Blood Donation Network API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(dashboard.router)
app.include_router(data.router)
app.include_router(requests.router)
app.include_router(analytics.router)
app.include_router(dispatches.router)
app.include_router(audit.router)
app.include_router(compatibility.router)
app.include_router(provenance.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
