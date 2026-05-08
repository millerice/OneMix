from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class SlotJobIn(BaseModel):
    list_index: int
    kind: Literal["main", "detail"]
    index: int
    prompt: str
    export_path: Optional[str] = None
    ref_image_path: Optional[str] = None
    ref_white_index: Optional[int] = Field(
        default=None,
        description="白底图序号（从 0 起）；为空时按主窗口规则自动选。",
    )


class PlanSlotsBody(BaseModel):
    product_name: str
    product_desc: str = ""
    competitor_summary: str = ""
    n_main: int = 5
    n_detail: int = 10
    strategy: str = "background_v2"
    n_white_images: int = Field(default=1, ge=1, description="用于计算每张槽位默认参考的白底图数量（与实际上传张数一致即可）。")
    custom_template: str = ""
    user_requirements: str = ""


class PlanSlotsRow(BaseModel):
    list_index: int
    kind: str
    index: int
    prompt: str
    ref_white_index: int


class PlanSingleBody(BaseModel):
    product_name: str
    product_desc: str = ""
    competitor_summary: str = ""
    kind: Literal["main", "detail"]
    index: int
    strategy: str = "background_v2"
    old_prompt: str = ""


class CreateJobBody(BaseModel):
    slot_jobs: list[SlotJobIn]
    dw: int = 750
    dh: int = 1200
    fmt: str = "JPG"
    strategy: str = "background_v2"
    only_indices: Optional[list[int]] = None
    skip_done: bool = True


class JobStatusOut(BaseModel):
    id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress: int = 0
    total: int = 0
    error: Optional[str] = None
    results: Optional[list[dict]] = None
    session_rel: Optional[str] = None


class DashScopeKeyIn(BaseModel):
    api_key: str = Field(min_length=1, description="写入 SQLite 的 DashScope API Key")


class ArkKeyIn(BaseModel):
    api_key: str = Field(min_length=1, description="写入 SQLite 的 ARK API Key")


class SettingsOut(BaseModel):
    has_dashscope_key: bool
    dashscope_key_preview: Optional[str] = Field(
        default=None, description="仅展示末尾若干字符，不全文返回"
    )
    dashscope_key_updated_at: Optional[str] = Field(
        default=None, description="ISO8601 时间（UTC 存库为 naive 时按本地展示）"
    )
    has_ark_key: bool = False
    ark_key_preview: Optional[str] = Field(
        default=None, description="仅展示末尾若干字符，不全文返回"
    )
    ark_key_updated_at: Optional[str] = Field(
        default=None, description="ISO8601 时间（UTC 存库为 naive 时按本地展示）"
    )


class ExtractInfoOut(BaseModel):
    merged_text: str
    extracted_json: dict
    source_stats: dict[str, int]
