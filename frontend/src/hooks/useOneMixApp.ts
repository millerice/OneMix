import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import mammoth from "mammoth";
import type {
  SlotRow,
  ServerSettings,
  ExtractResponse,
  WhiteImageItem,
  JobResultItem,
  JobState,
  ResultRefMap,
  KeyJson,
  ArkSeedreamModel,
  DashScopeQwenImageModel,
} from "@/types";
import {
  MAIN_PLAN_TEMPLATE,
  DETAIL_PLAN_TEMPLATE,
  STRATEGY_GROUPS,
  DEFAULT_STRATEGY,
  clampSlotImageSize,
  mergeSyncedModelsIntoGroups,
} from "@/constants";
import { splitCompetitorSummary, normalizedRefWhiteIndex, downloadAuthenticatedFile } from "@/utils";
import { toast } from "sonner";
import type { ResultThumbItem } from "@/components/images/ResultThumbGrid";
import { useApiKeys } from "@/hooks/useApiKeys";

type OcrImageItem = { file: File; url: string };

type GeneratedMainItem = {
  listIndex: number;
  displayIndex: number;
  jobId: string;
  imageUrl: string;
};

function isDigitsOnly(value: string): boolean {
  return /^\d+$/.test(value);
}

function reindexSlots(rows: SlotRow[]): SlotRow[] {
  return rows.map((row, idx) => ({ ...row, list_index: idx }));
}

function withSlotImageDefaults(row: SlotRow, strategy: string): SlotRow {
  const clamped = clampSlotImageSize(strategy, row.aspect_ratio, row.resolution, {
    kind: row.kind,
  });
  return {
    ...row,
    aspect_ratio: clamped.aspect_ratio,
    resolution: clamped.resolution,
  };
}

export function useOneMixApp() {
  const { apiKey, setApiKey, arkKey, setArkKey, headers } = useApiKeys();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [nMain, setNMain] = useState(1);
  const [nDetail, setNDetail] = useState(4);
  const [nMainInput, setNMainInput] = useState("1");
  const [nDetailInput, setNDetailInput] = useState("4");
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  const [arkSyncedModels, setArkSyncedModels] = useState<ArkSeedreamModel[]>(
    [],
  );
  const [qwenSyncedModels, setQwenSyncedModels] = useState<
    DashScopeQwenImageModel[]
  >([]);
  const [syncingStrategies, setSyncingStrategies] = useState(false);
  const strategyGroups = useMemo(
    () =>
      mergeSyncedModelsIntoGroups(
        STRATEGY_GROUPS,
        arkSyncedModels,
        qwenSyncedModels,
      ),
    [arkSyncedModels, qwenSyncedModels],
  );

  const [, setInfoTextFiles] = useState<File[]>([]);
  const [mergedText, setMergedText] = useState("");
  const [keyJson, setKeyJson] = useState<KeyJson | null>(null);

  const [whiteFiles, setWhiteFiles] = useState<File[]>([]);
  const [whiteImageItems, setWhiteImageItems] = useState<WhiteImageItem[]>([]);
  const [whiteViewDescs, setWhiteViewDescs] = useState<string[]>([]);
  const [detailWhiteFiles, setDetailWhiteFiles] = useState<File[]>([]);
  const [detailWhiteImageItems, setDetailWhiteImageItems] = useState<
    WhiteImageItem[]
  >([]);
  const [, setDetailWhiteViewDescs] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState("");
  const [slots, setSlots] = useState<SlotRow[]>([]);

  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [mainJob, setMainJob] = useState<JobState>({
    jobId: null,
    status: "",
    progress: { p: 0, t: 0 },
    results: [],
  });
  const [detailJob, setDetailJob] = useState<JobState>({
    jobId: null,
    status: "",
    progress: { p: 0, t: 0 },
    results: [],
  });
  const [mainResultRefs, setMainResultRefs] = useState<ResultRefMap>({});
  const [detailResultRefs, setDetailResultRefs] = useState<ResultRefMap>({});
  const [activePlanKind, setActivePlanKind] = useState<
    "main" | "detail" | null
  >(null);
  const [collapseMainPanel, setCollapseMainPanel] = useState(false);
  const [collapseDetailPanel, setCollapseDetailPanel] = useState(false);
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(
    null,
  );
  const [isStep2DragOver, setIsStep2DragOver] = useState(false);
  const [isStep3DragOver, setIsStep3DragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [resultViewMode, setResultViewMode] = useState<"structured" | "json">(
    "structured",
  );
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrImages, setOcrImages] = useState<File[]>([]);
  const [ocrImageItems, setOcrImageItems] = useState<OcrImageItem[]>([]);
  const [ocrResult, setOcrResult] = useState("");
  const [isOcrDragOver, setIsOcrDragOver] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingKey, setEditingKey] = useState<"dashscope" | "ark" | null>(
    null,
  );
  const [showMainImageLibrary, setShowMainImageLibrary] = useState(false);
  const [selectedMainImages, setSelectedMainImages] = useState<number[]>([]);
  const [activeImageTab, setActiveImageTab] = useState<
    "generated" | "uploaded"
  >("generated");

  const notify = useCallback((s: string) => {
    toast.warning(s);
  }, []);

  const appendLog = useCallback(
    (s: string) => {
      setLog((prev) => (prev + s + "\n").slice(-10000));
      if (s.includes("请先") || s.includes("失败") || s.includes("错误")) {
        notify(s);
      }
    },
    [notify],
  );

  const loadServerSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as ServerSettings;
      setServerSettings(j);
    } catch (err) {
      console.error("Failed to load server settings:", err);
      setServerSettings(null);
    }
  }, []);

  useEffect(() => {
    void loadServerSettings();
  }, [loadServerSettings]);

  useEffect(() => {
    // 不再自动打开编辑状态，让用户手动点击添加
  }, [showSettings, serverSettings, editingKey]);

  useEffect(() => {
    return () => {
      whiteImageItems.forEach((it) => URL.revokeObjectURL(it.url));
      detailWhiteImageItems.forEach((it) => URL.revokeObjectURL(it.url));
      ocrImageItems.forEach((it) => URL.revokeObjectURL(it.url));
    };
  }, []);

  useEffect(() => {
    const len = whiteImageItems.length;
    if (!len) return;
    setSlots((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const clamped = normalizedRefWhiteIndex(s.ref_white_index, len);
        if (clamped !== s.ref_white_index) {
          changed = true;
          return { ...s, ref_white_index: clamped };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [whiteImageItems.length]);

  const runJson = async (url: string, init: RequestInit) => {
    const r = await fetch(url, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
    if (!r.ok) {
      throw new Error((await r.text()) || r.statusText);
    }
    return r.json();
  };

  const onAddTextFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setInfoTextFiles((prev) => [...prev, ...files]);
    const blocks: string[] = [];
    for (const f of files) {
      try {
        let txt = "";
        if (f.name.endsWith(".docx")) {
          const result = await mammoth.extractRawText({
            arrayBuffer: await f.arrayBuffer(),
          });
          txt = result.value.trim();
        } else {
          txt = (await f.text()).trim();
        }
        if (txt) blocks.push(`## 文件: ${f.name}\n${txt}`);
      } catch (e) {
        appendLog(`读取文本文件失败 ${f.name}: ${e}`);
      }
    }
    if (blocks.length > 0) {
      setMergedText((prev) =>
        [prev.trim(), ...blocks].filter(Boolean).join("\n\n"),
      );
      appendLog(`已导入 ${blocks.length} 个文本文件到合并文本。`);
    }
  }, [appendLog]);

  const onUploadTextFilesClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".txt,.md,.csv,.json,.log,.docx";
    input.onchange = (e) =>
      void onAddTextFiles((e.target as HTMLInputElement).files);
    input.click();
  }, [onAddTextFiles]);

  const onSelectWhiteFiles = (fileList: FileList | null) => {
    whiteImageItems.forEach((it) => URL.revokeObjectURL(it.url));
    if (!fileList || fileList.length === 0) {
      setWhiteFiles([]);
      setWhiteImageItems([]);
      setWhiteViewDescs([]);
      return;
    }
    const files = Array.from(fileList);
    setWhiteFiles(files);
    setWhiteImageItems(
      files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    );
    setWhiteViewDescs((prev) => files.map((_, i) => prev[i] ?? ""));
  };

  const onSelectDetailWhiteFiles = (fileList: FileList | null) => {
    detailWhiteImageItems.forEach((it) => URL.revokeObjectURL(it.url));
    if (!fileList || fileList.length === 0) {
      setDetailWhiteFiles([]);
      setDetailWhiteImageItems([]);
      setDetailWhiteViewDescs([]);
      return;
    }
    const files = Array.from(fileList);
    setDetailWhiteFiles(files);
    setDetailWhiteImageItems(
      files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    );
    setDetailWhiteViewDescs((prev) => files.map((_, i) => prev[i] ?? ""));
  };

  const onRemoveWhiteFileAt = useCallback((index: number) => {
    setWhiteImageItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item) URL.revokeObjectURL(item.url);
      next.splice(index, 1);
      return next;
    });
    setWhiteFiles((prev) => prev.filter((_, i) => i !== index));
    setWhiteViewDescs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onReplaceWhiteFileAt = useCallback(
    (index: number, file: File | null) => {
      if (!file) return;
      const nextUrl = URL.createObjectURL(file);
      setWhiteImageItems((prev) => {
        const next = [...prev];
        const old = next[index];
        if (!old) return prev;
        URL.revokeObjectURL(old.url);
        next[index] = { file, url: nextUrl };
        return next;
      });
      setWhiteFiles((prev) => prev.map((f, i) => (i === index ? file : f)));
    },
    [],
  );

  const onRemoveDetailWhiteAt = useCallback((index: number) => {
    setDetailWhiteImageItems((prev) => {
      const next = [...prev];
      const itemToRemove = next[index];
      if (itemToRemove) URL.revokeObjectURL(itemToRemove.url);
      next.splice(index, 1);
      return next;
    });
    setDetailWhiteFiles((prev) => prev.filter((_, i) => i !== index));
    setDetailWhiteViewDescs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onReplaceDetailWhiteAt = useCallback(
    (index: number, file: File | null) => {
      if (!file) return;
      const nextUrl = URL.createObjectURL(file);
      setDetailWhiteImageItems((prev) => {
        const next = [...prev];
        const old = next[index];
        if (!old) return prev;
        URL.revokeObjectURL(old.url);
        next[index] = { file, url: nextUrl };
        return next;
      });
      setDetailWhiteFiles((prev) => prev.map((f, i) => (i === index ? file : f)));
    },
    [],
  );

  const refreshWhitePreviewUrl = useCallback((index: number) => {
    setWhiteImageItems((prev) => {
      const item = prev[index];
      if (!item) return prev;
      URL.revokeObjectURL(item.url);
      const url = URL.createObjectURL(item.file);
      const next = [...prev];
      next[index] = { file: item.file, url };
      return next;
    });
  }, []);

  const refreshDetailPreviewUrl = useCallback((index: number) => {
    setDetailWhiteImageItems((prev) => {
      const item = prev[index];
      if (!item) return prev;
      URL.revokeObjectURL(item.url);
      const url = URL.createObjectURL(item.file);
      const next = [...prev];
      next[index] = { file: item.file, url };
      return next;
    });
  }, []);

  const addGeneratedImageToWhites = useCallback(
    async (target: "main" | "detail", imageUrl: string, imageName: string) => {
      const existingFiles = target === "main" ? whiteFiles : detailWhiteFiles;
      const isDuplicate = (file: File) =>
        existingFiles.some(
          (existing) =>
            existing.name === file.name && existing.size === file.size,
        );
      try {
        const r = await fetch(imageUrl, { headers });
        if (!r.ok) throw new Error(await r.text());
        const blob = await r.blob();
        const ext = blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
        const safeName = imageName.includes(".")
          ? imageName
          : `${imageName}.${ext}`;
        const file = new File([blob], safeName, {
          type: blob.type || "image/jpeg",
        });
        if (isDuplicate(file)) {
          appendLog(
            `已跳过重复图片（同名同大小）：${safeName}，未重复添加到${target === "main" ? "主图" : "详情图"}白底区。`,
          );
          return;
        }
        const item = { file, url: URL.createObjectURL(file) };
        if (target === "main") {
          setWhiteFiles((prev) => [...prev, file]);
          setWhiteImageItems((prev) => [...prev, item]);
          setWhiteViewDescs((prev) => [...prev, ""]);
        } else {
          setDetailWhiteFiles((prev) => [...prev, file]);
          setDetailWhiteImageItems((prev) => [...prev, item]);
          setDetailWhiteViewDescs((prev) => [...prev, ""]);
        }
        appendLog(
          `已将生成图加入${target === "main" ? "主图" : "详情图"}白底图：${safeName}`,
        );
      } catch (err) {
        appendLog(`加入白底图失败：${err}`);
      }
    },
    [appendLog, detailWhiteFiles, headers, whiteFiles],
  );

  const onDropToWhites = useCallback(
    async (e: DragEvent<HTMLDivElement>, target: "main" | "detail") => {
      e.preventDefault();
      if (target === "main") setIsStep2DragOver(false);
      else setIsStep3DragOver(false);

      const existingFiles = target === "main" ? whiteFiles : detailWhiteFiles;
      const isDuplicate = (file: File) =>
        existingFiles.some(
          (existing) =>
            existing.name === file.name && existing.size === file.size,
        );

      const droppedFiles = Array.from(e.dataTransfer.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (droppedFiles.length > 0) {
        const uniqueFiles = droppedFiles.filter((file) => !isDuplicate(file));
        const skippedCount = droppedFiles.length - uniqueFiles.length;
        if (!uniqueFiles.length) {
          appendLog(
            `拖拽图片已全部存在（同名同大小），未添加到${target === "main" ? "主图" : "详情图"}白底区。`,
          );
          return;
        }
        const items = uniqueFiles.map((file) => ({
          file,
          url: URL.createObjectURL(file),
        }));
        if (target === "main") {
          setWhiteFiles((prev) => [...prev, ...uniqueFiles]);
          setWhiteImageItems((prev) => [...prev, ...items]);
          setWhiteViewDescs((prev) => [...prev, ...uniqueFiles.map(() => "")]);
        } else {
          setDetailWhiteFiles((prev) => [...prev, ...uniqueFiles]);
          setDetailWhiteImageItems((prev) => [...prev, ...items]);
          setDetailWhiteViewDescs((prev) => [
            ...prev,
            ...uniqueFiles.map(() => ""),
          ]);
        }
        appendLog(
          `已通过拖拽添加 ${uniqueFiles.length} 张图片到${target === "main" ? "主图" : "详情图"}白底区。${skippedCount > 0 ? `（跳过重复 ${skippedCount} 张）` : ""}`,
        );
        return;
      }

      const imageUrl =
        e.dataTransfer.getData("text/onemix-result-url") ||
        e.dataTransfer.getData("text/plain");
      if (!imageUrl) return;
      const imageName =
        e.dataTransfer.getData("text/onemix-result-name") ||
        `generated_${Date.now()}.jpg`;
      try {
        const r = await fetch(imageUrl, { headers });
        if (!r.ok) throw new Error(await r.text());
        const blob = await r.blob();
        const ext = blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
        const safeName = imageName.includes(".")
          ? imageName
          : `${imageName}.${ext}`;
        const file = new File([blob], safeName, {
          type: blob.type || "image/jpeg",
        });
        if (isDuplicate(file)) {
          appendLog(
            `已跳过重复图片（同名同大小）：${safeName}，未重复添加到${target === "main" ? "主图" : "详情图"}白底区。`,
          );
          return;
        }
        const item = { file, url: URL.createObjectURL(file) };
        if (target === "main") {
          setWhiteFiles((prev) => [...prev, file]);
          setWhiteImageItems((prev) => [...prev, item]);
          setWhiteViewDescs((prev) => [...prev, ""]);
        } else {
          setDetailWhiteFiles((prev) => [...prev, file]);
          setDetailWhiteImageItems((prev) => [...prev, item]);
          setDetailWhiteViewDescs((prev) => [...prev, ""]);
        }
        appendLog(
          `已将生成图拖拽加入${target === "main" ? "主图" : "详情图"}白底图：${safeName}`,
        );
      } catch (err) {
        appendLog(`拖拽加入白底图失败：${err}`);
      }
    },
    [appendLog, headers, whiteFiles, detailWhiteFiles],
  );

  const onExtractKeyInfo = async () => {
    if (!mergedText.trim()) {
      appendLog("请先补全「合并文本（可编辑）」，再提取关键信息。");
      return;
    }
    if (!serverSettings) {
      appendLog("正在加载服务器设置，请稍候...");
      return;
    }
    if (!serverSettings.has_dashscope_key && !serverSettings.has_ark_key) {
      appendLog(
        "请先在右上角设置中配置API Key（阿里百炼或即梦ARK），再提取关键信息。",
      );
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append(
        "files",
        new File([mergedText], "merged_text.txt", { type: "text/plain" }),
      );
      const r = await fetch("/api/extract/key-info", {
        method: "POST",
        headers,
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as ExtractResponse;
      setKeyJson(j.extracted_json as KeyJson);
      const base =
        (j.extracted_json["商品基础身份"] as
          | Record<string, unknown>
          | undefined) ?? {};
      const productName = String(
        base["商品全称"] ?? base["商品名称"] ?? "",
      ).trim();
      if (productName) setName(productName);
      setDesc(j.merged_text);
      appendLog("关键信息提取完成。");
    } catch (e) {
      appendLog(`关键信息提取失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const buildUserRequirements = (target: "main" | "detail") => {
    const keyInfo = keyJson
      ? JSON.stringify(keyJson, null, 2)
      : "（未提取到商品详细信息）";
    const whiteDesc = whiteFiles.length
      ? whiteFiles
          .map((f, i) => {
            const view = (whiteViewDescs[i] || "").trim() || "未填写视角";
            return `图${i + 1}（${view}）：${f.name}`;
          })
          .join("；")
      : "（未上传）";
    const targetCount = target === "main" ? nMain : nDetail;
    return [
      `商品详细信息(JSON)：\n${keyInfo}`,
      `白底图数量：${whiteFiles.length}`,
      `白底图视角描述：${whiteDesc}`,
      `要求生成数量：${targetCount}`,
      `参考上传图片：${whiteDesc}`,
      "特殊要求：无",
    ].join("\n");
  };

  const onPlanByKind = async (target: "main" | "detail") => {
    if (!name.trim()) {
      appendLog("请先完成步骤一提取，或手动填写商品名称。");
      return;
    }
    const planWhites =
      target === "main"
        ? whiteFiles
        : detailWhiteFiles.length > 0
          ? detailWhiteFiles
          : whiteFiles;
    if (!planWhites.length) {
      appendLog("请至少上传一张白底商品图（将结合参考图生成提示词）。\n");
      return;
    }
    setActivePlanKind(target);
    setBusy(true);
    try {
      const { base, comp } = splitCompetitorSummary(desc);
      const isMain = target === "main";
      const fd = new FormData();
      fd.append(
        "plan",
        JSON.stringify({
          product_name: name.trim(),
          product_desc: base,
          competitor_summary: comp,
          n_main: isMain ? nMain : 0,
          n_detail: isMain ? 0 : nDetail,
          strategy,
          n_white_images: Math.max(1, planWhites.length),
          custom_template: isMain ? MAIN_PLAN_TEMPLATE : DETAIL_PLAN_TEMPLATE,
          user_requirements: buildUserRequirements(target),
        }),
      );
      planWhites.forEach((f) => fd.append("whites", f));
      const j = await runJson("/api/plan/slots", {
        method: "POST",
        body: fd,
      });
      const raw = ((j as { slots: SlotRow[] }).slots || []).map((s) =>
        withSlotImageDefaults(s, strategy),
      );
      if (isMain) {
        setSlots((prev) => {
          const details = prev.filter((s) => s.kind === "detail");
          return reindexSlots([...raw, ...details]);
        });
      } else {
        setSlots((prev) => {
          const mains = prev.filter((s) => s.kind === "main");
          return reindexSlots([...mains, ...raw]);
        });
      }
      appendLog(
        `已结合 ${planWhites.length} 张参考图生成${isMain ? "主图" : "详情图"} ${raw.length} 个提示词（qwen-vl-plus）。`,
      );
    } catch (e) {
      appendLog(`生成${target === "main" ? "主图" : "详情图"}失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const updateSlotPrompt = (listIndex: number, prompt: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.list_index === listIndex ? { ...s, prompt } : s)),
    );
  };

  const updateSlotRef = (listIndex: number, ref_white_index: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.list_index === listIndex ? { ...s, ref_white_index } : s,
      ),
    );
  };

  const updateSlotAspect = (listIndex: number, aspect_ratio: string) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.list_index === listIndex ? { ...s, aspect_ratio } : s,
      ),
    );
  };

  const updateSlotResolution = (listIndex: number, resolution: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.list_index !== listIndex) return s;
        const clamped = clampSlotImageSize(strategy, s.aspect_ratio, resolution, {
          kind: s.kind,
        });
        return {
          ...s,
          resolution: clamped.resolution,
          aspect_ratio: clamped.aspect_ratio,
        };
      }),
    );
  };

  const batchUpdateSlotImageSize = (
    kind: "main" | "detail",
    aspect_ratio: string,
    resolution: string,
  ) => {
    const clamped = clampSlotImageSize(strategy, aspect_ratio, resolution, {
      kind,
    });
    setSlots((prev) =>
      prev.map((s) =>
        s.kind === kind
          ? {
              ...s,
              aspect_ratio: clamped.aspect_ratio,
              resolution: clamped.resolution,
            }
          : s,
      ),
    );
  };

  const setStrategyAndClampSlots = (next: string) => {
    setStrategy(next);
    setSlots((prev) =>
      prev.map((s) => {
        const clamped = clampSlotImageSize(next, s.aspect_ratio, s.resolution, {
          kind: s.kind,
        });
        return {
          ...s,
          aspect_ratio: clamped.aspect_ratio,
          resolution: clamped.resolution,
        };
      }),
    );
  };

  const mainSlots = slots.filter((s) => s.kind === "main");
  const detailSlots = slots.filter((s) => s.kind === "detail");
  const mainResultMap = new Map(
    Object.entries(mainResultRefs).map(([k, jobId]) => [Number(k), jobId]),
  );
  const detailResultMap = new Map(
    Object.entries(detailResultRefs).map(([k, jobId]) => [Number(k), jobId]),
  );
  const generatedMainItems: GeneratedMainItem[] = mainSlots
    .filter((s) => mainResultMap.has(s.list_index))
    .map((s) => {
      const jobId = mainResultMap.get(s.list_index);
      if (!jobId) return null;
      return {
        listIndex: s.list_index,
        displayIndex: s.index,
        jobId,
        imageUrl: `/api/jobs/${jobId}/result/${s.list_index}`,
      };
    })
    .filter(Boolean) as GeneratedMainItem[];

  const onRefineSlotPrompt = async (listIndex: number) => {
    const slot = slots.find((s) => s.list_index === listIndex);
    if (!slot) return;
    const refineWhites =
      slot.kind === "main"
        ? whiteFiles
        : detailWhiteFiles.length > 0
          ? detailWhiteFiles
          : whiteFiles;
    if (!refineWhites.length) {
      appendLog("请至少上传一张白底商品图，以便结合参考图重构提示词。\n");
      return;
    }
    setBusy(true);
    try {
      const { base, comp } = splitCompetitorSummary(desc);
      const fd = new FormData();
      fd.append(
        "plan",
        JSON.stringify({
          product_name: name.trim(),
          product_desc: base,
          competitor_summary: comp,
          kind: slot.kind,
          index: slot.index,
          strategy,
          old_prompt: slot.prompt,
          ref_white_index: slot.ref_white_index ?? 0,
        }),
      );
      refineWhites.forEach((f) => fd.append("whites", f));
      const j = await runJson("/api/plan/single", {
        method: "POST",
        body: fd,
      });
      const prompt = ((j as { prompt: string }).prompt || "").trim();
      if (prompt) {
        updateSlotPrompt(listIndex, prompt);
        appendLog(`图片 #${listIndex} 提示词重构完成（已结合参考图）。`);
      }
    } catch (e) {
      appendLog(`重构失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const pollJob = async (id: string, kind: "main" | "detail") => {
    for (let i = 0; i < 7200; i++) {
      const r = await fetch(`/api/jobs/${id}`, { headers });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as {
        status: string;
        progress: number;
        total: number;
        error?: string | null;
        results?: JobResultItem[] | null;
      };
      const next: JobState = {
        jobId: id,
        status: j.status,
        progress: { p: j.progress, t: j.total },
        results: j.results ?? [],
      };
      if (kind === "main") setMainJob(next);
      else setDetailJob(next);
      if (j.status === "completed") return j.results ?? [];
      if (j.status === "failed") throw new Error(j.error || "任务失败");
      await new Promise((res) => setTimeout(res, 1500));
    }
    throw new Error("轮询超时");
  };

  const onGenerate = async (
    kind: "main" | "detail",
    onlyIndices: number[] | null = null,
  ) => {
    const sourceWhiteFiles =
      kind === "main"
        ? whiteFiles
        : detailWhiteFiles.length > 0
          ? detailWhiteFiles
          : whiteFiles;
    const targetSlots = slots.filter((s) => s.kind === kind);
    if (!sourceWhiteFiles.length || !targetSlots.length) {
      appendLog("请先上传白底图并生成提示词。");
      return;
    }
    setBusy(true);
    setActivePlanKind(kind);
    const touchedIndices = (
      onlyIndices ?? targetSlots.map((s) => s.list_index)
    ).map((i) => Number(i));
    if (kind === "main") {
      setMainJob((prev) => ({
        ...prev,
        jobId: null,
        status: "",
        progress: { p: 0, t: 0 },
        results: prev.results,
      }));
    } else {
      setDetailJob((prev) => ({
        ...prev,
        jobId: null,
        status: "",
        progress: { p: 0, t: 0 },
        results: prev.results,
      }));
    }
    try {
      const jobPayload = {
        slot_jobs: targetSlots.map((s) => {
          const clamped = clampSlotImageSize(
            strategy,
            s.aspect_ratio,
            s.resolution,
            { kind: s.kind },
          );
          return {
            list_index: s.list_index,
            kind: s.kind,
            index: s.index,
            prompt: s.prompt,
            export_path: null,
            ref_image_path: null,
            ref_white_index: s.ref_white_index,
            aspect_ratio: clamped.aspect_ratio,
            resolution: clamped.resolution,
          };
        }),
        fmt: "JPG",
        strategy,
        only_indices: onlyIndices,
        skip_done: true,
      };
      const fd = new FormData();
      fd.append("job", JSON.stringify(jobPayload));
      sourceWhiteFiles.forEach((f) => fd.append("whites", f));
      const r = await fetch("/api/jobs", { method: "POST", headers, body: fd });
      if (!r.ok) throw new Error(await r.text());
      const created = (await r.json()) as { id: string };
      if (kind === "main")
        setMainJob((prev) => ({ ...prev, jobId: created.id }));
      else setDetailJob((prev) => ({ ...prev, jobId: created.id }));
      appendLog(`任务已创建：${created.id}`);
      const completedResults = (await pollJob(
        created.id,
        kind,
      )) as JobResultItem[];
      const completedSet = new Set(completedResults.map((r) => r.list_index));
      const succeededIndices = touchedIndices.filter((idx) =>
        completedSet.has(idx),
      );
      if (kind === "main") {
        setMainResultRefs((prev) => {
          const next = { ...prev };
          for (const idx of succeededIndices) next[idx] = created.id;
          return next;
        });
      } else {
        setDetailResultRefs((prev) => {
          const next = { ...prev };
          for (const idx of succeededIndices) next[idx] = created.id;
          return next;
        });
      }
      appendLog(
        `${kind === "main" ? "主图" : "详情图"}${onlyIndices?.length ? `（图片 ${onlyIndices.join(",")}）` : ""}生成完成，可下载 ZIP。\n`,
      );
    } catch (e) {
      appendLog(
        `${kind === "main" ? "主图" : "详情图"}${onlyIndices?.length ? `（图片 ${onlyIndices.join(",")}）` : ""}生成失败：${e}`,
      );
      if (kind === "main") setMainJob((prev) => ({ ...prev, status: "error" }));
      else setDetailJob((prev) => ({ ...prev, status: "error" }));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadZip = (kind: "main" | "detail") => {
    const targetJobId = kind === "main" ? mainJob.jobId : detailJob.jobId;
    if (!targetJobId) {
      appendLog("暂无可打包下载的任务。\n");
      toast.warning("暂无批量下载任务");
      return;
    }
    void downloadAuthenticatedFile(
      `/api/jobs/${targetJobId}/bundle`,
      `onemix_${kind}_${targetJobId}.zip`,
      headers,
    )
      .then(() => appendLog(`已开始批量下载 ${kind === "main" ? "主图" : "详情图"} ZIP。\n`))
      .catch((e) => {
        appendLog(`批量下载失败：${e}`);
        toast.error("批量下载失败");
      });
  };

  const onDownloadOneResult = useCallback(
    (kind: "main" | "detail", item: ResultThumbItem) => {
      const safeLabel = item.label.replace(/\s+/g, "_");
      const filename = `onemix_${kind}_${safeLabel}.jpg`;
      void downloadAuthenticatedFile(item.imageUrl, filename, headers)
        .then(() => appendLog(`已下载：${filename}\n`))
        .catch((e) => {
          appendLog(`单张下载失败：${e}`);
          toast.error("单张下载失败");
        });
    },
    [appendLog, headers],
  );

  const onSaveKeyToServer = async () => {
    if (!apiKey.trim()) {
      appendLog("请先输入 API Key。\n");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/settings/dashscope-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      appendLog("已保存服务端默认 Key。\n");
      await loadServerSettings();
    } catch (e) {
      appendLog(`保存失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const onClearServerKey = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/settings/dashscope-key", {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      appendLog("已清除服务端默认 Key。\n");
      await loadServerSettings();
    } catch (e) {
      appendLog(`清除失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const onSaveArkKeyToServer = async () => {
    if (!arkKey.trim()) {
      appendLog("请先输入即梦 ARK Key。\n");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/settings/ark-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: arkKey.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      appendLog("已保存服务端默认即梦 Key。\n");
      await loadServerSettings();
    } catch (e) {
      appendLog(`保存即梦 Key 失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const onClearArkServerKey = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/settings/ark-key", { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      appendLog("已清除服务端默认即梦 Key。\n");
      await loadServerSettings();
    } catch (e) {
      appendLog(`清除即梦 Key 失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const onSyncArkSeedreamModels = useCallback(async () => {
    if (!arkKey.trim() && !serverSettings?.has_ark_key) {
      appendLog("请先配置即梦 ARK Key，再同步豆包模型。\n");
      toast.warning("请先配置即梦 ARK Key");
      return;
    }
    setSyncingStrategies(true);
    try {
      const r = await fetch("/api/settings/ark-seedream-models", {
        method: "GET",
        headers,
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { models: ArkSeedreamModel[] };
      setArkSyncedModels(j.models || []);
      const models = j.models || [];
      const openN = models.filter((m) => (m.status ?? (m.owned ? "open" : "closed")) === "open").length;
      const closedN = models.filter(
        (m) => (m.status ?? (m.owned ? "open" : "closed")) === "closed",
      ).length;
      appendLog(
        `已探测豆包 Seedream：已开通 ${openN}，未开通 ${closedN}（共 ${models.length}）。\n`,
      );
      toast.success(`豆包：已开通 ${openN} / 未开通 ${closedN}`);
    } catch (e) {
      appendLog(`同步豆包模型失败：${e}`);
      toast.error("同步豆包模型失败");
    } finally {
      setSyncingStrategies(false);
    }
  }, [appendLog, arkKey, headers, serverSettings?.has_ark_key]);

  const onSyncQwenImageModels = useCallback(async () => {
    if (!apiKey.trim() && !serverSettings?.has_dashscope_key) {
      appendLog("请先配置阿里百炼 Key，再同步千问模型。\n");
      toast.warning("请先配置阿里百炼 Key");
      return;
    }
    setSyncingStrategies(true);
    try {
      const r = await fetch("/api/settings/dashscope-qwen-image-models", {
        method: "GET",
        headers,
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { models: DashScopeQwenImageModel[] };
      setQwenSyncedModels(j.models || []);
      const n = (j.models || []).length;
      appendLog(`已同步千问 Qwen-Image 模型 ${n} 个。\n`);
      toast.success(`已同步 ${n} 个千问图像模型`);
    } catch (e) {
      appendLog(`同步千问模型失败：${e}`);
      toast.error("同步千问模型失败");
    } finally {
      setSyncingStrategies(false);
    }
  }, [appendLog, apiKey, headers, serverSettings?.has_dashscope_key]);

  const onSyncGenerationModels = useCallback(async () => {
    const canArk = !!arkKey.trim() || !!serverSettings?.has_ark_key;
    const canDs = !!apiKey.trim() || !!serverSettings?.has_dashscope_key;
    if (!canArk && !canDs) {
      appendLog("请先配置豆包 ARK 或阿里百炼 Key，再同步模型开通状态。\n");
      toast.warning("请先配置 API Key");
      return;
    }
    setSyncingStrategies(true);
    const notes: string[] = [];
    try {
      if (canArk) {
        try {
          const r = await fetch("/api/settings/ark-seedream-models", {
            method: "GET",
            headers,
          });
          if (!r.ok) throw new Error(await r.text());
          const j = (await r.json()) as { models: ArkSeedreamModel[] };
          setArkSyncedModels(j.models || []);
          const openN = (j.models || []).filter(
            (m) => (m.status ?? (m.owned ? "open" : "closed")) === "open",
          ).length;
          const closedN = (j.models || []).filter(
            (m) => (m.status ?? (m.owned ? "open" : "closed")) === "closed",
          ).length;
          notes.push(`豆包 ${openN}开/${closedN}未开`);
        } catch (e) {
          appendLog(`同步豆包模型失败：${e}`);
          notes.push("豆包失败");
        }
      }
      if (canDs) {
        try {
          const r = await fetch("/api/settings/dashscope-qwen-image-models", {
            method: "GET",
            headers,
          });
          if (!r.ok) throw new Error(await r.text());
          const j = (await r.json()) as { models: DashScopeQwenImageModel[] };
          setQwenSyncedModels(j.models || []);
          notes.push(`千问 ${j.models?.length ?? 0}`);
        } catch (e) {
          appendLog(`同步千问模型失败：${e}`);
          notes.push("千问失败");
        }
      }
      appendLog(`模型开通状态已同步（${notes.join("，")}）。\n`);
      toast.success(`同步完成：${notes.join("，")}`);
    } finally {
      setSyncingStrategies(false);
    }
  }, [
    apiKey,
    appendLog,
    arkKey,
    headers,
    serverSettings?.has_ark_key,
    serverSettings?.has_dashscope_key,
  ]);

  const appendOcrFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setOcrImages((prev) => [...prev, ...files]);
    const newItems = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setOcrImageItems((prev) => [...prev, ...newItems]);
  }, []);

  const onOpenOcrModal = useCallback(() => {
    setShowOcrModal(true);
  }, []);

  const onCloseOcrModal = useCallback(() => {
    setShowOcrModal(false);
  }, []);

  const onOcrDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOcrDragOver(true);
  }, []);

  const onOcrDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isOcrDragOver) setIsOcrDragOver(true);
    },
    [isOcrDragOver],
  );

  const onOcrDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsOcrDragOver(false);
    }
  }, []);

  const onOcrDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOcrDragOver(false);
      if (e.dataTransfer.files) {
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/"),
        );
        appendOcrFiles(files);
      }
    },
    [appendOcrFiles],
  );

  const onOcrFileInputChange = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList || []);
      appendOcrFiles(files);
    },
    [appendOcrFiles],
  );

  const onRemoveOcrImageAt = useCallback((index: number) => {
    setOcrImages((prev) => prev.filter((_, i) => i !== index));
    setOcrImageItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onOcrRecognize = useCallback(async () => {
    setBusy(true);
    try {
      const chunks: string[] = [];
      for (const file of ocrImages) {
        const formData = new FormData();
        formData.append("image", file);
        const r = await fetch("/api/ocr", {
          method: "POST",
          headers,
          body: formData,
        });
        if (!r.ok) {
          throw new Error((await r.text()) || "OCR failed");
        }
        const data = (await r.json()) as { text?: string };
        const text = (data.text || "").trim();
        if (text) {
          chunks.push(text);
        }
      }
      setOcrResult(chunks.join("\n\n"));
    } catch (err) {
      console.error("OCR error:", err);
      setOcrResult(
        `OCR识别失败：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }, [headers, ocrImages]);

  const onConfirmOcr = useCallback(() => {
    const next = ocrResult.trim();
    if (next) {
      setMergedText((prev) => {
        const base = prev.trimEnd();
        return base ? `${base}\n\n${next}` : next;
      });
    }
    setShowOcrModal(false);
    setOcrImages([]);
    setOcrImageItems([]);
    setOcrResult("");
  }, [ocrResult]);

  const onOpenPreview = useCallback((url: string, name: string) => {
    setPreviewImageUrl(url);
    setPreviewImageName(name);
  }, []);

  const onClosePreview = useCallback(() => {
    setPreviewImageUrl(null);
  }, []);

  const onStep2DragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsStep2DragOver(true);
  }, []);

  const onStep2DragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isStep2DragOver) setIsStep2DragOver(true);
    },
    [isStep2DragOver],
  );

  const onStep2DragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsStep2DragOver(false);
    }
  }, []);

  const onStep3DragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsStep3DragOver(true);
  }, []);

  const onStep3DragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isStep3DragOver) setIsStep3DragOver(true);
    },
    [isStep3DragOver],
  );

  const onStep3DragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsStep3DragOver(false);
    }
  }, []);

  const onStep3Drop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      setIsStep3DragOver(false);
      void onDropToWhites(e, "detail");
    },
    [onDropToWhites],
  );

  const onNMainInputChange = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      setNMainInput("");
      return;
    }
    if (isDigitsOnly(trimmed)) {
      setNMainInput(trimmed);
      setNMain(Number(trimmed));
    }
  }, []);

  const onNDetailInputChange = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      setNDetailInput("");
      return;
    }
    if (isDigitsOnly(trimmed)) {
      setNDetailInput(trimmed);
      setNDetail(Number(trimmed));
    }
  }, []);

  const onOpenMainImageLibrary = useCallback(() => {
    setActiveImageTab("generated");
    setSelectedMainImages([]);
    setShowMainImageLibrary(true);
  }, []);

  const onCloseMainImageLibrary = useCallback(() => {
    setShowMainImageLibrary(false);
  }, []);

  const onMainImageTabGenerated = useCallback(() => {
    if (activeImageTab !== "generated") {
      setSelectedMainImages([]);
      setActiveImageTab("generated");
    }
  }, [activeImageTab]);

  const onMainImageTabUploaded = useCallback(() => {
    if (activeImageTab !== "uploaded") {
      setSelectedMainImages([]);
      setActiveImageTab("uploaded");
    }
  }, [activeImageTab]);

  const onToggleMainImageSelection = useCallback(
    (index: number) => {
      if (selectedMainImages.includes(index)) {
        setSelectedMainImages(selectedMainImages.filter((i) => i !== index));
      } else {
        setSelectedMainImages([...selectedMainImages, index]);
      }
    },
    [selectedMainImages],
  );

  const onConfirmMainImageLibrary = useCallback(async () => {
    if (activeImageTab === "generated") {
      const selectedImageIndices = [...selectedMainImages];
      if (selectedImageIndices.length > 0) {
        const fetchedItems = await Promise.all(
          selectedImageIndices.map(async (index) => {
            const selected = generatedMainItems[index];
            if (!selected) return null;
            const resp = await fetch(selected.imageUrl, { headers });
            if (!resp.ok) throw new Error(await resp.text());
            const blob = await resp.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const file = new File(
              [blob],
              `generated_${selected.displayIndex}.${ext}`,
              { type: blob.type || "image/jpeg" },
            );
            return {
              file,
              url: URL.createObjectURL(file),
            };
          }),
        );
        const newItems = fetchedItems.filter(Boolean) as WhiteImageItem[];

        setDetailWhiteFiles((prev) => [
          ...prev,
          ...newItems.map((item) => item.file),
        ]);
        setDetailWhiteImageItems((prev) => [...prev, ...newItems]);
        setDetailWhiteViewDescs((prev) => [
          ...prev,
          ...selectedImageIndices.map(() => ""),
        ]);
      }
    } else {
      const selectedImages = selectedMainImages
        .map((index) => {
          const item = whiteImageItems[index];
          if (!item) return null;
          const newUrl = URL.createObjectURL(item.file);
          return {
            file: item.file,
            url: newUrl,
          };
        })
        .filter(Boolean) as WhiteImageItem[];

      if (selectedImages.length > 0) {
        setDetailWhiteFiles((prev) => [
          ...prev,
          ...selectedImages.map((item) => item.file),
        ]);
        setDetailWhiteImageItems((prev) => [...prev, ...selectedImages]);
        setDetailWhiteViewDescs((prev) => [
          ...prev,
          ...selectedImages.map(() => ""),
        ]);
      }
    }

    setSelectedMainImages([]);
    setShowMainImageLibrary(false);
  }, [
    activeImageTab,
    generatedMainItems,
    headers,
    selectedMainImages,
    whiteImageItems,
  ]);

  const onMainResultDragStart = useCallback(
    (e: DragEvent<HTMLElement>, imageUrl: string, displayIndex: number) => {
      e.dataTransfer.setData("text/plain", imageUrl);
      e.dataTransfer.setData("text/onemix-result-url", imageUrl);
      e.dataTransfer.setData(
        "text/onemix-result-name",
        `主图_${displayIndex}.jpg`,
      );
    },
    [],
  );

  const onDetailResultDragStart = useCallback(
    (e: DragEvent<HTMLElement>, imageUrl: string, displayIndex: number) => {
      e.dataTransfer.setData("text/plain", imageUrl);
      e.dataTransfer.setData("text/onemix-result-url", imageUrl);
      e.dataTransfer.setData(
        "text/onemix-result-name",
        `详情图_${displayIndex}.jpg`,
      );
    },
    [],
  );

  const getRefWhiteItems = useCallback(
    (slot: SlotRow) => {
      return slot.kind === "detail" && detailWhiteImageItems.length > 0
        ? detailWhiteImageItems
        : whiteImageItems;
    },
    [detailWhiteImageItems, whiteImageItems],
  );

  const getRefWhiteIndex = useCallback(
    (slot: SlotRow) => {
      const refItems =
        slot.kind === "detail" && detailWhiteImageItems.length > 0
          ? detailWhiteImageItems
          : whiteImageItems;
      return normalizedRefWhiteIndex(slot.ref_white_index, refItems.length);
    },
    [detailWhiteImageItems, whiteImageItems],
  );

  return {
    apiKey,
    setApiKey,
    arkKey,
    setArkKey,
    headers,
    name,
    setName,
    desc,
    nMain,
    setNMain,
    nDetail,
    setNDetail,
    nMainInput,
    setNMainInput,
    nDetailInput,
    setNDetailInput,
    strategy,
    setStrategy: setStrategyAndClampSlots,
    strategyGroups,
    syncingStrategies,
    onSyncArkSeedreamModels,
    onSyncQwenImageModels,
    onSyncGenerationModels,
    mergedText,
    setMergedText,
    keyJson,
    setKeyJson,
    whiteFiles,
    whiteImageItems,
    whiteViewDescs,
    setWhiteViewDescs,
    detailWhiteFiles,
    detailWhiteImageItems,
    previewImageUrl,
    previewImageName,
    slots,
    log,
    busy,
    mainJob,
    detailJob,
    mainResultRefs,
    detailResultRefs,
    activePlanKind,
    collapseMainPanel,
    setCollapseMainPanel,
    collapseDetailPanel,
    setCollapseDetailPanel,
    serverSettings,
    isStep2DragOver,
    isStep3DragOver,
    showSettings,
    setShowSettings,
    showLog,
    setShowLog,
    resultViewMode,
    setResultViewMode,
    showOcrModal,
    ocrImages,
    ocrImageItems,
    ocrResult,
    setOcrResult,
    isOcrDragOver,
    currentStep,
    setCurrentStep,
    editingKey,
    setEditingKey,
    showMainImageLibrary,
    selectedMainImages,
    activeImageTab,
    mainSlots,
    detailSlots,
    mainResultMap,
    detailResultMap,
    generatedMainItems,
    appendLog,
    notify,
    loadServerSettings,
    onAddTextFiles,
    onUploadTextFilesClick,
    onSelectWhiteFiles,
    onSelectDetailWhiteFiles,
    onRemoveWhiteFileAt,
    onReplaceWhiteFileAt,
    onRemoveDetailWhiteAt,
    onReplaceDetailWhiteAt,
    refreshWhitePreviewUrl,
    refreshDetailPreviewUrl,
    addGeneratedImageToWhites,
    onDropToWhites,
    onExtractKeyInfo,
    onPlanByKind,
    updateSlotPrompt,
    updateSlotRef,
    updateSlotAspect,
    updateSlotResolution,
    batchUpdateSlotImageSize,
    onRefineSlotPrompt,
    onGenerate,
    onDownloadZip,
    onDownloadOneResult,
    onSaveKeyToServer,
    onClearServerKey,
    onSaveArkKeyToServer,
    onClearArkServerKey,
    onOpenOcrModal,
    onCloseOcrModal,
    onOcrDragEnter,
    onOcrDragOver,
    onOcrDragLeave,
    onOcrDrop,
    onOcrFileInputChange,
    onRemoveOcrImageAt,
    onOcrRecognize,
    onConfirmOcr,
    onOpenPreview,
    onClosePreview,
    onStep2DragEnter,
    onStep2DragOver,
    onStep2DragLeave,
    onStep3DragEnter,
    onStep3DragOver,
    onStep3DragLeave,
    onStep3Drop,
    onNMainInputChange,
    onNDetailInputChange,
    onOpenMainImageLibrary,
    onCloseMainImageLibrary,
    onMainImageTabGenerated,
    onMainImageTabUploaded,
    onToggleMainImageSelection,
    onConfirmMainImageLibrary,
    onMainResultDragStart,
    onDetailResultDragStart,
    getRefWhiteItems,
    getRefWhiteIndex,
    normalizedRefWhiteIndex,
  };
}
