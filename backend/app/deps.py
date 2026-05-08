from __future__ import annotations

import os
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import crud_settings
from app.database import get_db


def get_dashscope_api_key_optional(
    *,
    db: Session,
    x_dashscope_key: Optional[str],
    authorization: Optional[str],
) -> str | None:
    if x_dashscope_key and x_dashscope_key.strip():
        return x_dashscope_key.strip()
    if authorization and authorization.lower().startswith("bearer "):
        tok = authorization[7:].strip()
        if tok:
            return tok
    env = (os.environ.get("DASHSCOPE_API_KEY") or "").strip()
    if env:
        return env
    return crud_settings.get_dashscope_api_key(db)


def resolve_api_key(
    db: Annotated[Session, Depends(get_db)],
    x_dashscope_key: Annotated[Optional[str], Header(alias="X-DashScope-Key")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> str:
    stored = get_dashscope_api_key_optional(
        db=db, x_dashscope_key=x_dashscope_key, authorization=authorization
    )
    if stored:
        return stored
    raise HTTPException(
        status_code=401,
        detail=(
            "缺少 API Key：请使用请求头 X-DashScope-Key 或 Authorization: Bearer <key>，"
            "或设置环境变量 DASHSCOPE_API_KEY，或通过 PUT /api/settings/dashscope-key 写入服务端 SQLite。"
        ),
    )


def get_ark_api_key_optional(
    *,
    db: Session,
    x_ark_key: Optional[str],
) -> str | None:
    if x_ark_key and x_ark_key.strip():
        return x_ark_key.strip()
    env = (os.environ.get("ARK_API_KEY") or "").strip()
    if env:
        return env
    return crud_settings.get_ark_api_key(db)


def resolve_ark_api_key(
    db: Annotated[Session, Depends(get_db)],
    x_ark_key: Annotated[Optional[str], Header(alias="X-Ark-Key")] = None,
) -> str:
    key = get_ark_api_key_optional(db=db, x_ark_key=x_ark_key)
    if key:
        return key
    raise HTTPException(
        status_code=401,
        detail=(
            "缺少 ARK API Key：请使用请求头 X-Ark-Key，"
            "或设置环境变量 ARK_API_KEY，或通过 PUT /api/settings/ark-key 写入服务端 SQLite。"
        ),
    )
