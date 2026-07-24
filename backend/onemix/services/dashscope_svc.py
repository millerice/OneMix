"""DashScope 调用封装：多模态（OCR/竞品）、文本规划、万相背景生成 HTTP API。"""

from __future__ import annotations

import json
import re
import time
import io
import logging
import base64
import mimetypes
from pathlib import Path
from typing import Any, Optional

import dashscope
import requests
from dashscope import Generation, ImageSynthesis, MultiModalConversation
from dashscope.aigc.image_generation import ImageGeneration
from dashscope.api_entities.dashscope_response import Message
from dashscope.utils.oss_utils import OssUtils
from onemix.services import prompt_templates as prompts

VL_MODEL_DEFAULT = "qwen-vl-plus"
# 关键信息提取：轻量快模型
EXTRACT_TEXT_MODEL = "qwen-flash"
# 纯文本改写/翻译仍用 qwen-max；提示词规划改为 VL，可结合参考图
PLANNER_TEXT_MODEL = "qwen-max"
PLANNER_VL_MODEL = VL_MODEL_DEFAULT
# 规划时最多送入 VL 的白底参考图张数（控制成本与上下文）
PLANNER_MAX_REF_IMAGES = 8
# 万相-图像背景生成（需 RGBA 主体图 + HTTP 异步任务）
BG_GENERATION_MODEL = "wanx-background-generation-v2"
T2I_MODEL_DEFAULT = "wanx2.1-t2i-turbo"
DOUBAO_SEEDREAM_MODEL = "doubao-seedream-5-0-260128"
DOUBAO_SEEDREAM_MODELS: dict[str, str] = {
    # 历史别名 → 5.0 lite
    "doubao_seedream_5": "doubao-seedream-5-0-260128",
    "doubao_seedream_5_lite": "doubao-seedream-5-0-260128",
    "doubao_seedream_5_pro": "doubao-seedream-5-0-pro-260628",
    "doubao_seedream_4_5": "doubao-seedream-4-5-251128",
    "doubao_seedream_4_0": "doubao-seedream-4-0-250828",
}
QWEN_IMAGE_MODELS: dict[str, str] = {
    "qwen_image_2_0_pro": "qwen-image-2.0-pro",
    "qwen_image_2_0_pro_2026_06_22": "qwen-image-2.0-pro-2026-06-22",
    "qwen_image_2_0": "qwen-image-2.0",
    # 历史策略（前端已下线，保留后端兼容）
    "qwen_z_image_turbo": "z-image-turbo",
    "qwen_wan27_image_pro": "wan2.7-image-pro",
}
ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
BG_CREATE_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/background-generation/generation/"
)
BG_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
CN_STRONG_IMAGE_MODELS = {BG_GENERATION_MODEL, T2I_MODEL_DEFAULT}
logger = logging.getLogger(__name__)


def seedream_supports_image_to_image(model_id: str) -> bool:
    """是否支持图生图（image 参考图）。纯 T2I / Seedream 3.x 等排除。"""
    mid = (model_id or "").lower()
    if "seedream" not in mid:
        return False
    if "-t2i" in mid or "_t2i" in mid or ".t2i" in mid:
        return False
    if "seedream-3" in mid or "seedream_3" in mid:
        return False
    return (
        "seedream-4" in mid
        or "seedream_4" in mid
        or "seedream-5" in mid
        or "seedream_5" in mid
    )


def qwen_family_supports_image_to_image(model_id: str) -> bool:
    """千问/万相侧是否支持图生图或图像编辑入参。"""
    mid = (model_id or "").lower()
    if mid.startswith("qwen-image"):
        return True
    if mid.startswith("wan") and "t2i" not in mid:
        return True
    return False


def is_doubao_strategy(strategy: str) -> bool:
    if strategy in DOUBAO_SEEDREAM_MODELS:
        return True
    # 同步自 ARK /models 的动态策略：ark:<model_id>（仅图生图）
    if strategy.startswith("ark:"):
        mid = strategy[4:].strip()
        return seedream_supports_image_to_image(mid)
    return False


def is_qwen_image_strategy(strategy: str) -> bool:
    if strategy in QWEN_IMAGE_MODELS:
        return True
    if strategy.startswith("ds:"):
        mid = strategy[3:].strip()
        return qwen_family_supports_image_to_image(mid)
    return False


def resolve_doubao_model(strategy: str) -> str:
    if strategy.startswith("ark:"):
        mid = strategy[4:].strip()
        if not mid:
            raise RuntimeError("动态豆包策略缺少 model id")
        return mid
    return DOUBAO_SEEDREAM_MODELS.get(strategy) or DOUBAO_SEEDREAM_MODEL


def resolve_qwen_image_model(strategy: str) -> str:
    if strategy.startswith("ds:"):
        mid = strategy[3:].strip()
        if not mid:
            raise RuntimeError("动态千问策略缺少 model id")
        return mid
    mid = QWEN_IMAGE_MODELS.get(strategy)
    if not mid:
        raise RuntimeError(f"未知千问生图策略: {strategy}")
    return mid


def strategy_requires_ark(strategy: str) -> bool:
    return is_doubao_strategy(strategy)


def strategy_requires_dashscope_for_gen(strategy: str) -> bool:
    """生图阶段是否需要 DashScope Key（规划阶段通常仍需要）。"""
    return strategy in ("background_v2", "mixed_auto", "t2i_turbo") or is_qwen_image_strategy(
        strategy
    )


# model_id → 精选策略值（不含历史别名，避免一对多冲突）
_DOUBAO_MODEL_TO_STRATEGY: dict[str, str] = {
    "doubao-seedream-5-0-260128": "doubao_seedream_5_lite",
    "doubao-seedream-5-0-pro-260628": "doubao_seedream_5_pro",
    "doubao-seedream-4-5-251128": "doubao_seedream_4_5",
    "doubao-seedream-4-0-250828": "doubao_seedream_4_0",
}

_DOUBAO_STRATEGY_LABELS: dict[str, str] = {
    "doubao_seedream_5_lite": "Doubao Seedream 5.0 lite",
    "doubao_seedream_5_pro": "Doubao Seedream 5.0 pro",
    "doubao_seedream_4_5": "Doubao Seedream 4.5",
    "doubao_seedream_4_0": "Doubao Seedream 4.0",
}


def _seedream_display_label(model_id: str, strategy: str) -> str:
    if strategy in _DOUBAO_STRATEGY_LABELS:
        return _DOUBAO_STRATEGY_LABELS[strategy]
    s = model_id
    if s.startswith("doubao-"):
        s = s[len("doubao-") :]
    parts = s.split("-")
    if parts and parts[-1].isdigit() and len(parts[-1]) >= 6:
        parts = parts[:-1]
    merged: list[str] = []
    i = 0
    while i < len(parts):
        # 5-0 → 5.0
        if (
            i + 1 < len(parts)
            and parts[i].isdigit()
            and parts[i + 1].isdigit()
            and len(parts[i]) <= 2
            and len(parts[i + 1]) <= 2
        ):
            merged.append(f"{parts[i]}.{parts[i + 1]}")
            i += 2
            continue
        p = parts[i]
        if p.lower() in ("pro", "lite"):
            merged.append(p.lower())
        elif p.isdigit():
            merged.append(p)
        else:
            merged.append(p.capitalize())
        i += 1
    label = " ".join(merged).strip()
    return f"Doubao {label}" if label else model_id


def _ark_error_code(resp_text: str, status_code: int) -> str:
    try:
        j = json.loads(resp_text or "{}")
        err = j.get("error") if isinstance(j, dict) else None
        if isinstance(err, dict):
            return str(err.get("code") or "").strip()
    except Exception:
        pass
    if "ModelNotOpen" in (resp_text or ""):
        return "ModelNotOpen"
    return ""


def _ark_seedream_inference_open(*, api_key: str, model_id: str) -> bool | None:
    """
    用不合法 size 探测模型是否已开通推理，避免真实出图计费。

    Returns:
        True  — 已开通（请求到达参数校验）
        False — 未开通（ModelNotOpen 等）
        None  — 无法判断（鉴权失败、网络错误等）
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload: dict[str, Any] = {
        "model": model_id,
        "prompt": "probe",
        # 故意非法，期望 InvalidParameter；若未开通会先返回 ModelNotOpen
        "size": "__onemix_probe__",
        "response_format": "url",
        "stream": False,
        "watermark": True,
    }
    try:
        r = requests.post(
            f"{ARK_BASE_URL}/images/generations",
            headers=headers,
            data=json.dumps(payload),
            timeout=20,
        )
    except requests.RequestException as e:
        logger.warning("ARK probe network error model=%s: %s", model_id, e)
        return None

    code = _ark_error_code(r.text, r.status_code)
    text = r.text or ""
    if (
        code == "ModelNotOpen"
        or "ModelNotOpen" in text
        or "has not activated the model" in text
    ):
        return False
    if r.status_code == 200:
        return True
    if code in ("InvalidParameter", "MissingParameter", "InvalidArgument"):
        return True
    if r.status_code == 400:
        # 其它 400 通常也说明请求已打到模型侧参数校验
        return True
    if r.status_code in (401, 403):
        return None
    if r.status_code == 404:
        return False
    logger.info(
        "ARK probe inconclusive model=%s status=%s code=%s body=%s",
        model_id,
        r.status_code,
        code,
        text[:200],
    )
    return None


def list_ark_seedream_models(*, api_key: str) -> list[dict[str, Any]]:
    """
    列出 Seedream 候选并探测真实开通状态。

    1) GET /api/v3/models 过滤 seedream
    2) 并入精选目录 model id
    3) 对每个 id 做免出图开通探测（并行）

    返回 [{strategy, label, model_id, owned, status}]
    status: open | closed | unknown
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    r = requests.get(f"{ARK_BASE_URL}/models", headers=headers, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"拉取 ARK 模型列表失败: HTTP {r.status_code} {r.text[:500]}")
    j = r.json()
    raw = j.get("data") if isinstance(j, dict) else None
    if not isinstance(raw, list):
        raise RuntimeError(f"ARK 模型列表格式异常: {j}")

    listed: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        mid = str(item.get("id") or "").strip()
        if not mid or not seedream_supports_image_to_image(mid):
            continue
        if mid in seen:
            continue
        seen.add(mid)
        listed.append(mid)

    # 精选目录优先，再追加列表中的其它 Seedream
    ordered: list[str] = []
    for mid in _DOUBAO_MODEL_TO_STRATEGY:
        if mid not in ordered:
            ordered.append(mid)
    for mid in listed:
        if mid not in ordered:
            ordered.append(mid)

    opened_map: dict[str, bool | None] = {}
    workers = min(6, max(1, len(ordered)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {
            pool.submit(_ark_seedream_inference_open, api_key=api_key, model_id=mid): mid
            for mid in ordered
        }
        for fut in as_completed(futs):
            mid = futs[fut]
            try:
                opened_map[mid] = fut.result()
            except Exception as e:
                logger.warning("ARK probe failed model=%s: %s", mid, e)
                opened_map[mid] = None

    out: list[dict[str, Any]] = []
    for mid in ordered:
        opened = opened_map.get(mid)
        if opened is True:
            status, owned = "open", True
        elif opened is False:
            status, owned = "closed", False
        else:
            status, owned = "unknown", False
        strategy = _DOUBAO_MODEL_TO_STRATEGY.get(mid) or f"ark:{mid}"
        out.append(
            {
                "strategy": strategy,
                "label": _seedream_display_label(mid, strategy),
                "model_id": mid,
                "owned": owned,
                "status": status,
            }
        )

    rank = {s: i for i, s in enumerate(_DOUBAO_STRATEGY_LABELS)}
    out.sort(key=lambda x: (rank.get(x["strategy"], 1000), x["model_id"]))
    return out


# model_id → 精选策略值（前端千问目录）
_QWEN_MODEL_TO_STRATEGY: dict[str, str] = {
    "qwen-image-2.0-pro": "qwen_image_2_0_pro",
    "qwen-image-2.0-pro-2026-06-22": "qwen_image_2_0_pro_2026_06_22",
    "qwen-image-2.0": "qwen_image_2_0",
}

_QWEN_STRATEGY_LABELS: dict[str, str] = {
    "qwen_image_2_0_pro": "qwen-image-2.0-pro",
    "qwen_image_2_0_pro_2026_06_22": "qwen-image-2.0-pro-2026-06-22",
    "qwen_image_2_0": "qwen-image-2.0",
}


def _qwen_image_display_label(model_id: str, strategy: str) -> str:
    if strategy in _QWEN_STRATEGY_LABELS:
        return _QWEN_STRATEGY_LABELS[strategy]
    return model_id


def _extract_dashscope_model_name(item: Any) -> str:
    if isinstance(item, str):
        return item.strip()
    if not isinstance(item, dict):
        return ""
    for key in ("model", "name", "id", "model_name"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _dashscope_models_page(*, api_key: str, page_no: int, page_size: int) -> tuple[list[Any], int | None]:
    """调用 DashScope GET /api/v1/models 分页。返回 (items, total_or_None)。"""
    from dashscope.models import Models

    # Models.list 形参名为 page（不是 page_no）；若传 page_no= 会落入 **kwargs，
    # 再经 super().list(page, page_size, page_no=...) 触发「page_no 重复传参」。
    resp = Models.list(page=page_no, page_size=page_size, api_key=api_key)
    status = getattr(resp, "status_code", None)
    if status != 200:
        raise RuntimeError(
            getattr(resp, "message", None) or f"拉取百炼模型列表失败: status={status}"
        )
    out = getattr(resp, "output", None)
    if out is None:
        return [], 0
    if isinstance(out, dict):
        items = out.get("models") or out.get("data") or []
        total = out.get("total")
        if not isinstance(items, list):
            items = []
        return items, int(total) if isinstance(total, int) else None
    if isinstance(out, list):
        return out, None
    return [], 0


def _dashscope_model_exists(*, api_key: str, model_id: str) -> bool:
    """用 Models.get 探测账号是否可见该模型。"""
    from dashscope.models import Models

    try:
        resp = Models.get(name=model_id, api_key=api_key)
    except Exception:
        return False
    status = getattr(resp, "status_code", None)
    return status == 200 and getattr(resp, "output", None) is not None


def list_dashscope_qwen_image_models(*, api_key: str) -> list[dict[str, Any]]:
    """
    通过百炼 Models.list（并补充 Models.get 探测精选项）同步 Qwen-Image 系列。
    返回 [{strategy, label, model_id, owned}]。
    """
    seen: set[str] = set()
    out: list[dict[str, Any]] = []

    def _add(mid: str) -> None:
        mid = (mid or "").strip()
        if not mid or not qwen_family_supports_image_to_image(mid):
            return
        if mid in seen:
            return
        seen.add(mid)
        strategy = _QWEN_MODEL_TO_STRATEGY.get(mid) or f"ds:{mid}"
        out.append(
            {
                "strategy": strategy,
                "label": _qwen_image_display_label(mid, strategy),
                "model_id": mid,
                "owned": True,
            }
        )

    page_no = 1
    page_size = 100
    while page_no <= 20:
        items, total = _dashscope_models_page(
            api_key=api_key, page_no=page_no, page_size=page_size
        )
        if not items:
            break
        for item in items:
            _add(_extract_dashscope_model_name(item))
        if total is not None and page_no * page_size >= total:
            break
        if len(items) < page_size:
            break
        page_no += 1

    # 列表接口未必覆盖全部图像模型：对精选目录再做 get 探测
    for mid in _QWEN_MODEL_TO_STRATEGY:
        if mid in seen:
            continue
        if _dashscope_model_exists(api_key=api_key, model_id=mid):
            _add(mid)

    rank = {s: i for i, s in enumerate(_QWEN_STRATEGY_LABELS)}
    out.sort(key=lambda x: (rank.get(x["strategy"], 1000), x["model_id"]))
    return out


TAOBAO_MAIN_RECOMMENDED = (1440, 1440)
TAOBAO_MAIN_MIN = (800, 800)


def _set_key(api_key: Optional[str]) -> None:
    if api_key:
        dashscope.api_key = api_key


def _local_image_path_for_multimodal(path: Path) -> str:
    """MultiModalConversation 本地图片：传绝对路径以便 SDK 上传 OSS。"""
    return str(path.resolve())


def multimodal_text(
    *,
    api_key: str,
    image_paths: list[Path],
    user_prompt: str,
    model: str = VL_MODEL_DEFAULT,
) -> str:
    """传入本地图片 + 文本，返回模型文本回复。"""
    _set_key(api_key)
    content: list[dict] = []
    for p in image_paths:
        if not p.is_file():
            raise FileNotFoundError(str(p))
        content.append({"image": _local_image_path_for_multimodal(p)})
    content.append({"text": user_prompt})
    messages = [{"role": "user", "content": content}]
    resp = MultiModalConversation.call(model=model, messages=messages, api_key=api_key)
    if resp.status_code != 200:
        raise RuntimeError(getattr(resp, "message", None) or str(resp))
    out = resp.output
    if not out or not getattr(out, "choices", None):
        raise RuntimeError("模型无有效输出")
    choice0 = out.choices[0]
    msg = choice0.message
    raw = msg.content if msg else None
    if isinstance(raw, list):
        parts = []
        for block in raw:
            if isinstance(block, dict) and "text" in block:
                parts.append(block["text"])
        return "\n".join(parts).strip()
    if isinstance(raw, str):
        return raw.strip()
    return str(raw).strip()


def ocr_from_image(*, api_key: str, image_path: Path) -> str:
    return multimodal_text(
        api_key=api_key,
        image_paths=[image_path],
        user_prompt=prompts.OCR_TEXT_PROMPT,
    )


def competitor_to_prompt(*, api_key: str, image_paths: list[Path]) -> str:
    return multimodal_text(
        api_key=api_key,
        image_paths=image_paths,
        user_prompt=prompts.COMPETITOR_SUMMARY_PROMPT,
    )


def _extract_json_object(raw: str) -> dict[str, Any]:
    txt = (raw or "").strip()
    if not txt:
        raise RuntimeError("模型未返回内容")
    # 直接 JSON
    try:
        obj = json.loads(txt)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    # markdown 代码块
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", txt, flags=re.IGNORECASE)
    if m:
        obj = json.loads(m.group(1))
        if isinstance(obj, dict):
            return obj

    # 回退：首个大括号片段
    s = txt.find("{")
    e = txt.rfind("}")
    if s >= 0 and e > s:
        obj = json.loads(txt[s : e + 1])
        if isinstance(obj, dict):
            return obj
    raise RuntimeError("无法解析关键信息提取 JSON")


def extract_key_info_from_text(*, api_key: str, text: str) -> dict[str, Any]:
    content = (text or "").strip()
    if not content:
        raise RuntimeError("商品文本为空，无法提取关键信息")
    # 过长文本先截断，降低 flash/turbo 延迟与超时风险（约 12k 汉字量级）
    max_chars = 12000
    if len(content) > max_chars:
        content = content[:max_chars] + "\n\n【系统】文本过长，已截断后提取。"
    prompt = prompts.build_key_info_extraction_prompt(content)
    raw = _generation_text(
        api_key=api_key,
        prompt=prompt,
        model=EXTRACT_TEXT_MODEL,
        json_object=True,
    )
    return _extract_json_object(raw)


def _generation_text(
    *,
    api_key: str,
    prompt: str,
    model: str = PLANNER_TEXT_MODEL,
    json_object: bool = False,
) -> str:
    _set_key(api_key)
    if "qwen-max" in (model or "").lower():
        prompt = f"【System Prompt】{prompts.QWEN_MAX_PROMPT_SYSTEM_CONSTRAINT}\n\n{prompt}"

    call_kwargs: dict[str, Any] = {
        "model": model,
        "api_key": api_key,
    }
    if json_object:
        # 结构化提取：messages + json_object，利于 flash/turbo 稳定出 JSON
        call_kwargs["messages"] = [{"role": "user", "content": prompt}]
        call_kwargs["result_format"] = "message"
        call_kwargs["response_format"] = {"type": "json_object"}
    else:
        call_kwargs["prompt"] = prompt

    resp = Generation.call(**call_kwargs)
    if resp.status_code != 200:
        raise RuntimeError(getattr(resp, "message", None) or str(resp))
    out = resp.output
    if not out:
        raise RuntimeError("规划模型无输出")
    if getattr(out, "text", None):
        return str(out.text).strip()
    if getattr(out, "choices", None) and out.choices:
        msg = out.choices[0].message
        c = getattr(msg, "content", None) if msg is not None else None
        if isinstance(c, str):
            return c.strip()
    raise RuntimeError("无法解析规划模型输出")


def _has_chinese(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text or ""))


def prompt_for_image_model(
    *,
    api_key: str,
    prompt: str,
    target_model: str,
    auto_translate: bool = True,
) -> str:
    """
    前端展示可保持中文；真正调用生图模型前按模型能力决定是否转英文。
    - 强中文能力模型：直接返回原提示词。
    - 其它模型：若检测到中文且开启 auto_translate，则用 qwen-max 转为英文短语提示词。
    """
    src = (prompt or "").strip()
    if not src:
        return src
    if not auto_translate:
        return src
    if target_model in CN_STRONG_IMAGE_MODELS:
        return src
    if not _has_chinese(src):
        return src
    translate_prompt = prompts.build_translate_prompt(src)
    out = _generation_text(api_key=api_key, prompt=translate_prompt, model="qwen-max")
    line = (out or "").strip().splitlines()[0].strip()
    return line or src


def plan_background_prompts_for_slots(
    *,
    api_key: str,
    product_name: str,
    product_desc: str,
    competitor_summary: str,
    n_main: int,
    n_detail: int,
    strategy: str = "background_v2",
    custom_template: str = "",
    user_requirements: str = "",
    ref_image_paths: list[Path] | None = None,
) -> list[tuple[str, int, str]]:
    """
    为每张待生成图产出「背景」向 ref_prompt（主体仍以上传主图为依据，勿在文案中替换商品本体）。

    返回 [(kind, index, prompt), ...]，kind 为 'main' 或 'detail'，index 从 1 开始。
    若提供 ref_image_paths，则用 VL（qwen-vl-plus）结合参考图规划；否则回退纯文本 qwen-max。
    """
    strategy_notes = {
        "background_v2": (
            "当前生成策略：背景融合（wanx-background-generation-v2）。\n"
            "主图与详情图都要偏“背景/光影/场景氛围”描述，避免要求改变主体几何形态。"
        ),
        "t2i_turbo": (
            "当前生成策略：多角度想象（wanx2.1-t2i-turbo）。\n"
            "主图需强视角指令（side view / isometric / top view / close-up）；"
            "详情图可保留卖点叙事和场景信息，但整体偏文生图可执行语句。"
        ),
        "mixed_auto": (
            "当前生成策略：混合策略（主图=t2i_turbo，详情=background_v2）。\n"
            "因此 MAIN 行强调多角度视角词与商品结构描述；DETAIL 行强调背景融合友好的环境/氛围词。"
        ),
        "doubao_seedream_5": (
            "当前生成策略：豆包 Seedream 5.0 lite。\n"
            "提示词强调中文可执行描述，关注构图、光影、场景与质感；保持商品主体一致。"
        ),
        "doubao_seedream_5_lite": (
            "当前生成策略：豆包 Seedream 5.0 lite。\n"
            "提示词强调中文可执行描述，关注构图、光影、场景与质感；保持商品主体一致。"
        ),
        "doubao_seedream_5_pro": (
            "当前生成策略：豆包 Seedream 5.0 pro。\n"
            "提示词可更精细（材质、光影、文字排版）；强调主体一致性与电商主图专业感。"
        ),
        "doubao_seedream_4_5": (
            "当前生成策略：豆包 Seedream 4.5。\n"
            "提示词强调细节与复杂场景可读性，保持商品主体一致。"
        ),
        "doubao_seedream_4_0": (
            "当前生成策略：豆包 Seedream 4.0。\n"
            "提示词简洁可执行，关注构图与光影，保持商品主体一致。"
        ),
        "qwen_image_2_0_pro": (
            "当前生成策略：千问 qwen-image-2.0-pro（Pro 稳定版）。\n"
            "强调文字渲染、真实质感与语义遵循；如有文字请写清内容与排版位置。"
        ),
        "qwen_image_2_0_pro_2026_06_22": (
            "当前生成策略：千问 qwen-image-2.0-pro-2026-06-22（Pro 快照）。\n"
            "与 Pro 同系，提示词同样强调文字、质感与主体一致。"
        ),
        "qwen_image_2_0": (
            "当前生成策略：千问 qwen-image-2.0（加速版）。\n"
            "兼顾效果与速度；提示词简洁可执行，保持商品主体一致。"
        ),
        "qwen_z_image_turbo": (
            "当前生成策略：千问 z-image-turbo（速度与性价比）。\n"
            "提示词偏写实人像/产品图，语句短而具体。"
        ),
        "qwen_wan27_image_pro": (
            "当前生成策略：万相 wan2.7-image-pro。\n"
            "可强调五官/色彩/超长文字与高分辨率场景；保持商品主体一致。"
        ),
    }.get(strategy, "当前生成策略：未知，按通用电商出图提示词规划。")

    refs = [p for p in (ref_image_paths or []) if p.is_file()][:PLANNER_MAX_REF_IMAGES]
    prompt = prompts.build_plan_background_prompt(
        product_name=product_name,
        product_desc=product_desc,
        competitor_summary=competitor_summary,
        n_main=n_main,
        n_detail=n_detail,
        strategy_notes=strategy_notes,
        custom_template=custom_template,
        user_requirements=user_requirements,
        ref_image_count=len(refs),
    )
    logger.info(
        "\n[PLAN_PROMPT_BEGIN]\n"
        "strategy=%s n_main=%s n_detail=%s custom_template=%s ref_images=%s model=%s\n"
        "product_name=%s\n"
        "%s\n"
        "[PLAN_PROMPT_END]",
        strategy,
        n_main,
        n_detail,
        bool((custom_template or "").strip()),
        len(refs),
        PLANNER_VL_MODEL if refs else PLANNER_TEXT_MODEL,
        product_name,
        prompt,
    )
    if refs:
        raw = multimodal_text(
            api_key=api_key,
            image_paths=refs,
            user_prompt=prompt,
            model=PLANNER_VL_MODEL,
        )
    else:
        raw = _generation_text(api_key=api_key, prompt=prompt, model=PLANNER_TEXT_MODEL)
    parsed_json = _parse_slot_plan_json(raw, n_main, n_detail)
    if parsed_json is not None:
        return _normalize_slot_prompts_to_chinese(api_key=api_key, rows=parsed_json)
    parsed = _parse_slot_plan_lines(raw, n_main, n_detail)
    if parsed is not None:
        return _normalize_slot_prompts_to_chinese(api_key=api_key, rows=parsed)
    fb = _fallback_slot_prompts(product_name, n_main, n_detail)
    return _normalize_slot_prompts_to_chinese(api_key=api_key, rows=fb)


def _normalize_prompt_len_zh(text: str) -> str:
    """仅清理多余空白，不做长度截断或补齐。"""
    return " ".join((text or "").strip().split())


def _normalize_slot_prompts_to_chinese(
    *, api_key: str, rows: list[tuple[str, int, str]]
) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    for k, i, t in rows:
        out.append((k, i, _normalize_prompt_to_chinese(api_key=api_key, text=t)))
    return out


def _normalize_prompt_to_chinese(*, api_key: str, text: str) -> str:
    src = _normalize_prompt_len_zh(text)
    if not src:
        return src
    rewrite_prompt = f"""请将下面这条电商生图提示词，重写为“全中文、短语化、单行、可直接用于生图”的版本。
要求：
1) 只输出一行中文提示词，不要解释，不要 Markdown。
2) 去掉重复语义，避免中英混写；统一中文表达。
3) 保留关键信息：场景、光影、构图、风格、材质/质感。
4) 若出现英文摄影术语，请改写为等价中文术语。

原提示词：
{src}
"""
    try:
        out = _generation_text(api_key=api_key, prompt=rewrite_prompt, model=PLANNER_TEXT_MODEL)
        line = (out or "").strip().splitlines()[0].strip()
        return _normalize_prompt_len_zh(line or src)
    except Exception:  # noqa: BLE001
        return src


def optimize_ref_prompt_for_bg_v3(text: str) -> str:
    """
    针对 wanx-background-generation-v2(v3) 优化背景提示词：
    - 保持提示词短语化、可执行；
    - 仅清理空白，不做截断。
    """
    return " ".join((text or "").strip().split())


def plan_single_slot_prompt(
    *,
    api_key: str,
    product_name: str,
    product_desc: str,
    competitor_summary: str,
    kind: str,
    index: int,
    strategy: str,
    old_prompt: str = "",
    ref_image_paths: list[Path] | None = None,
    primary_ref_index: int | None = None,
) -> str:
    """重构单张提示词：结合基础描述、参考图与场景想象，返回单行可直接出图提示词。"""
    slot_name = "主图" if kind == "main" else "详情图"
    slot_rule = (
        "主图请重点体现多角度展示与点击吸引力，尽量匹配对应序号策略（1首图、2场景细节、3营销功能、4信任包装、5白底标准）。"
        if kind == "main"
        else "详情图请重点结合基础描述，补充卖点叙事、场景想象与信息层次（海报/卖点/细节/参数/背书）。"
    )
    refs = [p for p in (ref_image_paths or []) if p.is_file()][:PLANNER_MAX_REF_IMAGES]
    primary_label = ""
    if refs:
        pi = 0
        if primary_ref_index is not None and refs:
            pi = int(primary_ref_index) % len(refs)
            # 将主参考图放到列表首位，便于模型优先关注
            if pi > 0:
                refs = [refs[pi], *[r for i, r in enumerate(refs) if i != pi]]
                pi = 0
        primary_label = f"图{pi + 1}"
    prompt = prompts.build_plan_single_prompt(
        index=index,
        slot_name=slot_name,
        product_name=product_name,
        product_desc=product_desc,
        competitor_summary=competitor_summary,
        strategy=strategy,
        old_prompt=old_prompt,
        slot_rule=slot_rule,
        ref_image_count=len(refs),
        primary_ref_label=primary_label,
    )
    if refs:
        out = multimodal_text(
            api_key=api_key,
            image_paths=refs,
            user_prompt=prompt,
            model=PLANNER_VL_MODEL,
        )
    else:
        out = _generation_text(api_key=api_key, prompt=prompt, model=PLANNER_TEXT_MODEL)
    line = (out or "").strip().splitlines()[0].strip()
    line = line or (old_prompt.strip() if old_prompt.strip() else f"{product_name} 电商棚拍，背景简洁，光影干净，主体突出")
    return _normalize_prompt_len_zh(line)


def _parse_slot_plan_lines(
    raw: str, n_main: int, n_detail: int
) -> Optional[list[tuple[str, int, str]]]:
    rows: list[tuple[str, int, str]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            parts = line.split("|", 2)
        if len(parts) < 3:
            continue
        kind = parts[0].strip().upper()
        try:
            idx = int(parts[1].strip())
        except ValueError:
            continue
        text = parts[2].strip()
        if kind not in ("MAIN", "DETAIL") or not text:
            continue
        k = "main" if kind == "MAIN" else "detail"
        rows.append((k, idx, text))
    mains = [(k, i, t) for k, i, t in rows if k == "main"]
    dets = [(k, i, t) for k, i, t in rows if k == "detail"]
    if len(mains) != n_main or len(dets) != n_detail:
        return None
    mains.sort(key=lambda x: x[1])
    dets.sort(key=lambda x: x[1])
    if [i for _, i, _ in mains] != list(range(1, n_main + 1)):
        return None
    if [i for _, i, _ in dets] != list(range(1, n_detail + 1)):
        return None
    return mains + dets


def _parse_slot_plan_json(raw: str, n_main: int, n_detail: int) -> Optional[list[tuple[str, int, str]]]:
    obj = _extract_json_from_text(raw)
    if not isinstance(obj, dict):
        return None

    out: list[tuple[str, int, str]] = []
    if n_main > 0:
        mains = obj.get("主图背景创意方案")
        rows = _extract_rows_from_scheme_list(mains, kind="main")
        if rows is None or len(rows) != n_main:
            return None
        out.extend(rows)

    if n_detail > 0:
        details = obj.get("详情页背景创意方案")
        rows = _extract_rows_from_scheme_list(details, kind="detail")
        if rows is None or len(rows) != n_detail:
            return None
        out.extend(rows)

    if n_main > 0:
        idxs = sorted(i for k, i, _ in out if k == "main")
        if idxs != list(range(1, n_main + 1)):
            return None
    if n_detail > 0:
        idxs = sorted(i for k, i, _ in out if k == "detail")
        if idxs != list(range(1, n_detail + 1)):
            return None
    return out


def _extract_rows_from_scheme_list(items: Any, *, kind: str) -> Optional[list[tuple[str, int, str]]]:
    if not isinstance(items, list):
        return None
    rows: list[tuple[str, int, str]] = []
    for it in items:
        if not isinstance(it, dict):
            return None
        try:
            idx = int(it.get("方案编号"))
        except (TypeError, ValueError):
            return None

        positive = str(it.get("wanx正向提示词") or "").strip()
        if kind == "detail":
            # 详情图：把结构化叙事字段拼入正向提示词，提升“按结构生成”的一致性。
            detail_fields = [
                "创意主题",
                "场景描述",
                "使用情境",
                "情感诉求",
                "视觉叙事",
                "光影氛围",
                "色调氛围",
                "构图细节",
            ]
            extra = [str(it.get(k) or "").strip() for k in detail_fields]
            extra_text = " ".join([x for x in extra if x])
            text = " ".join([x for x in [positive, extra_text] if x]).strip()
        else:
            main_fields = ["创意主题", "背景风格", "核心视觉元素", "色彩策略", "光影策略", "构图逻辑"]
            extra = [str(it.get(k) or "").strip() for k in main_fields]
            extra_text = " ".join([x for x in extra if x])
            text = " ".join([x for x in [positive, extra_text] if x]).strip()

        if not text:
            return None
        rows.append((kind, idx, text))
    rows.sort(key=lambda x: x[1])
    return rows


def _extract_json_from_text(raw: str) -> Any:
    txt = (raw or "").strip()
    if not txt:
        return None
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        pass

    m = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", txt, flags=re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    s = txt.find("{")
    e = txt.rfind("}")
    if s >= 0 and e > s:
        try:
            return json.loads(txt[s : e + 1])
        except json.JSONDecodeError:
            return None
    return None


def _fallback_slot_prompts(
    product_name: str, n_main: int, n_detail: int
) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    main_defaults = [
        f"{product_name} 首图冲击构图，核心卖点前置，背景干净有质感，中心构图，商业质感高清。",
        f"{product_name} 45度侧视场景图，生活化道具点缀，柔和自然光，层次分明，细节清晰。",
        f"{product_name} 功能或赠品展示图，主体与配件整齐陈列，背景简洁，画面锐利，重点突出。",
        f"{product_name} 包装与品质感展示，极简高端背景，柔和投影，材质细节明确，提升信任感。",
        f"{product_name} 纯白底标准图，白底无阴影，主体居中，边缘清晰，仅保留商品主体。",
    ]
    for i in range(1, n_main + 1):
        out.append(
            (
                "main",
                i,
                main_defaults[(i - 1) % len(main_defaults)],
            )
        )
    detail_defaults = [
        f"{product_name} 详情首屏海报场景，主体居中，氛围光塑形，画面通透，质感真实。",
        f"{product_name} 详情痛点转卖点场景，形成前后对比，背景简洁，主体突出，便于表达卖点。",
        f"{product_name} 材质工艺微距特写，纹理细节清晰，局部高光干净，突出做工品质。",
        f"{product_name} 参数规格展示场景，信息层次清晰，排布理性，视觉秩序明确。",
        f"{product_name} 品牌背书与服务保障场景，专业可信，整洁留白，增强购买信心。",
    ]
    for j in range(1, n_detail + 1):
        out.append(
            (
                "detail",
                j,
                detail_defaults[(j - 1) % len(detail_defaults)],
            )
        )
    return out


def rgba_base_from_white_product_image(src: Path, dest: Path, threshold: int = 238) -> None:
    """
    将常见白底商品图转为 RGBA：高亮近白像素设为透明，供 wanx-background-generation-v2 的 base_image_url。
    若抠边不理想，请用户在 PS 中导出带透明通道的主体图再上传。
    """
    from PIL import Image

    im = Image.open(src).convert("RGB")
    rgba = Image.new("RGBA", im.size)
    px = im.load()
    pr = rgba.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pr[x, y] = (255, 255, 255, 0)
            else:
                pr[x, y] = (r, g, b, 255)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(dest, "PNG")


def upload_local_image_for_background(*, api_key: str, local_path: Path) -> str:
    """
    上传本地 PNG 至百炼临时 OSS，返回 **oss://** 前缀地址（与上传时 model 一致）。
    公网拼接的 bucket HTTPS 链接往往无匿名读权限，会导致巡检报错
    「Don't have authorization to access the media resource」；
    后续 HTTP 调用必须带请求头 X-DashScope-OssResourceResolve: enable（见 background_generation_v2_first_url）。
    """
    oss_url, _cert = OssUtils.upload(
        model=BG_GENERATION_MODEL,
        file_path=str(local_path.resolve()),
        api_key=api_key,
    )
    if not oss_url:
        raise RuntimeError("上传主体图失败，未返回 URL")
    s = str(oss_url).strip()
    if not s.startswith("oss://"):
        raise RuntimeError(f"主体图地址格式异常（应为 oss:// 前缀）: {s!r}")
    return s


def background_generation_v2_first_url(
    *,
    api_key: str,
    base_image_url: str,
    ref_prompt: str,
    ref_image_url: str | None = None,
    neg_ref_prompt: str | None = None,
    reference_edge: dict | None = None,
    ref_prompt_weight: float = 0.55,
    model_version: str = "v3",
    timeout_sec: int = 3600,
) -> str:
    """
    调用万相 wanx-background-generation-v2（HTTP 异步），返回首张结果图 URL。
    ref_prompt 为「背景」侧引导；主体以 base_image_url（RGBA 抠图）为准。
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-DashScope-Async": "enable",
        "Content-Type": "application/json",
        # 与 SDK 一致：便于服务端解析 DashScope OSS 资源（若仍传 oss:// 或需内网解析）
        "X-DashScope-OssResourceResolve": "enable",
    }
    body = {
        "model": BG_GENERATION_MODEL,
        "input": {
            "base_image_url": base_image_url,
            "ref_prompt": ref_prompt,
        },
        "parameters": {
            "n": 1,
            "ref_prompt_weight": max(0.0, min(1.0, float(ref_prompt_weight))),
            "model_version": model_version,
        },
    }
    if ref_image_url:
        body["input"]["ref_image_url"] = ref_image_url
    if neg_ref_prompt:
        body["input"]["neg_ref_prompt"] = neg_ref_prompt
    if reference_edge:
        body["input"]["reference_edge"] = reference_edge
    r = requests.post(BG_CREATE_URL, headers=headers, data=json.dumps(body), timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"创建背景生成任务失败: HTTP {r.status_code} {r.text[:500]}")
    data = r.json()
    if data.get("code"):
        raise RuntimeError(data.get("message") or str(data))
    out = data.get("output") or {}
    task_id = out.get("task_id")
    if not task_id:
        raise RuntimeError(f"无 task_id: {data}")

    deadline = time.time() + max(60, int(timeout_sec))
    while time.time() < deadline:
        time.sleep(2.0)
        r2 = requests.get(
            BG_TASK_URL.format(task_id=task_id),
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-DashScope-OssResourceResolve": "enable",
            },
            timeout=120,
        )
        if r2.status_code != 200:
            raise RuntimeError(f"查询任务失败: HTTP {r2.status_code} {r2.text[:500]}")
        j = r2.json()
        o = j.get("output") or {}
        status = (o.get("task_status") or "").upper()
        if status in ("SUCCEEDED", "SUCCESS"):
            results = o.get("results") or []
            if not results:
                raise RuntimeError(f"任务成功但无 results: {j}")
            url = results[0].get("url")
            if not url:
                raise RuntimeError(f"无 url: {results[0]}")
            return url
        if status in ("FAILED", "CANCELED"):
            raise RuntimeError(o.get("message") or o.get("code") or str(o))
    raise RuntimeError(f"背景生成任务超时（>{max(60, int(timeout_sec))}s）")


def text_to_image_first_url(
    *,
    api_key: str,
    prompt: str,
    model: str = T2I_MODEL_DEFAULT,
    size: str = "1024*1024",
) -> str:
    """
    文生图首图 URL（用于多角度“想象”策略）。
    注意：该策略不保证主体细节与参考图完全一致，更适合补全角度与场景创意。
    """
    _set_key(api_key)
    rsp = ImageSynthesis.call(
        model=model,
        prompt=prompt[:1200],
        size=size,
        n=1,
        api_key=api_key,
    )
    if rsp.status_code != 200:
        raise RuntimeError(getattr(rsp, "message", None) or str(rsp))
    out = rsp.output
    if out is None:
        raise RuntimeError("文生图无 output")
    results = getattr(out, "results", None)
    if not results:
        raise RuntimeError(f"文生图无图片结果: {out}")
    first = results[0]
    url = getattr(first, "url", None) if not isinstance(first, dict) else first.get("url")
    if not url:
        raise RuntimeError(f"文生图结果缺少 url 字段: {first}")
    return str(url)


def _seedream_supports_sequential_image_generation(model_id: str) -> bool:
    """组图参数仅部分 Seedream 支持（4.0 / 4.5 / 5.0 lite）；pro / 更早版本会 400。"""
    mid = (model_id or "").lower()
    if "seedream-5-0-pro" in mid or "seedream-5.0-pro" in mid:
        return False
    if "seedream-3" in mid:
        return False
    # 4.0 / 4.5 / 5.0 lite（非 pro）
    if "seedream-4" in mid or "seedream-5-0" in mid or "seedream-5.0" in mid:
        return True
    return False


# ---------------------------------------------------------------------------
# 各模型官方 size 能力（与 frontend/src/constants/modelImageSizes.ts 对齐）
# ---------------------------------------------------------------------------

_SizeChoice = tuple[str, int, int]  # aspect, width, height


def _choices(*items: tuple[str, int, int]) -> list[_SizeChoice]:
    return list(items)


_SEEDREAM_5_LITE_2K = _choices(
    ("1:1", 2048, 2048),
    ("4:3", 2304, 1728),
    ("3:4", 1728, 2304),
    ("16:9", 2848, 1600),
    ("9:16", 1600, 2848),
    ("3:2", 2496, 1664),
    ("2:3", 1664, 2496),
    ("21:9", 3136, 1344),
)
_SEEDREAM_5_LITE_3K = _choices(
    ("1:1", 3072, 3072),
    ("4:3", 3456, 2592),
    ("3:4", 2592, 3456),
    ("16:9", 4096, 2304),
    ("9:16", 2304, 4096),
    ("3:2", 3744, 2496),
    ("2:3", 2496, 3744),
    ("21:9", 4704, 2016),
)
_SEEDREAM_4_5_2K = _choices(
    ("1:1", 2048, 2048),
    ("4:3", 2304, 1728),
    ("3:4", 1728, 2304),
    ("16:9", 2560, 1440),
    ("9:16", 1440, 2560),
    ("3:2", 2496, 1664),
    ("2:3", 1664, 2496),
    ("21:9", 3024, 1296),
)
_SEEDREAM_4_4K = _choices(
    ("1:1", 4096, 4096),
    ("4:3", 4694, 3520),
    ("3:2", 4992, 3328),
    ("16:9", 5404, 3040),
    ("21:9", 6198, 2656),
)
_SEEDREAM_4_1K = _choices(("1:1", 1024, 1024))
_SEEDREAM_4_2K = _choices(
    ("1:1", 2048, 2048),
    ("4:3", 2304, 1728),
    ("3:2", 2496, 1664),
    ("16:9", 2560, 1440),
    ("21:9", 3024, 1296),
)
_QWEN_IMAGE_2_REC = _choices(
    ("1:1", 2048, 2048),
    ("16:9", 2688, 1536),
    ("9:16", 1536, 2688),
    ("4:3", 2368, 1728),
    ("3:4", 1728, 2368),
)

# strategy -> (size_format, default_res, default_aspect, sizes_by_res)
# size_format: "x" | "*"
_STRATEGY_SIZE_PROFILES: dict[str, tuple[str, str, str, dict[str, list[_SizeChoice]]]] = {
    "doubao_seedream_5": ("x", "2K", "1:1", {"2K": _SEEDREAM_5_LITE_2K, "3K": _SEEDREAM_5_LITE_3K}),
    "doubao_seedream_5_lite": ("x", "2K", "1:1", {"2K": _SEEDREAM_5_LITE_2K, "3K": _SEEDREAM_5_LITE_3K}),
    "doubao_seedream_5_pro": ("x", "2K", "1:1", {"1K": _SEEDREAM_4_1K, "2K": _SEEDREAM_4_2K}),
    "doubao_seedream_4_5": ("x", "2K", "1:1", {"2K": _SEEDREAM_4_5_2K, "4K": _SEEDREAM_4_4K}),
    "doubao_seedream_4_0": ("x", "2K", "1:1", {"1K": _SEEDREAM_4_1K, "2K": _SEEDREAM_4_2K, "4K": _SEEDREAM_4_4K}),
    "qwen_image_2_0_pro": ("*", "rec", "1:1", {"rec": _QWEN_IMAGE_2_REC}),
    "qwen_image_2_0_pro_2026_06_22": ("*", "rec", "1:1", {"rec": _QWEN_IMAGE_2_REC}),
    "qwen_image_2_0": ("*", "rec", "1:1", {"rec": _QWEN_IMAGE_2_REC}),
}


def _profile_for_strategy(strategy: str) -> tuple[str, str, str, dict[str, list[_SizeChoice]]]:
    return _STRATEGY_SIZE_PROFILES.get(
        strategy,
        _STRATEGY_SIZE_PROFILES["doubao_seedream_5_lite"],
    )


def resolve_pixel_wh(
    strategy: str | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
) -> tuple[int, int]:
    """按当前策略官方推荐表解析宽高；缺省回退到该策略默认项。"""
    sep, default_res, default_aspect, by_res = _profile_for_strategy(strategy or "")
    _ = sep
    res = (resolution or default_res).strip() or default_res
    aspect = (aspect_ratio or default_aspect).strip() or default_aspect
    choices = by_res.get(res) or by_res.get(default_res) or []
    for a, w, h in choices:
        if a == aspect:
            return w, h
    # 详情常用竖图：若请求 9:16 但当前档无此比例，回退 2:3 / 3:4
    if aspect in ("9:16", "2:3", "3:4"):
        by_aspect = {a: (w, h) for a, w, h in choices}
        for prefer in ("9:16", "2:3", "3:4"):
            if prefer in by_aspect:
                return by_aspect[prefer]
    if choices:
        return choices[0][1], choices[0][2]
    return 2048, 2048


def format_model_size(
    *,
    strategy: str | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
) -> str:
    sep, _, _, _ = _profile_for_strategy(strategy or "")
    w, h = resolve_pixel_wh(strategy, resolution, aspect_ratio)
    return f"{w}{sep}{h}"


def resolve_generation_size_for_strategy(
    strategy: str,
    *,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
) -> str:
    """按策略返回可直接传给模型的官方 size。"""
    if strategy in _STRATEGY_SIZE_PROFILES or is_doubao_strategy(strategy) or is_qwen_image_strategy(strategy):
        return format_model_size(
            strategy=strategy, resolution=resolution, aspect_ratio=aspect_ratio
        )
    # 文生图等其它策略：沿用千问推荐 1:1
    return format_model_size(
        strategy="qwen_image_2_0", resolution=resolution, aspect_ratio=aspect_ratio
    )


def doubao_seedream_generate_first_url(
    *,
    api_key: str,
    prompt: str,
    image: str | None = None,
    size: str = "2K",
    watermark: bool = True,
    model: str | None = None,
) -> str:
    """调用豆包 Seedream（火山 ARK）REST API 生图，返回首图 URL。"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    use_model = model or DOUBAO_SEEDREAM_MODEL
    payload: dict[str, Any] = {
        "model": use_model,
        "prompt": (prompt or "")[:2000],
        "response_format": "url",
        "size": size,
        "stream": False,
        "watermark": bool(watermark),
    }
    # 仅部分模型支持；不支持时传参会 InvalidParameter
    if _seedream_supports_sequential_image_generation(use_model):
        payload["sequential_image_generation"] = "disabled"
    if image:
        payload["image"] = image
    r = requests.post(
        f"{ARK_BASE_URL}/images/generations",
        headers=headers,
        data=json.dumps(payload),
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"豆包生图失败: HTTP {r.status_code} {r.text[:500]}")
    j = r.json()
    data = j.get("data") or []
    if not data:
        raise RuntimeError("豆包生图无结果")
    first = data[0]
    url = first.get("url") if isinstance(first, dict) else None
    if not url:
        raise RuntimeError(f"豆包生图结果缺少 url 字段: {first}")
    return str(url)


def _extract_image_url_from_mmc_output(out: Any) -> str:
    choices = getattr(out, "choices", None) or []
    if not choices:
        raise RuntimeError(f"千问生图无 choices: {out}")
    choice0 = choices[0]
    msg = getattr(choice0, "message", None)
    content = getattr(msg, "content", None) if msg else None
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("image"):
                return str(item["image"])
            if isinstance(item, dict) and item.get("url"):
                return str(item["url"])
    raise RuntimeError(f"千问生图结果缺少 image: {content}")


def qwen_multimodal_image_first_url(
    *,
    api_key: str,
    model: str,
    prompt: str,
    image_path: Path | None = None,
    size: str = "2048*2048",
) -> str:
    """qwen-image / z-image 等：MultiModalConversation 同步生图。"""
    _set_key(api_key)
    content: list[dict[str, Any]] = []
    if image_path is not None and image_path.is_file():
        content.append({"image": _local_image_path_for_multimodal(image_path)})
    content.append({"text": (prompt or "")[:2000]})
    messages = [{"role": "user", "content": content}]
    resp = MultiModalConversation.call(
        api_key=api_key,
        model=model,
        messages=messages,
        result_format="message",
        stream=False,
        watermark=False,
        prompt_extend=True,
        size=size,
    )
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(getattr(resp, "message", None) or str(resp))
    return _extract_image_url_from_mmc_output(resp.output)


def wan_image_generation_first_url(
    *,
    api_key: str,
    model: str,
    prompt: str,
    image_path: Path | None = None,
    size: str = "2K",
) -> str:
    """wan2.7-image-pro 等：ImageGeneration 异步任务生图。"""
    _set_key(api_key)
    content: list[dict[str, Any]] = []
    if image_path is not None and image_path.is_file():
        content.append({"image": _local_image_path_for_multimodal(image_path)})
    content.append({"text": (prompt or "")[:2000]})
    message = Message(role="user", content=content)
    response = ImageGeneration.async_call(
        model=model,
        api_key=api_key,
        messages=[message],
        enable_sequential=False,
        n=1,
        size=size,
        watermark=False,
        thinking_mode=True,
    )
    if getattr(response, "status_code", None) != 200:
        raise RuntimeError(getattr(response, "message", None) or str(response))
    status = ImageGeneration.wait(task=response, api_key=api_key)
    out = getattr(status, "output", None)
    if out is None:
        raise RuntimeError("万相生图无 output")
    task_status = (getattr(out, "task_status", None) or "").upper()
    if task_status not in ("SUCCEEDED", "SUCCESS"):
        raise RuntimeError(
            getattr(out, "message", None)
            or getattr(status, "message", None)
            or f"万相生图失败: {task_status}"
        )
    choices = getattr(out, "choices", None) or []
    if not choices:
        raise RuntimeError(f"万相生图无 choices: {out}")
    msg = getattr(choices[0], "message", None)
    content_out = getattr(msg, "content", None) if msg else None
    if isinstance(content_out, list):
        for item in content_out:
            if isinstance(item, dict) and item.get("image"):
                return str(item["image"])
            if isinstance(item, dict) and item.get("url"):
                return str(item["url"])
    raise RuntimeError(f"万相生图结果缺少 image: {content_out}")


def qwen_family_generate_first_url(
    *,
    api_key: str,
    strategy: str,
    prompt: str,
    image_path: Path | None = None,
    size: str | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
) -> str:
    """按千问策略路由到对应文生图/图生图 API（见百炼 Qwen-Image 文档）。"""
    model = resolve_qwen_image_model(strategy)
    if size is None:
        size = resolve_generation_size_for_strategy(
            strategy, resolution=resolution, aspect_ratio=aspect_ratio
        )
    if model.startswith("wan"):
        return wan_image_generation_first_url(
            api_key=api_key,
            model=model,
            prompt=prompt,
            image_path=image_path,
            size=size,
        )
    # qwen-image-2.0 系列 / z-image：同步 MultiModalConversation
    if not size:
        size = "1024*1024" if model == "z-image-turbo" else "2048*2048"
    return qwen_multimodal_image_first_url(
        api_key=api_key,
        model=model,
        prompt=prompt,
        image_path=image_path,
        size=size,
    )


def local_image_to_data_url(path: Path) -> str:
    """将本地图片转为 data URL，供即梦 image 字段传参。"""
    p = path.resolve()
    if not p.is_file():
        raise FileNotFoundError(str(p))
    mime, _ = mimetypes.guess_type(str(p))
    if not mime or not mime.startswith("image/"):
        mime = "image/png"
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def download_image(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)


def postprocess_to_size(src: Path, dest: Path, width: int, height: int, fmt: str = "PNG") -> None:
    from PIL import Image

    im = Image.open(src).convert("RGBA" if fmt.upper() == "PNG" else "RGB")
    src_w, src_h = im.size
    if src_w <= 0 or src_h <= 0:
        raise RuntimeError("无效源图片尺寸")

    # 使用 cover 逻辑：等比缩放后居中裁切，保证目标画布被完全填满。
    scale = max(width / float(src_w), height / float(src_h))
    resized_w = max(1, int(round(src_w * scale)))
    resized_h = max(1, int(round(src_h * scale)))
    im = im.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    left = max(0, (resized_w - width) // 2)
    top = max(0, (resized_h - height) // 2)
    right = left + width
    bottom = top + height
    im = im.crop((left, top, right, bottom))

    canvas = Image.new("RGB" if fmt.upper() == "JPG" else "RGBA", (width, height), (255, 255, 255))
    if im.mode == "RGBA":
        canvas.paste(im, (0, 0), im)
    else:
        canvas.paste(im, (0, 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    if fmt.upper() == "JPG":
        canvas.convert("RGB").save(dest, "JPEG", quality=90, optimize=True)
    else:
        canvas.save(dest, "PNG", optimize=True)


def postprocess_main_image(src: Path, dest: Path, *, is_white_slot: bool = False) -> None:
    """主图后处理：默认 1440x1440；第 5 张白底图强制纯白底并压缩范围。"""
    from PIL import Image

    w, h = TAOBAO_MAIN_RECOMMENDED
    if is_white_slot:
        ensure_pure_white_background(src, dest, width=w, height=h, fmt="JPG")
        enforce_file_size_jpg(dest, min_kb=38, max_kb=300)
        return
    postprocess_to_size(src, dest, w, h, fmt="JPG")
    enforce_file_size_jpg(dest, min_kb=0, max_kb=3072)


def ensure_pure_white_background(
    src: Path, dest: Path, *, width: int, height: int, fmt: str = "JPG"
) -> None:
    """将图片居中贴到纯白画布，确保背景像素为 (255,255,255)。"""
    from PIL import Image

    im = Image.open(src).convert("RGBA")
    im.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), (255, 255, 255))
    x = (width - im.width) // 2
    y = (height - im.height) // 2
    canvas.paste(im, (x, y), im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if fmt.upper() == "JPG":
        canvas.save(dest, "JPEG", quality=92, optimize=True)
    else:
        canvas.save(dest, "PNG", optimize=True)


def check_pure_white_background(path: Path, sample_step: int = 5) -> bool:
    """抽样检查背景是否纯白；用于第 5 张主图质检。"""
    from PIL import Image

    im = Image.open(path).convert("RGB")
    w, h = im.size
    pix = im.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    for x, y in corners:
        if pix[x, y] != (255, 255, 255):
            return False
    total = 0
    white = 0
    for y in range(0, h, max(1, sample_step)):
        for x in range(0, w, max(1, sample_step)):
            total += 1
            if pix[x, y] == (255, 255, 255):
                white += 1
    return total > 0 and (white / total) >= 0.95


def enforce_file_size_jpg(path: Path, *, min_kb: int = 0, max_kb: int = 1024) -> None:
    """通过质量迭代将 JPG 大小收敛到给定范围。"""
    from PIL import Image

    data = path.read_bytes()
    size_kb = len(data) / 1024
    if min_kb <= size_kb <= max_kb:
        return
    im = Image.open(path).convert("RGB")
    low, high = 30, 95
    best = None
    for _ in range(12):
        q = (low + high) // 2
        bio = io.BytesIO()
        im.save(bio, "JPEG", quality=q, optimize=True)
        b = bio.getvalue()
        kb = len(b) / 1024
        if kb > max_kb:
            high = q - 1
        elif kb < min_kb:
            low = q + 1
            best = b
        else:
            best = b
            break
    if best is None:
        bio = io.BytesIO()
        im.save(bio, "JPEG", quality=max(30, min(95, high)), optimize=True)
        best = bio.getvalue()
    path.write_bytes(best)


def export_image_as_jpg(src: Path, dest: Path, *, quality: int = 92) -> None:
    """按原尺寸导出 JPG，不做缩放 / 裁切 / 切片。"""
    from PIL import Image

    im = Image.open(src).convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "JPEG", quality=quality, optimize=True)


# 兼容旧引用（若仍有代码 import ImageSynthesis）
def text_to_image_with_ref(
    *,
    api_key: str,
    prompt: str,
    ref_image: Path,
    size: str = "1024*1024",
    model: str = "wanx-v1",
) -> str:
    """旧万相文生图接口；新流程请使用 background_generation_v2_first_url。"""
    _set_key(api_key)
    rsp = ImageSynthesis.call(
        model=model,
        prompt=prompt,
        ref_img=str(ref_image.resolve()),
        size=size,
        n=1,
        api_key=api_key,
    )
    if rsp.status_code != 200:
        raise RuntimeError(getattr(rsp, "message", None) or str(rsp))
    out = rsp.output
    if out is None:
        raise RuntimeError("生图无 output")
    results = getattr(out, "results", None)
    if not results:
        raise RuntimeError(f"无图片结果: {out}")
    url = results[0].url
    if not url:
        raise RuntimeError(f"无 url 字段: {results[0]}")
    return url
