"""槽位批量生图核心逻辑（供 Web API 异步任务调用）。"""

from __future__ import annotations

import tempfile
import logging
from pathlib import Path
from typing import Callable, Optional

from onemix.services import dashscope_svc

logger = logging.getLogger(__name__)


def run_slot_batch_gen(
    *,
    dashscope_api_key: str | None,
    ark_api_key: str | None,
    ref_whites: list[Path],
    export_session: Path,
    slot_jobs: list[dict],
    fmt: str = "JPG",
    strategy: str,
    only_indices: Optional[list[int]] = None,
    skip_done: bool = True,
    progress_cb: Optional[Callable[[int], None]] = None,
) -> list[dict]:
    """
    执行批量槽位生图，返回 [{"list_index": int, "export_path": str}, ...]。
    progress_cb 可选，签名为 (done_count: int) -> None。
    详情图按模型 size 原样导出 JPG，不做 750 规格后处理。
    """
    if not ref_whites:
        raise RuntimeError("缺少白底商品图，无法出图。")

    _ = fmt  # 保留参数兼容；当前主图/详情均导出 JPG

    main_dir = export_session / "主图"
    det_dir = export_session / "详情"
    main_dir.mkdir(parents=True, exist_ok=True)
    det_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    done = 0
    only_set = set(only_indices) if only_indices is not None else None

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        base_urls: dict[str, str] = {}
        ref_urls: dict[str, str] = {}
        custom_ref_urls: dict[str, str] = {}
        custom_base_urls: dict[str, str] = {}
        if strategy in ("background_v2", "mixed_auto"):
            if not dashscope_api_key:
                raise RuntimeError("当前策略需要 DashScope API Key")
            for wi, wp in enumerate(ref_whites, start=1):
                rgba_path = td_path / f"base_rgba_{wi:02d}.png"
                dashscope_svc.rgba_base_from_white_product_image(wp, rgba_path)
                base_urls[str(wp)] = dashscope_svc.upload_local_image_for_background(
                    api_key=dashscope_api_key, local_path=rgba_path
                )
                ref_urls[str(wp)] = dashscope_svc.upload_local_image_for_background(
                    api_key=dashscope_api_key, local_path=wp
                )

        for job in slot_jobs:
            li = job["list_index"]
            if only_set is not None and li not in only_set:
                continue
            if skip_done and job.get("export_path"):
                continue
            kind = job["kind"]
            idx = job["index"]
            prompt = job["prompt"]
            slot_ref_path = str(job.get("ref_image_path") or "").strip()
            slot_resolution = str(job.get("resolution") or "2K").strip() or "2K"
            # 详情默认竖图 9:16；主图默认 1:1
            default_aspect = "9:16" if kind == "detail" else "1:1"
            slot_aspect = str(job.get("aspect_ratio") or default_aspect).strip() or default_aspect
            model_size = dashscope_svc.resolve_generation_size_for_strategy(
                strategy,
                resolution=slot_resolution,
                aspect_ratio=slot_aspect,
            )
            # mixed_auto 下按 kind 切换策略时，重新解析 size
            eff_strategy = strategy
            if strategy == "mixed_auto":
                eff_strategy = "t2i_turbo" if kind == "main" else "background_v2"
                model_size = dashscope_svc.resolve_generation_size_for_strategy(
                    eff_strategy,
                    resolution=slot_resolution,
                    aspect_ratio=slot_aspect,
                )
            if eff_strategy == "background_v2":
                if slot_ref_path:
                    p = Path(slot_ref_path)
                    use_white = p.resolve() if p.is_file() else ref_whites[(idx - 1) % len(ref_whites)]
                else:
                    use_white = ref_whites[(idx - 1) % len(ref_whites)]

                use_white_key = str(use_white)
                use_base_url = base_urls.get(use_white_key)
                if not use_base_url:
                    if use_white_key not in custom_base_urls:
                        rgba_custom = td_path / f"base_rgba_custom_{li:03d}.png"
                        dashscope_svc.rgba_base_from_white_product_image(use_white, rgba_custom)
                        custom_base_urls[use_white_key] = dashscope_svc.upload_local_image_for_background(
                            api_key=dashscope_api_key or "", local_path=rgba_custom
                        )
                    use_base_url = custom_base_urls.get(use_white_key)
                if not use_base_url:
                    raise RuntimeError("背景融合策略缺少主体图 URL")
                model_prompt = dashscope_svc.prompt_for_image_model(
                    api_key=dashscope_api_key or "",
                    prompt=prompt,
                    target_model=dashscope_svc.BG_GENERATION_MODEL,
                    auto_translate=True,
                )
                model_prompt = dashscope_svc.optimize_ref_prompt_for_bg_v3(model_prompt)
                # 默认不传 ref_image_url，避免与 base_image_url 指向同一白底图时过度保守，
                # 导致模型更倾向返回接近原图的结果。
                ref_img_url = None
                if slot_ref_path:
                    p = Path(slot_ref_path)
                    if p.is_file():
                        k = str(p.resolve())
                        # 仅当参考图与主体白底图不是同一张时，才传 ref_image_url。
                        if k != use_white_key and k in ref_urls:
                            ref_img_url = ref_urls[k]
                        else:
                            if k != use_white_key and k not in custom_ref_urls:
                                custom_ref_urls[k] = dashscope_svc.upload_local_image_for_background(
                                    api_key=dashscope_api_key or "", local_path=p
                                )
                            if k != use_white_key:
                                ref_img_url = custom_ref_urls.get(k) or ref_img_url
                try:
                    url = dashscope_svc.background_generation_v2_first_url(
                        api_key=dashscope_api_key or "",
                        base_image_url=use_base_url,
                        ref_image_url=ref_img_url,
                        ref_prompt=model_prompt,
                        neg_ref_prompt="低质量，模糊，重影，畸变，商品变形，比例错误，错位文字，水印",
                        ref_prompt_weight=0.8,
                        model_version="v3",
                        timeout_sec=3600,
                    )
                except RuntimeError as e:
                    # 背景融合任务超时时，回退到文生图，避免整批任务失败。
                    if "背景生成任务超时" not in str(e):
                        raise
                    logger.warning(
                        "background_v2 timeout, fallback to t2i_turbo: kind=%s idx=%s list_index=%s",
                        kind,
                        idx,
                        li,
                    )
                    fallback_prompt = dashscope_svc.prompt_for_image_model(
                        api_key=dashscope_api_key or "",
                        prompt=prompt,
                        target_model=dashscope_svc.T2I_MODEL_DEFAULT,
                        auto_translate=True,
                    )
                    url = dashscope_svc.text_to_image_first_url(
                        api_key=dashscope_api_key or "",
                        prompt=fallback_prompt,
                        size=model_size,
                    )
            elif eff_strategy == "t2i_turbo":
                if not dashscope_api_key:
                    raise RuntimeError("当前策略需要 DashScope API Key")
                model_prompt = dashscope_svc.prompt_for_image_model(
                    api_key=dashscope_api_key,
                    prompt=prompt,
                    target_model=dashscope_svc.T2I_MODEL_DEFAULT,
                    auto_translate=True,
                )
                url = dashscope_svc.text_to_image_first_url(
                    api_key=dashscope_api_key,
                    prompt=model_prompt,
                    size=model_size,
                )
            elif dashscope_svc.is_doubao_strategy(eff_strategy):
                if not ark_api_key:
                    raise RuntimeError("当前策略需要 ARK API Key")
                if slot_ref_path:
                    p = Path(slot_ref_path)
                    use_white = p.resolve() if p.is_file() else ref_whites[(idx - 1) % len(ref_whites)]
                else:
                    use_white = ref_whites[(idx - 1) % len(ref_whites)]
                image_data_url = dashscope_svc.local_image_to_data_url(use_white)
                url = dashscope_svc.doubao_seedream_generate_first_url(
                    api_key=ark_api_key,
                    prompt=prompt,
                    image=image_data_url,
                    model=dashscope_svc.resolve_doubao_model(eff_strategy),
                    size=model_size,
                )
            elif dashscope_svc.is_qwen_image_strategy(eff_strategy):
                if not dashscope_api_key:
                    raise RuntimeError("当前策略需要 DashScope API Key")
                if slot_ref_path:
                    p = Path(slot_ref_path)
                    use_white = p.resolve() if p.is_file() else ref_whites[(idx - 1) % len(ref_whites)]
                else:
                    use_white = ref_whites[(idx - 1) % len(ref_whites)]
                url = dashscope_svc.qwen_family_generate_first_url(
                    api_key=dashscope_api_key,
                    strategy=eff_strategy,
                    prompt=prompt,
                    image_path=use_white,
                    size=model_size,
                )
            else:
                raise RuntimeError(f"未知生成策略: {eff_strategy}")
            raw = td_path / f"raw_{kind}_{idx}.png"
            if kind == "main":
                out = main_dir / f"main_{idx:02d}.jpg"
                dashscope_svc.download_image(url, raw)
                dashscope_svc.postprocess_main_image(
                    raw,
                    out,
                    is_white_slot=False,
                )
                results.append({"list_index": li, "export_path": str(out)})
            else:
                out = det_dir / f"detail_{idx:02d}.jpg"
                dashscope_svc.download_image(url, raw)
                dashscope_svc.export_image_as_jpg(raw, out)
                results.append({"list_index": li, "export_path": str(out)})
            done += 1
            if progress_cb:
                progress_cb(done)

    return results
