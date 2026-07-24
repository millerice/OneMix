export type SlotRow = {
  list_index: number;
  kind: "main" | "detail";
  index: number;
  prompt: string;
  ref_white_index: number;
  /** 宽高比，如 1:1 / 3:4，对应模型生成尺寸 */
  aspect_ratio?: string;
  /** 分辨率档位：1K / 2K / 3K / 4K */
  resolution?: string;
  export_path?: string | null;
};

export type ServerSettings = {
  has_dashscope_key: boolean;
  dashscope_key_preview?: string | null;
  dashscope_key_updated_at?: string | null;
  has_ark_key?: boolean;
  ark_key_preview?: string | null;
  ark_key_updated_at?: string | null;
};

export type ExtractResponse = {
  merged_text: string;
  extracted_json: Record<string, unknown>;
  source_stats: { file_count: number; image_count: number; text_count: number };
};

export type InfoImageItem = {
  file: File;
  url: string;
};

export type WhiteImageItem = {
  file: File;
  url: string;
};

export type JobResultItem = {
  list_index: number;
  export_path?: string;
};

export type JobState = {
  jobId: string | null;
  status: string;
  progress: { p: number; t: number };
  results: JobResultItem[];
};

export type ResultRefMap = Record<number, string>;

export type Strategy = {
  value: string;
  label: string;
  /** 推理侧真实 model id（便于对照官方文档） */
  modelId?: string;
  /** 生图所需 Key 类型 */
  key?: "ark" | "dashscope";
  /** 是否支持图生图（参考白底图） */
  supportsI2i?: boolean;
  /**
   * 账号开通状态（同步后写入）：
   * open=已开通 / closed=未开通 / unknown=无法判断；未同步则为 undefined
   */
  activation?: "open" | "closed" | "unknown";
  /** @deprecated 使用 activation；true 表示已开通 */
  synced?: boolean;
  /** 模型能力说明（问号提示） */
  description?: string;
};

export type StrategyGroup = {
  id: string;
  label: string;
  models: Strategy[];
};

export type ArkSeedreamModel = {
  strategy: string;
  label: string;
  model_id: string;
  owned: boolean;
  status?: "open" | "closed" | "unknown";
};

export type DashScopeQwenImageModel = {
  strategy: string;
  label: string;
  model_id: string;
  owned: boolean;
};

export type KeyJson = {
  targetAudience?: string[];
  emotionalAssociation?: string[];
  styleTone?: string[];
  goodsName?: string;
  category?: string;
  sellingPoints?: string[];
  [key: string]: unknown;
};
