"""统一管理大模型提示词模板。"""

from __future__ import annotations


QWEN_MAX_PROMPT_SYSTEM_CONSTRAINT = (
    "请生成一段用于AI绘画的提示词，描述商品场景。"
    "请使用中文短语，不写长句，"
    "重点描述背景和光影，确保画面简洁突出主体。"
)

OCR_TEXT_PROMPT = (
    "请对图片中的所有印刷体、手写体文字进行 OCR，按阅读顺序输出纯文本。"
    "不要解释，不要加引号，不要 Markdown。"
)

COMPETITOR_SUMMARY_PROMPT = (
    "你是电商视觉分析师。请根据商品图，用中文归纳：背景与场景、主色调、构图、"
    "卖点文案风格、装饰元素。输出一段可直接用于「文生图/商品图生成」提示词的文字描述，"
    "要求保留商品类别与大致展示角度，但不要出现具体品牌商标名称。纯文本输出。"
)

KEY_INFO_EXTRACTION_PROMPT = """\
### 角色设定
你是一个专业的电商商品分析师和视觉策划师。你的任务是从【商品文本信息】中提取**极其详细**的商品信息，这些信息将用于后续的AI背景生成。
### 任务要求
请严格按照以下JSON格式输出，提取的信息越详细越好：
{
  "商品基础身份": {
    "品牌": "提取品牌名称",
    "商品全称": "提取完整商品名称",
    "商品品类": "提取核心品类，如'智能手机'、'全价猫粮'、'S925银手链'",
    "型号/系列": "提取具体型号或系列名称"
  },
  "核心规格参数": {
    "尺寸规格": "提取所有尺寸信息（长宽高、直径、手围等）",
    "重量": "提取重量信息",
    "颜色": "提取所有提到的颜色",
    "材质成分": "提取详细材质，如'S925银'、'95%棉+5%氨纶'、'鸡肉粉'",
    "包装形式": "提取包装描述，如'袋装'、'盒装'、'瓶装'"
  },
  "视觉特征描述": {
    "整体形状": "描述商品的整体轮廓和形状",
    "表面质感": "描述表面触感和视觉质感，如'磨砂'、'镜面'、'哑光'、'颗粒感'",
    "光泽度": "描述反光特性，如'高反光'、'漫反射'、'无光泽'",
    "纹理细节": "描述表面纹理，如'编织纹'、'拉丝'、'颗粒感'",
    "透明度": "如适用，描述透明度，如'透明'、'半透明'、'不透明'"
  },
  "使用场景联想": {
    "主要使用场景": "根据商品类型推断主要使用场景",
    "次要使用场景": "推断其他可能的使用场景",
    "目标用户画像": "推断目标用户特征（年龄、性别、生活方式等）",
    "情感联想": "商品可能引发的情感，如'温馨'、'科技感'、'奢华'、'自然'"
  },
  "摆放与展示建议": {
    "推荐摆放姿态": "推断最适合的展示姿态，如'直立'、'平铺'、'悬挂'、'斜放'",
    "推荐拍摄视角": "推断最佳拍摄角度，如'平视'、'45度俯视'、'正俯拍'、'微仰视'",
    "推荐光影风格": "根据材质推断适合的光影，如'硬光突出质感'、'柔光营造温馨'、'逆光勾勒轮廓'"
  },
  "风格与调性": {
    "设计风格": "提取或推断设计风格，如'极简'、'复古'、'国潮'、'科技感'",
    "色彩调性": "描述整体色彩氛围，如'清新'、'沉稳'、'活泼'、'高级灰'",
    "品牌调性关键词": "提取3-5个关键词描述品牌调性"
  }
}

【提取原则】
1. 不要遗漏任何细节，即使看起来不重要。
2. 如果文本中没有明确提到某项，请根据商品类型进行合理推断，并在值中注明"（推断）"。
3. 提取的信息将用于AI创意生成，请尽量提供丰富的描述性词汇。
"""

def build_key_info_extraction_prompt(text: str) -> str:
    return (
        f"{KEY_INFO_EXTRACTION_PROMPT}\n\n"
        "请阅读下面的商品文本并执行提取：\n\n"
        "【商品文本信息】\n"
        f"{text}\n\n"
        "仅输出 JSON 对象，不要输出任何解释。"
    )


def build_translate_prompt(src: str) -> str:
    return f"""请将下列中文/中英混合电商生图提示词，转换为英文提示词。
要求：
1) 只输出一行英文提示词，不要解释；
2) 保留商品名、尺寸、参数与摄影术语；
3) 风格保持“短语化”，适配AI绘画。

原提示词：
{src}
"""


def _ref_images_block(*, ref_image_count: int, primary_ref_label: str = "") -> str:
    if ref_image_count <= 0:
        return ""
    labels = "、".join(f"图{i}" for i in range(1, ref_image_count + 1))
    primary = f"；本槽主参考为 {primary_ref_label}" if primary_ref_label else ""
    return f"""
【参考白底商品图】（已按顺序附上：{labels}{primary}）
请仔细观察参考图中的商品外形、颜色、材质、结构与视角；提示词必须与实物主体一致，禁止臆造与参考图明显不符的商品形态或颜色。
识别并延续图片风格（构图、色调、光感、材质表现、氛围），再结合商品信息写可直接生图的提示词。
"""


def build_plan_background_prompt(
    *,
    product_name: str,
    product_desc: str,
    competitor_summary: str,
    n_main: int,
    n_detail: int,
    strategy_notes: str,
    custom_template: str = "",
    user_requirements: str = "",
    ref_image_count: int = 0,
) -> str:
    ref_block = _ref_images_block(ref_image_count=ref_image_count)
    if (custom_template or "").strip():
        output_hint = (
            "请严格输出你模板中定义的 JSON 对象；不要输出 Markdown、不要解释、不要追加其它段落。"
            if (n_main == 0 or n_detail == 0)
            else "优先按模板输出结构化 JSON；若无法稳定输出 JSON，再退化为 MAIN/DETAIL\t序号\twanx正向提示词 的行格式。"
        )
        return f"""{custom_template.strip()}

补充信息（请务必参考）：
【商品名称】
{product_name}

【商品详细信息】
{product_desc or "（无）"}

【竞品风格归纳】（可为空）
{competitor_summary or "（无）"}

【用户需求补充】
{user_requirements or "（无）"}

【当前策略约束】
{strategy_notes}
{ref_block}
额外硬性输出要求（用于系统解析）：
1) {output_hint}
2) 方案数量必须与用户要求一致（主图 {n_main}，详情 {n_detail}）。
3) 每个方案都必须包含可直接用于生成的 wanx正向提示词；如存在 wanx负面提示词也请填写。
"""

    return f"""你是电商视觉总监，请基于以下信息与参考图生成槽位提示词。

【商品名称】
{product_name}

【商品基础描述】
{product_desc or "（无）"}

【竞品风格归纳】（可为空）
{competitor_summary or "（无）"}

【策略约束】
{strategy_notes}
{ref_block}
输出要求：
1) 不要输出解释、不要输出 Markdown。
2) 严格输出 {n_main + n_detail} 行。
3) 每行使用 Tab 分隔三列：MAIN/DETAIL\t序号\t单行提示词。
4) 先输出 MAIN 1..{n_main}，再输出 DETAIL 1..{n_detail}。
"""


def build_plan_single_prompt(
    *,
    index: int,
    slot_name: str,
    product_name: str,
    product_desc: str,
    competitor_summary: str,
    strategy: str,
    old_prompt: str,
    slot_rule: str,
    ref_image_count: int = 0,
    primary_ref_label: str = "",
) -> str:
    ref_block = _ref_images_block(
        ref_image_count=ref_image_count,
        primary_ref_label=primary_ref_label,
    )
    return f"""你是电商视觉总监。请重构第{index}张{slot_name}提示词。

【商品名称】
{product_name}

【商品基础描述】
{product_desc or "（无）"}

【竞品归纳】
{competitor_summary or "（无）"}

【当前策略】
{strategy}

【旧提示词】（可参考可重写）
{old_prompt or "（无）"}
{ref_block}
要求：
1) 中文为主，禁止整句英文；英文仅允许商品名、型号、必要参数词。
2) 使用短语，不写长句，单行输出，不限制长度。
3) 重点描述背景和光影，画面简洁突出主体。
4) {slot_rule}
5) 信息优先用商品基础描述与参考图；不足时参考同类目爆款常见视觉表达补全。
6) 读取参考图片内容，识别并延续图片当前风格（如构图、色调、光感、材质表现、氛围），再结合商品信息生成可直接生图的提示词。
7) 只输出一行提示词文本，不要任何前后缀。
"""
