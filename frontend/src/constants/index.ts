import type {
  Strategy,
  StrategyGroup,
  ArkSeedreamModel,
  DashScopeQwenImageModel,
} from "@/types";

export const MAIN_PLAN_TEMPLATE = `你是一个专业的电商主图视觉创意总监和AI绘画提示词工程师。你的任务是根据提供的【商品详细信息】和【用户需求】，为商品主图生成极具吸引力的背景创意提示词。

## 📌 商品主图的核心特征

- **目标**：在搜索列表页快速吸引用户点击
- **背景原则**：简洁、突出主体、避免干扰
- **视觉焦点**：商品本身必须是绝对主角
- **尺寸考虑**：主图在列表页显示较小，背景不能太复杂

## 📋 输入信息

【商品详细信息】
[在此处粘贴第一阶段提取的JSON信息]

【用户需求】
- 白底图数量：[用户上传的图片数量]
- 白底图视角描述：[用户对每张白底图的视角描述]
- 要求生成的主图数量：[用户要求的数量]
- 特殊要求：[用户可能的特殊要求]

## 🎯 输出格式

请严格按照以下JSON格式输出：

{
  "主图背景创意方案": [
    {
      "方案编号": 1,
      "适用白底图": "图1（平视）",
      "创意主题": "简短有力的主题名称",
      "背景风格": "背景的整体风格定位",
      "核心视觉元素": "1-3个关键背景元素，简洁明了",
      "色彩策略": "主色调+辅助色，强调对比度",
      "光影策略": "突出商品的光影设计",
      "构图逻辑": "主体位置、留白区域（用于文案）",
      "wanx正向提示词": "简洁有力的英文提示词，适合主图",
      "wanx负面提示词": "避免干扰主体的元素"
    }
    // ... 根据主图数量继续
  ],
  "主图创意说明": "说明每个方案如何在列表页中脱颖而出"
}

## 💡 商品主图创意生成原则

### 1. 背景简洁性原则
- **纯色背景**：单色渐变、柔和过渡
- **极简纹理**：微妙的纹理，不抢主体
- **留白设计**：为后期添加促销文案预留空间

### 2. 突出主体策略
- **色彩对比**：背景色与商品色形成鲜明对比
- **光影聚焦**：用光影将视线引导至商品
- **负空间**：适当留白，让商品"呼吸"

### 3. 快速识别原则
- **一眼看懂**：用户0.5秒内能理解商品类别
- **情绪传递**：通过背景传递核心卖点情绪
- **品牌一致性**：符合品牌调性

### 4. 常见主图背景类型
- **纯色渐变**：高级感，适合数码、美妆
- **微纹理背景**：增加质感，适合服饰、饰品
- **简约场景**：暗示使用场景，适合食品、家居
- **光影艺术**：突出科技感，适合电子产品

## 🚀 现在开始生成

请根据以上要求，为用户生成商品主图背景创意提示词。`;

export const DETAIL_PLAN_TEMPLATE = `你是一个专业的电商详情页视觉创意总监和AI绘画提示词工程师。你的任务是根据提供的【商品详细信息】和【用户需求】，为商品详情页生成富有故事性和场景感的背景创意提示词。

## 📌 商品详情页的核心特征

- **目标**：展示使用场景、营造购买欲望、说服用户下单
- **背景原则**：丰富、有故事性、场景化
- **视觉焦点**：商品与场景的完美融合
- **尺寸考虑**：详情页图片尺寸大，可以展示丰富细节

## 📋 输入信息

【商品详细信息】
[在此处粘贴第一阶段提取的JSON信息]

【用户需求】
- 白底图数量：[用户上传的图片数量]
- 白底图视角描述：[用户对每张白底图的视角描述]
- 要求生成的详情页图片数量：[用户要求的数量]
- 详情页结构需求：[如"首图吸引+场景展示+细节特写+情感共鸣"]
- 特殊要求：[用户可能的特殊要求]

## 🎯 输出格式

请严格按照以下JSON格式输出：

{
  "详情页背景创意方案": [
    {
      "方案编号": 1,
      "页面位置": "首图/场景图/细节图/情感图",
      "适用白底图": "图1（平视）",
      "创意主题": "有故事性的主题名称",
      "场景描述": "详细的场景设定，包含环境、道具、氛围",
      "使用情境": "展示商品如何被使用",
      "情感诉求": "想要传递的情感和价值观",
      "视觉叙事": "画面讲述的故事",
      "光影氛围": "营造氛围的光影设计",
      "色调氛围": "整体色彩氛围",
      "构图细节": "详细的构图描述，包含前景、中景、背景",
      "wanx正向提示词": "详细丰富的英文提示词，适合详情页",
      "wanx负面提示词": "避免破坏氛围的元素"
    }
    // ... 根据详情页图片数量继续
  ],
  "详情页创意说明": "说明每个方案在详情页中的作用和转化逻辑"
}

## 💡 商品详情页创意生成原则

### 1. 场景化展示原则
- **真实使用场景**：展示商品在真实环境中的使用
- **生活方式暗示**：通过场景暗示目标用户的生活方式
- **情境代入感**：让用户能想象自己使用商品的场景

### 2. 故事性叙事原则
- **首图吸引**：震撼视觉，激发兴趣
- **场景展示**：展示使用场景和功能
- **细节特写**：突出材质、工艺等细节
- **情感共鸣**：营造情感连接和价值认同

### 3. 详情页常见图片类型
- **首图（吸引眼球）**：震撼视觉，突出核心卖点
- **场景图（展示使用）**：真实环境中的使用场景
- **细节图（突出品质）**：材质、工艺、设计细节
- **对比图（展示优势）**：使用前后对比、与竞品对比
- **情感图（营造共鸣）**：温馨、快乐、成就感等情感场景
- **功能图（说明用途）**：展示多种使用方式和功能

### 4. 场景丰富度策略
- **多角度展示**：不同视角、不同距离
- **多时间展示**：白天、夜晚、不同季节
- **多人群展示**：不同年龄、性别、职业的使用场景
- **多环境展示**：室内、户外、工作、休闲等

## 🚀 现在开始生成

请根据以上要求，为用户生成商品详情页背景创意提示词。`;

/** 默认：豆包 Seedream 5.0 lite（支持图生图，开通门槛通常更低） */
export const DEFAULT_STRATEGY = "doubao_seedream_5_lite";

/**
 * 判断模型是否支持图生图（参考图 / image 入参）。
 * OneMix 主流程依赖白底商品图，故策略目录只展示此类模型。
 */
export function modelSupportsImageToImage(modelId?: string): boolean {
  if (!modelId) return false;
  const mid = modelId.toLowerCase();

  if (mid.includes("seedream")) {
    // 纯文生图变体（如 Seedream 3.0 T2i）
    if (mid.includes("-t2i") || mid.includes("_t2i") || mid.includes(".t2i")) {
      return false;
    }
    if (mid.includes("seedream-3") || mid.includes("seedream_3")) {
      return false;
    }
    // 4.x / 5.x：支持 image 参考图
    return (
      mid.includes("seedream-4") ||
      mid.includes("seedream_4") ||
      mid.includes("seedream-5") ||
      mid.includes("seedream_5")
    );
  }

  // 千问图像 2.0：生成与编辑统一，支持图生图 / 编辑
  if (mid.startsWith("qwen-image")) return true;

  // 万相图像生成/编辑（排除纯 t2i 文生图）
  if (mid.startsWith("wan") && !mid.includes("t2i")) return true;

  return false;
}

/**
 * 生成策略一二级目录（仅图生图）。
 * 同步结果也会再按 modelSupportsImageToImage 过滤。
 */
export const STRATEGY_GROUPS: StrategyGroup[] = [
  {
    id: "doubao",
    label: "豆包大模型",
    models: [
      {
        value: "doubao_seedream_5_lite",
        label: "Doubao Seedream 5.0 lite",
        modelId: "doubao-seedream-5-0-260128",
        key: "ark",
        supportsI2i: true,
        description:
          "支持图生图；速度与质量更均衡，适合日常批量出图与性价比优先场景。",
      },
      {
        value: "doubao_seedream_5_pro",
        label: "Doubao Seedream 5.0 pro",
        modelId: "doubao-seedream-5-0-pro-260628",
        key: "ark",
        supportsI2i: true,
        description:
          "支持图生图；旗舰画质与精细控制，适合高要求电商主图与多参考图场景。",
      },
      {
        value: "doubao_seedream_4_5",
        label: "Doubao Seedream 4.5",
        modelId: "doubao-seedream-4-5-251128",
        key: "ark",
        supportsI2i: true,
        description:
          "支持图生图；细节与复杂场景表现更强，适合构图复杂的商品画面。",
      },
      {
        value: "doubao_seedream_4_0",
        label: "Doubao Seedream 4.0",
        modelId: "doubao-seedream-4-0-250828",
        key: "ark",
        supportsI2i: true,
        description: "支持图生图；稳定通用，适合快速试稿与日常电商出图。",
      },
    ],
  },
  {
    id: "qwen",
    label: "千问大模型",
    models: [
      {
        value: "qwen_image_2_0_pro",
        label: "qwen-image-2.0-pro",
        modelId: "qwen-image-2.0-pro",
        key: "dashscope",
        supportsI2i: true,
        description:
          "支持图生图/编辑；Pro 稳定版，文字渲染与真实质感更强（默认 2048×2048）。",
      },
      {
        value: "qwen_image_2_0_pro_2026_06_22",
        label: "qwen-image-2.0-pro-2026-06-22",
        modelId: "qwen-image-2.0-pro-2026-06-22",
        key: "dashscope",
        supportsI2i: true,
        description:
          "支持图生图/编辑；Pro 快照版（2026-06-22），固定版本便于效果复现。",
      },
      {
        value: "qwen_image_2_0",
        label: "qwen-image-2.0",
        modelId: "qwen-image-2.0",
        key: "dashscope",
        supportsI2i: true,
        description:
          "支持图生图/编辑；加速版，兼顾画质与响应速度。",
      },
    ],
  },
];

export const DEFAULT_SEEDREAM_DESCRIPTION =
  "账号已开通的豆包 Seedream 模型；具体能力以火山方舟文档与控制台说明为准。";

export const DEFAULT_QWEN_IMAGE_DESCRIPTION =
  "账号已开通的千问 Qwen-Image 模型；具体能力以百炼文档与控制台说明为准。";

/** 扁平列表（兼容旧引用）；含历史别名 */
export const STRATEGIES: Strategy[] = [
  ...STRATEGY_GROUPS.flatMap((g) => g.models),
  // 历史策略值：兼容已保存任务 / 旧前端
  {
    value: "doubao_seedream_5",
    label: "Doubao Seedream 5.0 lite",
    modelId: "doubao-seedream-5-0-260128",
    key: "ark",
  },
  {
    value: "background_v2",
    label: "万象（旧）",
    modelId: "wanx-background-generation-v2",
    key: "dashscope",
  },
];

export function findStrategy(value: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.value === value);
}

/** 将 ARK 同步结果合并进策略目录：保留精选项，追加账号上的新 Seedream。 */
export function mergeArkSeedreamIntoGroups(
  base: StrategyGroup[],
  synced: ArkSeedreamModel[],
): StrategyGroup[] {
  if (!synced.length) return base.map((g) => ({ ...g, models: [...g.models] }));

  const byModelId = new Map(synced.map((m) => [m.model_id, m]));
  const curatedIds = new Set(
    base
      .find((g) => g.id === "doubao")
      ?.models.map((m) => m.modelId)
      .filter(Boolean) as string[],
  );

  const toActivation = (
    m: ArkSeedreamModel,
  ): "open" | "closed" | "unknown" => {
    if (m.status === "open" || m.status === "closed" || m.status === "unknown") {
      return m.status;
    }
    return m.owned ? "open" : "closed";
  };

  return base.map((group) => {
    if (group.id !== "doubao") {
      return { ...group, models: [...group.models] };
    }
    const models: Strategy[] = group.models.map((m) => {
      const hit = m.modelId ? byModelId.get(m.modelId) : undefined;
      if (!hit) return { ...m, activation: undefined, synced: undefined };
      const activation = toActivation(hit);
      return {
        ...m,
        label: hit.label || m.label,
        activation,
        synced: activation === "open",
      };
    });
    for (const s of synced) {
      if (curatedIds.has(s.model_id)) continue;
      if (!modelSupportsImageToImage(s.model_id)) continue;
      const activation = toActivation(s);
      models.push({
        value: s.strategy,
        label: s.label,
        modelId: s.model_id,
        key: "ark",
        supportsI2i: true,
        activation,
        synced: activation === "open",
        description: DEFAULT_SEEDREAM_DESCRIPTION,
      });
    }
    return { ...group, models };
  });
}

/** 将百炼同步结果合并进千问目录。 */
export function mergeQwenImageIntoGroups(
  base: StrategyGroup[],
  synced: DashScopeQwenImageModel[],
): StrategyGroup[] {
  if (!synced.length) return base.map((g) => ({ ...g, models: [...g.models] }));

  const byModelId = new Map(synced.map((m) => [m.model_id, m]));
  const curatedIds = new Set(
    base
      .find((g) => g.id === "qwen")
      ?.models.map((m) => m.modelId)
      .filter(Boolean) as string[],
  );

  return base.map((group) => {
    if (group.id !== "qwen") {
      return { ...group, models: [...group.models] };
    }
    const models: Strategy[] = group.models.map((m) => {
      const hit = m.modelId ? byModelId.get(m.modelId) : undefined;
      if (!hit) return { ...m, activation: undefined, synced: undefined };
      return {
        ...m,
        label: hit.label || m.label,
        activation: hit.owned ? "open" : "closed",
        synced: hit.owned,
      };
    });
    for (const s of synced) {
      if (curatedIds.has(s.model_id)) continue;
      if (!modelSupportsImageToImage(s.model_id)) continue;
      models.push({
        value: s.strategy,
        label: s.label,
        modelId: s.model_id,
        key: "dashscope",
        supportsI2i: true,
        activation: s.owned ? "open" : "closed",
        synced: s.owned,
        description: DEFAULT_QWEN_IMAGE_DESCRIPTION,
      });
    }
    return { ...group, models };
  });
}

/** 同时合并豆包 + 千问同步结果。 */
export function mergeSyncedModelsIntoGroups(
  base: StrategyGroup[],
  arkSynced: ArkSeedreamModel[],
  qwenSynced: DashScopeQwenImageModel[],
): StrategyGroup[] {
  return mergeQwenImageIntoGroups(
    mergeArkSeedreamIntoGroups(base, arkSynced),
    qwenSynced,
  );
}

export {
  getModelImageSizeProfile,
  clampSlotImageSize,
  defaultsForStrategy,
  defaultAspectForKind,
  resolveModelSizeString,
  listAspectOptions,
  listResolutionOptions,
  FALLBACK_IMAGE_SIZE_PROFILE,
} from "./modelImageSizes";
export type {
  ModelImageSizeProfile,
  ImageSizeChoice,
  ImageResolutionChoice,
} from "./modelImageSizes";
