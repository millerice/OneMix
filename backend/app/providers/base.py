from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class ModelProvider(Protocol):
    """第三方模型能力抽象；默认实现为 DashScope。"""

    def ocr_from_image(self, *, api_key: str, image_path: Path) -> str: ...

    def competitor_to_prompt(self, *, api_key: str, image_paths: list[Path]) -> str: ...

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
    ) -> list[tuple[str, int, str]]: ...

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
    ) -> str: ...
