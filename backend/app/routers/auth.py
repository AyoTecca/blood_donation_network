from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth_deps import get_current_user
from app.auth_utils import create_access_token, get_password_hash, verify_password
from app.deps import get_db
from app.models_auth import AppUser
from app.schemas import Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(body: UserCreate, db: Session = Depends(get_db)) -> Token:
    existing = db.execute(
        text("SELECT user_id FROM app_users WHERE email = :e"),
        {"e": str(body.email)},
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    pw_hash = get_password_hash(body.password)
    db.execute(
        text(
            "INSERT INTO app_users (email, password_hash, role) "
            "VALUES (:email, :password_hash, 'staff')"
        ),
        {"email": str(body.email), "password_hash": pw_hash},
    )
    db.commit()

    token = create_access_token(subject=str(body.email), role="staff")
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)) -> Token:
    row = db.execute(
        text("SELECT email, password_hash, role FROM app_users WHERE email = :e"),
        {"e": str(body.email)},
    ).mappings().first()
    if row is None or not verify_password(body.password, str(row["password_hash"])):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token(subject=str(row["email"]), role=str(row["role"]))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: AppUser = Depends(get_current_user)) -> UserOut:
    return UserOut(user_id=user.user_id, email=user.email, role=user.role)
