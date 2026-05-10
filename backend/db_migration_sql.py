"""Helpers to execute Oracle SQL scripts (SQL*Plus-style `/` terminators, PROMPT stripping)."""

from __future__ import annotations

from pathlib import Path


def strip_prompt_lines(sql_text: str) -> str:
    lines_out = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("PROMPT "):
            continue
        lines_out.append(line)
    return "\n".join(lines_out)


def strip_package_demo_blocks(sql_text: str) -> str:
    """Remove standalone demo SELECT/anonymous blocks from package_of_all.sql."""
    marker_demo = "-- 1. Test the distance function"
    marker_mgmt = "CREATE OR REPLACE PACKAGE pkg_blood_management"
    if marker_demo not in sql_text or marker_mgmt not in sql_text:
        return sql_text
    i = sql_text.index(marker_demo)
    j = sql_text.index(marker_mgmt)
    return sql_text[:i].rstrip() + "\n\n" + sql_text[j:].lstrip()


def split_sql_chunks(sql_text: str) -> list[str]:
    """
    Split on lines that contain only `/` (SQL*Plus PL/SQL terminator).
    Remaining tail without trailing `/` is emitted as its own chunk if non-empty.
    """
    lines = sql_text.splitlines()
    buf: list[str] = []
    chunks: list[str] = []

    for line in lines:
        if line.strip() == "/":
            chunk = "\n".join(buf).strip()
            buf = []
            if chunk:
                chunks.append(chunk)
        else:
            buf.append(line)

    tail = "\n".join(buf).strip()
    if tail:
        chunks.append(tail)

    return chunks


def execute_sql_script(connection, path: Path, *, preprocess: str | None = None) -> None:
    raw = path.read_text(encoding="utf-8")
    raw = strip_prompt_lines(raw)
    if preprocess == "package_of_all":
        raw = strip_package_demo_blocks(raw)
    for chunk in split_sql_chunks(raw):
        chunk = chunk.strip()
        if not chunk:
            continue
        # Must not use sqlalchemy.text(): Oracle triggers use :NEW / :OLD, which text()
        # incorrectly treats as bind parameters (e.g. bind name "NEW").
        connection.exec_driver_sql(chunk)


def sql_dir() -> Path:
    return Path(__file__).resolve().parent / "sql"
