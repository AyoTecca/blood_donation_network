from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AppUser:
    user_id: int
    email: str
    role: str
