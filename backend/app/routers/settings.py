"""服务端设置（SQLite）：默认 DashScope API Key 等。"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import crud_settings
from app.database import get_db
from app.deps import get_ark_api_key_optional, get_dashscope_api_key_optional
from app.schemas import (
    ArkKeyIn,
    ArkSeedreamModelOut,
    ArkSeedreamModelsOut,
    DashScopeKeyIn,
    DashScopeQwenImageModelOut,
    DashScopeQwenImageModelsOut,
    SettingsOut,
)
from onemix.services import dashscope_svc

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def read_settings(db: Session = Depends(get_db)) -> SettingsOut:
    ds_row = crud_settings.get_dashscope_record(db)
    ark_row = crud_settings.get_ark_record(db)

    ds_preview = None
    ds_updated = None
    has_ds = bool(ds_row and (ds_row.value or "").strip())
    if has_ds and ds_row:
        raw = ds_row.value.strip()
        ds_preview = ("****" + raw[-4:]) if len(raw) >= 4 else "****"
        if ds_row.updated_at:
            ds_updated = ds_row.updated_at.isoformat()

    ark_preview = None
    ark_updated = None
    has_ark = bool(ark_row and (ark_row.value or "").strip())
    if has_ark and ark_row:
        raw = ark_row.value.strip()
        ark_preview = ("****" + raw[-4:]) if len(raw) >= 4 else "****"
        if ark_row.updated_at:
            ark_updated = ark_row.updated_at.isoformat()

    return SettingsOut(
        has_dashscope_key=has_ds,
        dashscope_key_preview=ds_preview,
        dashscope_key_updated_at=ds_updated,
        has_ark_key=has_ark,
        ark_key_preview=ark_preview,
        ark_key_updated_at=ark_updated,
    )


@router.put("/dashscope-key")
def save_dashscope_key(body: DashScopeKeyIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    crud_settings.set_dashscope_api_key(db, body.api_key)
    return {"ok": True}


@router.delete("/dashscope-key")
def clear_dashscope_key(db: Session = Depends(get_db)) -> dict[str, bool]:
    crud_settings.delete_dashscope_api_key(db)
    return {"ok": True}


@router.put("/ark-key")
def save_ark_key(body: ArkKeyIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    crud_settings.set_ark_api_key(db, body.api_key)
    return {"ok": True}


@router.delete("/ark-key")
def clear_ark_key(db: Session = Depends(get_db)) -> dict[str, bool]:
    crud_settings.delete_ark_api_key(db)
    return {"ok": True}


@router.get("/ark-seedream-models", response_model=ArkSeedreamModelsOut)
def list_ark_seedream_models(
    db: Session = Depends(get_db),
    x_ark_key: Annotated[Optional[str], Header(alias="X-Ark-Key")] = None,
) -> ArkSeedreamModelsOut:
    """从方舟 GET /v3/models 同步当前 Key 可用的 Seedream 模型。"""
    ark_key = get_ark_api_key_optional(db=db, x_ark_key=x_ark_key)
    if not ark_key:
        raise HTTPException(
            401,
            "缺少 ARK API Key：请先在设置中保存，或通过请求头 X-Ark-Key / 环境变量 ARK_API_KEY 提供。",
        )
    try:
        rows = dashscope_svc.list_ark_seedream_models(api_key=ark_key)
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    return ArkSeedreamModelsOut(
        models=[ArkSeedreamModelOut(**row) for row in rows],
        source="ark:/v3/models",
    )


@router.get("/dashscope-qwen-image-models", response_model=DashScopeQwenImageModelsOut)
def list_dashscope_qwen_image_models(
    db: Session = Depends(get_db),
    x_dashscope_key: Annotated[Optional[str], Header(alias="X-DashScope-Key")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> DashScopeQwenImageModelsOut:
    """从百炼 Models.list / Models.get 同步当前 Key 可见的 Qwen-Image 模型。"""
    ds_key = get_dashscope_api_key_optional(
        db=db, x_dashscope_key=x_dashscope_key, authorization=authorization
    )
    if not ds_key:
        raise HTTPException(
            401,
            "缺少 DashScope API Key：请先在设置中保存，或通过请求头 X-DashScope-Key / Authorization / 环境变量 DASHSCOPE_API_KEY 提供。",
        )
    try:
        rows = dashscope_svc.list_dashscope_qwen_image_models(api_key=ds_key)
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    return DashScopeQwenImageModelsOut(
        models=[DashScopeQwenImageModelOut(**row) for row in rows],
        source="dashscope:/api/v1/models",
    )
