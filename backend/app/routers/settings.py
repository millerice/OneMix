"""服务端设置（SQLite）：默认 DashScope API Key 等。"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud_settings
from app.database import get_db
from app.schemas import ArkKeyIn, DashScopeKeyIn, SettingsOut

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
