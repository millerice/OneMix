/**
 * 各生图模型官方支持的 size / 分辨率能力（来源见每条 profile.source）。
 * 禁止在此表外臆造宽高或档位。
 */
import type { Strategy } from "@/types";

export type ImageSizeChoice = {
  /** 宽高比，如 1:1；同时作为下拉 value */
  aspect: string;
  label: string;
  width: number;
  height: number;
};

export type ImageResolutionChoice = {
  value: string;
  label: string;
};

export type ModelImageSizeProfile = {
  /** seedream：WxH；qwen：W*H；tier：仅传 2K 等档位 */
  sizeFormat: "seedream" | "qwen" | "tier";
  resolutions: ImageResolutionChoice[];
  /** resolution value → 官方推荐尺寸列表 */
  sizesByResolution: Record<string, ImageSizeChoice[]>;
  defaultResolution: string;
  defaultAspect: string;
  /** 文档出处，便于核对 */
  source: string;
};

function choice(
  aspect: string,
  width: number,
  height: number,
  label?: string,
): ImageSizeChoice {
  return {
    aspect,
    width,
    height,
    label: label ?? `${aspect}（${width}×${height}）`,
  };
}

/** Seedream 5.0 lite：官方方式 1 仅 2K/3K；推荐像素见火山文档附表 */
const SEEDREAM_5_LITE_2K: ImageSizeChoice[] = [
  choice("1:1", 2048, 2048),
  choice("4:3", 2304, 1728),
  choice("3:4", 1728, 2304),
  choice("16:9", 2848, 1600),
  choice("9:16", 1600, 2848),
  choice("3:2", 2496, 1664),
  choice("2:3", 1664, 2496),
  choice("21:9", 3136, 1344),
];

const SEEDREAM_5_LITE_3K: ImageSizeChoice[] = [
  choice("1:1", 3072, 3072),
  choice("4:3", 3456, 2592),
  choice("3:4", 2592, 3456),
  choice("16:9", 4096, 2304),
  choice("9:16", 2304, 4096),
  choice("3:2", 3744, 2496),
  choice("2:3", 2496, 3744),
  choice("21:9", 4704, 2016),
];

/** Seedream 4.5：方式 1 为 2K/4K；2K 推荐像素见官方附表 */
const SEEDREAM_4_5_2K: ImageSizeChoice[] = [
  choice("1:1", 2048, 2048),
  choice("4:3", 2304, 1728),
  choice("3:4", 1728, 2304),
  choice("16:9", 2560, 1440),
  choice("9:16", 1440, 2560),
  choice("3:2", 2496, 1664),
  choice("2:3", 1664, 2496),
  choice("21:9", 3024, 1296),
];

/** Seedream 4.0 / 4.5 文档中的 4K 推荐宽高 */
const SEEDREAM_4_4K: ImageSizeChoice[] = [
  choice("1:1", 4096, 4096),
  choice("4:3", 4694, 3520),
  choice("3:2", 4992, 3328),
  choice("16:9", 5404, 3040),
  choice("21:9", 6198, 2656),
];

/** Seedream 4.0：方式 1 为 1K/2K/4K */
const SEEDREAM_4_1K: ImageSizeChoice[] = [choice("1:1", 1024, 1024)];

const SEEDREAM_4_2K: ImageSizeChoice[] = [
  choice("1:1", 2048, 2048),
  choice("4:3", 2304, 1728),
  choice("3:2", 2496, 1664),
  choice("16:9", 2560, 1440),
  choice("21:9", 3024, 1296),
];

/**
 * Seedream 5.0 pro：官方方式 1 为 1K/2K；精确像素总像素上限约 2048×2048。
 * 1K/2K 推荐组合沿用同系列 4.0 文档表（同属 Seedream size 体系）。
 */
const SEEDREAM_5_PRO_1K = SEEDREAM_4_1K;
const SEEDREAM_5_PRO_2K = SEEDREAM_4_2K;

/**
 * qwen-image-2.0 系列：无 1K/2K 档位缩写；官方推荐分辨率（宽*高）。
 * @see https://help.aliyun.com/zh/model-studio/qwen-image-api
 */
const QWEN_IMAGE_2_RECOMMENDED: ImageSizeChoice[] = [
  choice("1:1", 2048, 2048, "1:1 · 2048×2048（默认）"),
  choice("16:9", 2688, 1536, "16:9 · 2688×1536"),
  choice("9:16", 1536, 2688, "9:16 · 1536×2688"),
  choice("4:3", 2368, 1728, "4:3 · 2368×1728"),
  choice("3:4", 1728, 2368, "3:4 · 1728×2368"),
];

const PROFILE_SEEDREAM_5_LITE: ModelImageSizeProfile = {
  sizeFormat: "seedream",
  resolutions: [
    { value: "2K", label: "2K" },
    { value: "3K", label: "3K" },
  ],
  sizesByResolution: {
    "2K": SEEDREAM_5_LITE_2K,
    "3K": SEEDREAM_5_LITE_3K,
  },
  defaultResolution: "2K",
  defaultAspect: "1:1",
  source: "Volcengine Seedream 5.0 lite size（2K/3K + 推荐宽高）",
};

const PROFILE_SEEDREAM_5_PRO: ModelImageSizeProfile = {
  sizeFormat: "seedream",
  resolutions: [
    { value: "1K", label: "1K" },
    { value: "2K", label: "2K" },
  ],
  sizesByResolution: {
    "1K": SEEDREAM_5_PRO_1K,
    "2K": SEEDREAM_5_PRO_2K,
  },
  defaultResolution: "2K",
  defaultAspect: "1:1",
  source: "Volcengine Seedream 5.0 pro size（1K/2K）",
};

const PROFILE_SEEDREAM_4_5: ModelImageSizeProfile = {
  sizeFormat: "seedream",
  resolutions: [
    { value: "2K", label: "2K" },
    { value: "4K", label: "4K" },
  ],
  sizesByResolution: {
    "2K": SEEDREAM_4_5_2K,
    "4K": SEEDREAM_4_4K,
  },
  defaultResolution: "2K",
  defaultAspect: "1:1",
  source: "Volcengine Seedream 4.5 size（2K/4K + 推荐宽高）",
};

const PROFILE_SEEDREAM_4_0: ModelImageSizeProfile = {
  sizeFormat: "seedream",
  resolutions: [
    { value: "1K", label: "1K" },
    { value: "2K", label: "2K" },
    { value: "4K", label: "4K" },
  ],
  sizesByResolution: {
    "1K": SEEDREAM_4_1K,
    "2K": SEEDREAM_4_2K,
    "4K": SEEDREAM_4_4K,
  },
  defaultResolution: "2K",
  defaultAspect: "1:1",
  source: "Volcengine Seedream 4.0 size（1K/2K/4K + 推荐宽高）",
};

const PROFILE_QWEN_IMAGE_2: ModelImageSizeProfile = {
  sizeFormat: "qwen",
  /** 2.0 系列不提供 1K/2K 缩写，仅官方推荐像素；用 rec 表示「官方推荐」档 */
  resolutions: [{ value: "rec", label: "官方推荐" }],
  sizesByResolution: {
    rec: QWEN_IMAGE_2_RECOMMENDED,
  },
  defaultResolution: "rec",
  defaultAspect: "1:1",
  source: "阿里云百炼 qwen-image-api 推荐分辨率",
};

const STRATEGY_SIZE_PROFILES: Record<string, ModelImageSizeProfile> = {
  doubao_seedream_5: PROFILE_SEEDREAM_5_LITE,
  doubao_seedream_5_lite: PROFILE_SEEDREAM_5_LITE,
  doubao_seedream_5_pro: PROFILE_SEEDREAM_5_PRO,
  doubao_seedream_4_5: PROFILE_SEEDREAM_4_5,
  doubao_seedream_4_0: PROFILE_SEEDREAM_4_0,
  qwen_image_2_0_pro: PROFILE_QWEN_IMAGE_2,
  qwen_image_2_0_pro_2026_06_22: PROFILE_QWEN_IMAGE_2,
  qwen_image_2_0: PROFILE_QWEN_IMAGE_2,
};

/** 未登记策略时的回退：Seedream 5.0 lite（当前默认策略能力） */
export const FALLBACK_IMAGE_SIZE_PROFILE = PROFILE_SEEDREAM_5_LITE;

export function getModelImageSizeProfile(strategy: string): ModelImageSizeProfile {
  return STRATEGY_SIZE_PROFILES[strategy] ?? FALLBACK_IMAGE_SIZE_PROFILE;
}

export function listAspectOptions(
  profile: ModelImageSizeProfile,
  resolution: string,
): ImageSizeChoice[] {
  const res =
    profile.sizesByResolution[resolution] ??
    profile.sizesByResolution[profile.defaultResolution] ??
    [];
  return res;
}

export function listResolutionOptions(
  profile: ModelImageSizeProfile,
): ImageResolutionChoice[] {
  return profile.resolutions;
}

/** 详情图优先 9:16；当前档位无该比例时依次回退 2:3 → 3:4 → 模型默认 */
export function defaultAspectForKind(
  strategy: string,
  kind: "main" | "detail",
  resolution?: string,
): string {
  const profile = getModelImageSizeProfile(strategy);
  if (kind !== "detail") return profile.defaultAspect;
  const res =
    resolution && profile.sizesByResolution[resolution]
      ? resolution
      : profile.defaultResolution;
  const aspects = listAspectOptions(profile, res);
  for (const prefer of ["9:16", "2:3", "3:4"] as const) {
    if (aspects.some((a) => a.aspect === prefer)) return prefer;
  }
  return profile.defaultAspect;
}

export function clampSlotImageSize(
  strategy: string,
  aspect_ratio?: string,
  resolution?: string,
  options?: { kind?: "main" | "detail" },
): { aspect_ratio: string; resolution: string } {
  const profile = getModelImageSizeProfile(strategy);
  const res =
    resolution && profile.sizesByResolution[resolution]
      ? resolution
      : profile.defaultResolution;
  const aspects = listAspectOptions(profile, res);
  const fallback = defaultAspectForKind(strategy, options?.kind ?? "main", res);
  const aspect =
    aspect_ratio && aspects.some((a) => a.aspect === aspect_ratio)
      ? aspect_ratio
      : fallback;
  return { aspect_ratio: aspect, resolution: res };
}

export function resolveModelSizeString(
  strategy: string,
  aspect_ratio?: string,
  resolution?: string,
  options?: { kind?: "main" | "detail" },
): string {
  const profile = getModelImageSizeProfile(strategy);
  const clamped = clampSlotImageSize(strategy, aspect_ratio, resolution, options);
  if (profile.sizeFormat === "tier") {
    return clamped.resolution;
  }
  const hit = listAspectOptions(profile, clamped.resolution).find(
    (a) => a.aspect === clamped.aspect_ratio,
  );
  const w = hit?.width ?? 2048;
  const h = hit?.height ?? 2048;
  if (profile.sizeFormat === "qwen") {
    return `${w}*${h}`;
  }
  return `${w}x${h}`;
}

/** 策略切换时，用当前模型默认尺寸初始化 / 校正槽位 */
export function defaultsForStrategy(strategy: string): {
  aspect_ratio: string;
  resolution: string;
} {
  const p = getModelImageSizeProfile(strategy);
  return {
    aspect_ratio: p.defaultAspect,
    resolution: p.defaultResolution,
  };
}

export function strategySupportsImageSize(strategy: string): boolean {
  return strategy in STRATEGY_SIZE_PROFILES || Boolean(strategy);
}

/** 便于 UI 展示当前策略下的能力摘要 */
export function describeSizeProfile(strategy: string): string {
  const p = getModelImageSizeProfile(strategy);
  const res = p.resolutions.map((r) => r.label).join(" / ");
  return `${res} · ${p.source}`;
}

export function findStrategyLabel(
  strategy: string,
  groups: { models: Strategy[] }[],
): string {
  for (const g of groups) {
    const hit = g.models.find((m) => m.value === strategy);
    if (hit) return hit.label;
  }
  return strategy;
}
