"""세션·대화·분기 저장소 (SQLite). 원작 데이터는 여기에 넣지 않는다."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


def _id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}


class SessionRow(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    work_id: Mapped[str]
    scene_id: Mapped[str]
    now: Mapped[str]
    mode: Mapped[str] = mapped_column(default="canon")
    branch_id: Mapped[str | None] = mapped_column(default=None)
    canon_fingerprint: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=_now)


class TurnRow(Base):
    __tablename__ = "turns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    branch_id: Mapped[str | None] = mapped_column(default=None)
    character_id: Mapped[str]
    question: Mapped[str]
    intent: Mapped[str]
    mode: Mapped[str]
    reply: Mapped[dict[str, Any]]
    report: Mapped[dict[str, Any]]
    passage_ids: Mapped[list[Any]]
    attempts: Mapped[int]
    fallback: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(default=_now)


class DiscoveryRow(Base):
    __tablename__ = "discoveries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    object_id: Mapped[str]
    passage_ids: Mapped[list[Any]]
    created_at: Mapped[datetime] = mapped_column(default=_now)


class BranchRow(Base):
    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    option_id: Mapped[str]
    diverges_at: Mapped[str]
    snapshot: Mapped[dict[str, Any]]
    created_at: Mapped[datetime] = mapped_column(default=_now)


class BranchEventRow(Base):
    __tablename__ = "branch_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"), index=True)
    kind: Mapped[str]  # choice | relation_change | reaction
    character_id: Mapped[str | None] = mapped_column(default=None)
    payload: Mapped[dict[str, Any]]
    consistent: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)


def make_engine(url: str) -> Engine:
    if url in ("sqlite://", "sqlite:///:memory:"):
        return create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    return create_engine(url, connect_args={"check_same_thread": False})


def make_sessionmaker(url: str) -> sessionmaker:
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)
