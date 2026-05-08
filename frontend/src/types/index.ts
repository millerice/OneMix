export type SlotRow = {
  list_index: number;
  kind: "main" | "detail";
  index: number;
  prompt: string;
  ref_white_index: number;
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
};
