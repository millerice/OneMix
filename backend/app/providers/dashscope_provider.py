from __future__ import annotations

from pathlib import Path

from app._ensure_onemix_path import ensure as _ensure_onemix_path

_ensure_onemix_path()

from onemix.services import dashscope_svc


class DashScopeProvider:
    """DashScope 默认实现，委托给 onemix.services.dashscope_svc。"""

    def ocr_from_image(self, *, api_key: str, image_path: Path) -> str:
        return dashscope_svc.ocr_from_image(api_key=api_key, image_path=image_path)

    def competitor_to_prompt(self, *, api_key: str, image_paths: list[Path]) -> str:
        return dashscope_svc.competitor_to_prompt(api_key=api_key, image_paths=image_paths)

    def plan_background_prompts_for_slots(
        self,
        *,
        api_key: str,
        product_name: str,
        product_desc: str,
        competitor_summary: str,
        n_main: int,
        n_detail: int,
        strategy: str,
        custom_template: str = "",
        user_requirements: str = "",
        ref_image_paths: list[Path] | None = None,
    ) -> list[tuple[str, int, str]]:
        return dashscope_svc.plan_background_prompts_for_slots(
            api_key=api_key,
            product_name=product_name,
            product_desc=product_desc,
            competitor_summary=competitor_summary,
            n_main=n_main,
            n_detail=n_detail,
            strategy=strategy,
            custom_template=custom_template,
            user_requirements=user_requirements,
            ref_image_paths=ref_image_paths,
        )

    def plan_single_slot_prompt(
        self,
        *,
        api_key: str,
        product_name: str,
        product_desc: str,
        competitor_summary: str,
        kind: str,
        index: int,
        strategy: str,
        old_prompt: str,
        ref_image_paths: list[Path] | None = None,
        primary_ref_index: int | None = None,
    ) -> str:
        return dashscope_svc.plan_single_slot_prompt(
            api_key=api_key,
            product_name=product_name,
            product_desc=product_desc,
            competitor_summary=competitor_summary,
            kind=kind,
            index=index,
            strategy=strategy,
            old_prompt=old_prompt,
            ref_image_paths=ref_image_paths,
            primary_ref_index=primary_ref_index,
        )
