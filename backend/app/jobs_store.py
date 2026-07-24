from __future__ import annotations

import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from app._ensure_onemix_path import ensure as _ensure_onemix_path

_ensure_onemix_path()

from onemix.services.slot_batch_gen import run_slot_batch_gen

from app.ref_paths import count_generation_steps, materialize_slot_jobs
from app.schemas import CreateJobBody


class JobRecord:
    def __init__(self, job_id: str, work_dir: Path) -> None:
        self.id = job_id
        self.work_dir = work_dir
        self.status: str = "pending"
        self.progress: int = 0
        self.total: int = 0
        self.error: Optional[str] = None
        self.results: Optional[list[dict]] = None
        self.export_session: Optional[Path] = None


_lock = threading.Lock()
_jobs: dict[str, JobRecord] = {}
_executor: Optional[ThreadPoolExecutor] = None


def get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="onemix_job")
    return _executor


def create_job_record() -> JobRecord:
    job_id = uuid.uuid4().hex
    work = Path.home() / ".cache" / "OneMix" / "jobs" / job_id
    work.mkdir(parents=True, exist_ok=True)
    rec = JobRecord(job_id, work)
    with _lock:
        _jobs[job_id] = rec
    return rec


def get_job(job_id: str) -> Optional[JobRecord]:
    with _lock:
        return _jobs.get(job_id)


def _run_job_sync(
    dashscope_api_key: str | None,
    ark_api_key: str | None,
    job_id: str,
    white_paths: list[Path],
    body: CreateJobBody,
) -> None:
    rec = get_job(job_id)
    if rec is None:
        return
    export_session = rec.work_dir / "export"
    export_session.mkdir(parents=True, exist_ok=True)
    materialized = materialize_slot_jobs(list(body.slot_jobs), white_paths)
    only = set(body.only_indices) if body.only_indices is not None else None
    rec.total = count_generation_steps(materialized, only, body.skip_done)
    if rec.total == 0:
        rec.status = "completed"
        rec.results = []
        rec.export_session = export_session
        return
    rec.status = "running"
    rec.export_session = export_session

    def prog(n: int) -> None:
        r = get_job(job_id)
        if r:
            r.progress = n

    try:
        results = run_slot_batch_gen(
            dashscope_api_key=dashscope_api_key,
            ark_api_key=ark_api_key,
            ref_whites=white_paths,
            export_session=export_session,
            slot_jobs=materialized,
            fmt=body.fmt,
            strategy=body.strategy,
            only_indices=body.only_indices,
            skip_done=body.skip_done,
            progress_cb=prog,
        )
        rec.results = results
        rec.status = "completed"
        rec.progress = rec.total
    except Exception as e:  # noqa: BLE001
        rec.status = "failed"
        rec.error = str(e)


def start_generate_job(
    *,
    dashscope_api_key: str | None,
    ark_api_key: str | None,
    white_sources: list[Path],
    body: CreateJobBody,
) -> str:
    rec = create_job_record()
    whites_dir = rec.work_dir / "whites"
    whites_dir.mkdir(parents=True, exist_ok=True)
    stable_whites: list[Path] = []
    for i, p in enumerate(white_sources):
        dest = whites_dir / f"white_{i:02d}{p.suffix or '.png'}"
        shutil.copy2(p, dest)
        stable_whites.append(dest)

    body_copy = body.model_copy(deep=True)

    def task() -> None:
        _run_job_sync(dashscope_api_key, ark_api_key, rec.id, stable_whites, body_copy)

    get_executor().submit(task)
    return rec.id


def delete_job_disk(job_id: str) -> None:
    rec = get_job(job_id)
    if rec and rec.work_dir.is_dir():
        shutil.rmtree(rec.work_dir, ignore_errors=True)
    with _lock:
        _jobs.pop(job_id, None)
