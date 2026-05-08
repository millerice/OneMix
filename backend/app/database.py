"""SQLite 连接与会话（数据目录默认：backend/data）。"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

_backend_root = Path(__file__).resolve().parent.parent
_default_data = _backend_root / "data"
DATA_DIR = Path(os.environ.get("ONEMIX_DATA_DIR", str(_default_data))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

_db_file = DATA_DIR / "onemix.db"
# Windows 下使用正斜杠，避免 sqlite 路径问题
_sqlite_url = "sqlite:///" + _db_file.resolve().as_posix()

engine = create_engine(
    _sqlite_url,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """创建表结构（需在 import models 之后调用）。"""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
