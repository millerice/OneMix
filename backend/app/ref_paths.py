from __future__ import annotations

from pathlib import Path

from app.schemas import SlotJobIn


def default_ref_path_for_slot(ref_whites: list[Path], kind: str, index: int) -> Path:
    if not ref_whites:
        raise ValueError("缺少白底商品图")
    return ref_whites[(max(1, index) - 1) % len(ref_whites)]


def materialize_slot_jobs(jobs_in: list[SlotJobIn], ref_whites: list[Path]) -> list[dict]:
    """将 API 槽位列表转为 slot_batch_gen 所需的 dict（含绝对路径 ref_image_path）。"""
    out: list[dict] = []
    for j in jobs_in:
        d = j.model_dump()
        ridx = d.get("ref_white_index")
        if ridx is not None:
            wi = int(ridx) % len(ref_whites)
            d["ref_image_path"] = str(ref_whites[wi].resolve())
        elif not (d.get("ref_image_path") or "").strip():
            p = default_ref_path_for_slot(ref_whites, d["kind"], int(d["index"]))
            d["ref_image_path"] = str(p.resolve())
        out.append(d)
    return out


def default_ref_white_index(n_whites: int, kind: str, index: int) -> int:
    """与桌面版 _default_ref_for_slot 一致的「白底图下标」。"""
    if n_whites <= 0:
        return 0
    return (max(1, index) - 1) % n_whites


def count_generation_steps(
    slot_jobs: list[dict],
    only_indices: set[int] | None,
    skip_done: bool,
) -> int:
    n = 0
    for job in slot_jobs:
        li = job["list_index"]
        if only_indices is not None and li not in only_indices:
            continue
        if skip_done and job.get("export_path"):
            continue
        n += 1
    return n
