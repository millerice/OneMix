from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import gc
import io
import json
import os
import tempfile
import time
import zipfile
import csv
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db, init_db
from app.deps import (
    get_ark_api_key_optional,
    get_dashscope_api_key_optional,
    resolve_api_key,
)
from app.jobs_store import get_job, start_generate_job
from app.providers.dashscope_provider import DashScopeProvider
from app.ref_paths import default_ref_white_index
from app.routers import settings as settings_routes
from app.schemas import (
    CreateJobBody,
    ExtractInfoOut,
    JobStatusOut,
    PlanSingleBody,
    PlanSlotsBody,
    PlanSlotsRow,
)
from onemix.services import dashscope_svc

_api_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="onemix_api")


def _write_temp_upload(data: bytes, suffix: str) -> Path:
    """写入临时文件并立即关闭句柄，避免 Windows 上 mkstemp 未关闭导致无法删除。"""
    fd, name = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)
    return Path(name)


def _try_unlink(path: Path) -> None:
    """删除临时文件；若第三方 SDK 仍短暂占用，则重试。"""
    for i in range(12):
        try:
            path.unlink(missing_ok=True)
            return
        except PermissionError:
            gc.collect()
            time.sleep(0.04 * (i + 1))
        except FileNotFoundError:
            return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def get_provider() -> DashScopeProvider:
    return DashScopeProvider()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="OneMix API", version="0.1.0", lifespan=lifespan)
app.include_router(settings_routes.router, prefix="/api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


async def _run_blocking(call):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_api_pool, call)


def _decode_text_bytes(data: bytes) -> str:
    for enc in ("utf-8", "utf-8-sig", "gb18030", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _parse_text_file(name: str, data: bytes) -> str:
    suffix = Path(name).suffix.lower()
    txt = _decode_text_bytes(data)
    if suffix == ".csv":
        rows = list(csv.reader(txt.splitlines()))
        return "\n".join(["\t".join(r) for r in rows if r])
    return txt


def _is_image_upload(name: str, content_type: str | None) -> bool:
    suf = Path(name).suffix.lower()
    if content_type and content_type.startswith("image/"):
        return True
    return suf in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}


@app.post("/api/ocr")
async def api_ocr(
    api_key: Annotated[str, Depends(resolve_api_key)],
    provider: Annotated[DashScopeProvider, Depends(get_provider)],
    image: UploadFile = File(...),
) -> dict[str, str]:
    suffix = Path(image.filename or "ocr.png").suffix or ".png"
    data = await image.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "图片过大")

    tmp_path = _write_temp_upload(data, suffix)
    try:

        def work() -> str:
            return provider.ocr_from_image(api_key=api_key, image_path=tmp_path)

        text = await _run_blocking(work)
    finally:
        _try_unlink(tmp_path)
    return {"text": text}


@app.post("/api/extract/key-info", response_model=ExtractInfoOut)
async def api_extract_key_info(
    api_key: Annotated[str, Depends(resolve_api_key)],
    files: list[UploadFile] = File(...),
) -> ExtractInfoOut:
    if not files:
        raise HTTPException(400, "请至少上传一个文件")

    merged_parts: list[str] = []
    image_count = 0
    text_count = 0
    temp_images: list[Path] = []
    try:
        for f in files:
            name = f.filename or "unknown"
            data = await f.read()
            if not data:
                continue
            if len(data) > 30 * 1024 * 1024:
                raise HTTPException(413, f"文件过大: {name}")
            if _is_image_upload(name, f.content_type):
                image_count += 1
                p = _write_temp_upload(data, Path(name).suffix or ".png")
                temp_images.append(p)

                def ocr_work() -> str:
                    return dashscope_svc.ocr_from_image(api_key=api_key, image_path=p)

                text = await _run_blocking(ocr_work)
                merged_parts.append(f"## 文件: {name}\n{text.strip()}")
            else:
                text_count += 1
                parsed = _parse_text_file(name, data).strip()
                if parsed:
                    merged_parts.append(f"## 文件: {name}\n{parsed}")
        merged_text = "\n\n".join([x for x in merged_parts if x.strip()]).strip()
        if not merged_text:
            raise HTTPException(400, "未解析出有效文本，请检查上传内容")

        def extract_work() -> dict:
            return dashscope_svc.extract_key_info_from_text(api_key=api_key, text=merged_text)

        extracted = await _run_blocking(extract_work)
        return ExtractInfoOut(
            merged_text=merged_text,
            extracted_json=extracted,
            source_stats={
                "file_count": len(files),
                "image_count": image_count,
                "text_count": text_count,
            },
        )
    finally:
        for p in temp_images:
            _try_unlink(p)


@app.post("/api/competitor")
async def api_competitor(
    api_key: Annotated[str, Depends(resolve_api_key)],
    provider: Annotated[DashScopeProvider, Depends(get_provider)],
    images: list[UploadFile] = File(...),
) -> dict[str, str]:
    paths: list[Path] = []
    try:
        for uf in images:
            data = await uf.read()
            if len(data) > 25 * 1024 * 1024:
                raise HTTPException(413, "单张图片过大")
            suf = Path(uf.filename or "c.png").suffix or ".png"
            paths.append(_write_temp_upload(data, suf))

        def work() -> str:
            return provider.competitor_to_prompt(api_key=api_key, image_paths=paths)

        text = await _run_blocking(work)
    finally:
        for p in paths:
            _try_unlink(p)
    return {"text": text}


@app.post("/api/plan/slots")
async def api_plan_slots(
    api_key: Annotated[str, Depends(resolve_api_key)],
    provider: Annotated[DashScopeProvider, Depends(get_provider)],
    body: PlanSlotsBody,
) -> dict[str, object]:

    def work() -> list[tuple[str, int, str]]:
        return provider.plan_background_prompts_for_slots(
            api_key=api_key,
            product_name=body.product_name,
            product_desc=body.product_desc,
            competitor_summary=body.competitor_summary,
            n_main=body.n_main,
            n_detail=body.n_detail,
            strategy=body.strategy,
            custom_template=body.custom_template,
            user_requirements=body.user_requirements,
        )

    rows_raw = await _run_blocking(work)
    rows: list[PlanSlotsRow] = []
    for li, (kind, idx, prompt) in enumerate(rows_raw):
        rwi = default_ref_white_index(body.n_white_images, kind, int(idx))
        rows.append(
            PlanSlotsRow(
                list_index=li,
                kind=kind,
                index=idx,
                prompt=prompt,
                ref_white_index=rwi,
            )
        )
    return {"slots": [r.model_dump() for r in rows]}


@app.post("/api/plan/single")
async def api_plan_single(
    api_key: Annotated[str, Depends(resolve_api_key)],
    provider: Annotated[DashScopeProvider, Depends(get_provider)],
    body: PlanSingleBody,
) -> dict[str, str]:

    def work() -> str:
        return provider.plan_single_slot_prompt(
            api_key=api_key,
            product_name=body.product_name,
            product_desc=body.product_desc,
            competitor_summary=body.competitor_summary,
            kind=body.kind,
            index=body.index,
            strategy=body.strategy,
            old_prompt=body.old_prompt,
        )

    text = await _run_blocking(work)
    return {"prompt": text}


@app.post("/api/jobs", response_model=JobStatusOut)
async def api_create_job(
    db: Annotated[Session, Depends(get_db)],
    x_dashscope_key: Annotated[str | None, Header(alias="X-DashScope-Key")] = None,
    x_ark_key: Annotated[str | None, Header(alias="X-Ark-Key")] = None,
    authorization: Annotated[str | None, Header()] = None,
    whites: list[UploadFile] = File(...),
    job: str = Form(...),
) -> JobStatusOut:
    if not whites:
        raise HTTPException(400, "请至少上传一张白底商品图")
    try:
        body = CreateJobBody.model_validate(json.loads(job))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(400, f"job 字段 JSON 无效: {e}") from e

    dashscope_key = get_dashscope_api_key_optional(
        db=db, x_dashscope_key=x_dashscope_key, authorization=authorization
    )
    ark_key = get_ark_api_key_optional(db=db, x_ark_key=x_ark_key)
    if body.strategy == "doubao_seedream_5":
        if not ark_key:
            raise HTTPException(
                401,
                "缺少 ARK API Key：请在前端保存即梦 Key，或通过请求头 X-Ark-Key / 环境变量 ARK_API_KEY 提供。",
            )
    elif not dashscope_key:
        raise HTTPException(
            401,
            "缺少 DashScope API Key：请在前端保存阿里百炼 Key，或通过请求头 X-DashScope-Key / Authorization 提供。",
        )

    tmp_paths: list[Path] = []
    try:
        for uf in whites:
            data = await uf.read()
            if len(data) > 40 * 1024 * 1024:
                raise HTTPException(413, "单张白底图过大")
            suf = Path(uf.filename or "w.png").suffix or ".png"
            tmp_paths.append(_write_temp_upload(data, suf))

        job_id = start_generate_job(
            dashscope_api_key=dashscope_key,
            ark_api_key=ark_key,
            white_sources=tmp_paths,
            body=body,
        )
    finally:
        for p in tmp_paths:
            _try_unlink(p)

    return JobStatusOut(id=job_id, status="pending", progress=0, total=0)


@app.get("/api/jobs/{job_id}", response_model=JobStatusOut)
def api_get_job(job_id: str) -> JobStatusOut:
    rec = get_job(job_id)
    if rec is None:
        # 开发态热重载会清空内存任务表；给前端返回可读状态，避免 404 打断轮询。
        exp = Path.home() / ".cache" / "OneMix" / "jobs" / job_id / "export"
        if exp.is_dir():
            return JobStatusOut(
                id=job_id,
                status="completed",
                progress=0,
                total=0,
                error=None,
                results=[],
                session_rel="export",
            )
        return JobStatusOut(
            id=job_id,
            status="failed",
            progress=0,
            total=0,
            error="任务状态已丢失（服务可能刚重启）。请重新发起生成任务。",
            results=[],
            session_rel=None,
        )
    results = rec.results
    session_rel = "export" if rec.export_session and rec.export_session.is_dir() else None
    return JobStatusOut(
        id=rec.id,
        status=rec.status,  # type: ignore[arg-type]
        progress=rec.progress,
        total=rec.total,
        error=rec.error,
        results=results,
        session_rel=session_rel,
    )


@app.get("/api/jobs/{job_id}/bundle")
def api_job_bundle(job_id: str) -> StreamingResponse:
    rec = get_job(job_id)
    exp = rec.work_dir / "export" if rec is not None else (Path.home() / ".cache" / "OneMix" / "jobs" / job_id / "export")
    if not exp.is_dir():
        raise HTTPException(400, "导出目录不存在")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(exp.rglob("*")):
            if p.is_file():
                arc = p.relative_to(exp).as_posix()
                zf.write(p, arcname=arc)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="onemix_{job_id}.zip"'},
    )


@app.get("/api/jobs/{job_id}/result/{list_index}")
def api_job_result_preview(job_id: str, list_index: int) -> FileResponse:
    rec = get_job(job_id)
    if rec is None:
        # 服务重启后内存结果丢失，退化为按目录与命名规则查找。
        exp = Path.home() / ".cache" / "OneMix" / "jobs" / job_id / "export"
        if not exp.is_dir():
            raise HTTPException(404, "任务不存在")
        candidates = sorted(exp.rglob("*.jpg")) + sorted(exp.rglob("*.jpeg")) + sorted(exp.rglob("*.png"))
        if list_index < 0 or list_index >= len(candidates):
            raise HTTPException(404, "槽位结果不存在")
        p = candidates[list_index]
        return FileResponse(path=str(p))
    if not rec.results:
        raise HTTPException(404, "任务结果不存在")

    target = next((x for x in rec.results if int(x.get("list_index", -1)) == list_index), None)
    if not target:
        raise HTTPException(404, "槽位结果不存在")

    p = Path(str(target.get("export_path", ""))).expanduser().resolve()
    if not p.is_file():
        raise HTTPException(404, "结果文件不存在")
    return FileResponse(path=str(p))
