import { useCallback, useEffect, useState, type DragEvent } from "react";
import mammoth from "mammoth";
import { Button, Input, Select, Table, message } from "antd";
import foldIcon from "../../assets/icons/fold.svg";
import unfoldIcon from "../../assets/icons/unfold.svg";
import type {
  SlotRow,
  ServerSettings,
  ExtractResponse,
  WhiteImageItem,
  JobResultItem,
  JobState,
  ResultRefMap,
} from "@/types";
import {
  MAIN_PLAN_TEMPLATE,
  DETAIL_PLAN_TEMPLATE,
  STRATEGIES,
} from "@/constants";
import { splitCompetitorSummary } from "@/utils";
import { useApiKeys } from "@/hooks/useApiKeys";

/** 与后端 materialize 一致：白底图下标按张数取模，避免删图后越界。 */
function normalizedRefWhiteIndex(ref: number, len: number): number {
  if (len <= 0) return 0;
  const n = Number(ref);
  const r = Number.isFinite(n) ? Math.trunc(n) : 0;
  return ((r % len) + len) % len;
}

export default function Home() {
  const { TextArea } = Input;
  const { apiKey, setApiKey, arkKey, setArkKey, headers } = useApiKeys();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [nMain, setNMain] = useState(1);
  const [nDetail, setNDetail] = useState(4);
  const [nMainInput, setNMainInput] = useState("1");
  const [nDetailInput, setNDetailInput] = useState("4");
  const [strategy, setStrategy] = useState("doubao_seedream_5");

  const [, setInfoTextFiles] = useState<File[]>([]);
  const [mergedText, setMergedText] = useState("");
  interface KeyJson {
    targetAudience?: string[];
    emotionalAssociation?: string[];
    styleTone?: string[];
    goodsName?: string;
    category?: string;
    sellingPoints?: string[];
    [key: string]: unknown;
  }

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
  const [ocrImageItems, setOcrImageItems] = useState<
    { file: File; url: string }[]
  >([]);
  const [ocrResult, setOcrResult] = useState<string>("");
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

  const appendLog = useCallback((s: string) => {
    setLog((prev) => (prev + s + "\n").slice(-10000));
    // 如果是错误提示，直接弹出message提示
    if (s.includes("请先") || s.includes("失败") || s.includes("错误")) {
      message.warning(s);
    }
  }, []);

  const isDigitsOnly = (value: string) => /^\d+$/.test(value);

  const loadServerSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as ServerSettings;
      setServerSettings(j);
      // 不再自动打开编辑状态，让用户手动点击添加
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

  const onAddTextFiles = async (fileList: FileList | null) => {
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
  };

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
      setKeyJson(j.extracted_json);
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
    if (!whiteFiles.length) {
      appendLog("请至少上传一张白底商品图。\n");
      return;
    }
    setActivePlanKind(target);
    setBusy(true);
    try {
      const { base, comp } = splitCompetitorSummary(desc);
      const isMain = target === "main";
      const j = await runJson("/api/plan/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: name.trim(),
          product_desc: base,
          competitor_summary: comp,
          n_main: isMain ? nMain : 0,
          n_detail: isMain ? 0 : nDetail,
          strategy,
          n_white_images: Math.max(1, whiteFiles.length),
          custom_template: isMain ? MAIN_PLAN_TEMPLATE : DETAIL_PLAN_TEMPLATE,
          user_requirements: buildUserRequirements(target),
        }),
      });
      const raw = (j as { slots: SlotRow[] }).slots;
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
      appendLog(`已生成${isMain ? "主图" : "详情图"} ${raw.length} 个提示词。`);
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

  const reindexSlots = (rows: SlotRow[]) =>
    rows.map((row, idx) => ({ ...row, list_index: idx }));
  const mainSlots = slots.filter((s) => s.kind === "main");
  const detailSlots = slots.filter((s) => s.kind === "detail");
  const mainResultMap = new Map(
    Object.entries(mainResultRefs).map(([k, jobId]) => [Number(k), jobId]),
  );
  const detailResultMap = new Map(
    Object.entries(detailResultRefs).map(([k, jobId]) => [Number(k), jobId]),
  );
  const generatedMainItems = mainSlots
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
    .filter(Boolean) as {
    listIndex: number;
    displayIndex: number;
    jobId: string;
    imageUrl: string;
  }[];

  const onRefineSlotPrompt = async (listIndex: number) => {
    const slot = slots.find((s) => s.list_index === listIndex);
    if (!slot) return;
    setBusy(true);
    try {
      const { base, comp } = splitCompetitorSummary(desc);
      const j = await runJson("/api/plan/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: name.trim(),
          product_desc: base,
          competitor_summary: comp,
          kind: slot.kind,
          index: slot.index,
          strategy,
          old_prompt: slot.prompt,
        }),
      });
      const prompt = ((j as { prompt: string }).prompt || "").trim();
      if (prompt) {
        updateSlotPrompt(listIndex, prompt);
        appendLog(`图片 #${listIndex} 提示词重构完成。`);
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
        slot_jobs: targetSlots.map((s) => ({
          list_index: s.list_index,
          kind: s.kind,
          index: s.index,
          prompt: s.prompt,
          export_path: null,
          ref_image_path: null,
          ref_white_index: s.ref_white_index,
        })),
        dw: 750,
        dh: 1200,
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
    if (!targetJobId) return;
    fetch(`/api/jobs/${targetJobId}/bundle`, { headers })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.blob();
      })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `onemix_${kind}_${targetJobId}.zip`;
        a.click();
        URL.revokeObjectURL(u);
      })
      .catch((e) => appendLog(`下载失败：${e}`));
  };

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

  const renderRefWhiteCell = (s: SlotRow) => {
    const refItems =
      s.kind === "detail" && detailWhiteImageItems.length > 0
        ? detailWhiteImageItems
        : whiteImageItems;
    const len = refItems.length;
    const idx = normalizedRefWhiteIndex(s.ref_white_index, len);
    const refItem = len > 0 ? refItems[idx] : undefined;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          minWidth: 72,
        }}
      >
        {refItem ? (
          <img
            src={refItem.url}
            alt={`白底参考图 ${idx + 1}`}
            style={{
              width: 40,
              height: 40,
              objectFit: "cover",
              borderRadius: 6,
            }}
            onError={() =>
              s.kind === "detail"
                ? refreshDetailPreviewUrl(idx)
                : refreshWhitePreviewUrl(idx)
            }
          />
        ) : (
          <span className="hint" style={{ fontSize: 12 }}>
            —
          </span>
        )}
        {len > 0 && (
          <Select
            aria-label={`槽位 ${s.index} 使用的白底参考图`}
            value={idx}
            disabled={busy}
            title="选择用于该提示词槽位的白底商品图（按上传顺序编号）"
            onChange={(value) => updateSlotRef(s.list_index, Number(value))}
            options={refItems.map((it, i) => ({
              value: i,
              label: `白底图 ${i + 1}`,
              key: `${it.file.name}-${i}`,
            }))}
            style={{
              width: "100%",
              maxWidth: 112,
              marginTop: 0,
              fontSize: 12,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <main className={`app ${busy ? "is-busy" : ""}`} aria-busy={busy}>
      {busy && (
        <div className="busy-mask" role="status" aria-live="polite">
          <div className="busy-card">
            <div className="busy-spinner" />
            <div className="busy-title">正在处理，请稍候...</div>
            <div className="busy-text">
              处理中将暂时锁定页面操作，避免误触。
            </div>
          </div>
        </div>
      )}
      {previewImageUrl && (
        <div
          className="image-preview-mask"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="image-preview-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="image-preview-head">
              <span title={previewImageName}>{previewImageName}</span>
              <Button
                className="btn ghost"
                htmlType="button"
                onClick={() => setPreviewImageUrl(null)}
              >
                关闭
              </Button>
            </div>
            <img
              className="image-preview-img"
              src={previewImageUrl}
              alt={previewImageName}
            />
          </div>
        </div>
      )}
      <header className="hero">
        <div>
          <p className="badge">OneMix Web</p>
          <h1>一键生成电商图片</h1>
          <p className="sub">
            上传商品信息 → 提取关键参数 → 自动生成提示词并批量生成主图与详情图。
          </p>
        </div>
        <div className="settings-btn-container">
          <Button
            className="settings-btn"
            htmlType="button"
            onClick={() => setShowSettings(true)}
            aria-label="API Key 设置"
          >
            ⚙️
          </Button>
          <span className="settings-btn-tooltip">API Key 设置</span>
        </div>
        <div className="log-btn-container">
          <Button
            className="log-btn"
            htmlType="button"
            onClick={() => setShowLog(true)}
            aria-label="运行日志"
          >
            📋
          </Button>
          <span className="log-btn-tooltip">运行日志</span>
        </div>
      </header>

      <div className="progress-container">
        <div className="progress-bar">
          <div
            className={`progress-step ${currentStep >= 1 ? "completed" : ""}`}
          >
            <div className="step-circle">{currentStep > 1 ? "✓" : "1"}</div>
            <div className="step-label">信息提取</div>
          </div>
          <div
            className={`progress-line ${currentStep >= 2 ? "active" : ""}`}
          ></div>
          <div
            className={`progress-step ${currentStep >= 2 ? "completed" : ""} ${currentStep === 2 ? "current" : ""}`}
          >
            <div className="step-circle">{currentStep > 2 ? "✓" : "2"}</div>
            <div className="step-label">生成主图</div>
          </div>
          <div
            className={`progress-line ${currentStep >= 3 ? "active" : ""}`}
          ></div>
          <div
            className={`progress-step ${currentStep >= 3 ? "completed" : ""} ${currentStep === 3 ? "current" : ""}`}
          >
            <div className="step-circle">{currentStep > 3 ? "✓" : "3"}</div>
            <div className="step-label">生成详情</div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div
          className="settings-modal-overlay"
          onClick={() => setShowSettings(false)}
        >
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>API Key 设置</h3>
              <Button
                className="btn-close"
                htmlType="button"
                onClick={() => setShowSettings(false)}
              >
                ×
              </Button>
            </div>
            <div className="settings-modal-content">
              <div className="api-key-card">
                <div className="api-key-header">
                  <span className="api-key-name">阿里百炼 (DashScope)</span>
                  <div className="api-key-status">
                    <span
                      className={`status-indicator ${serverSettings?.has_dashscope_key ? "active" : "inactive"}`}
                    ></span>
                    <span className="status-text">
                      {serverSettings?.has_dashscope_key
                        ? `已保存 ${serverSettings.dashscope_key_preview ?? ""}`
                        : "未设置"}
                    </span>
                    <Button
                      className="btn-edit"
                      htmlType="button"
                      onClick={() =>
                        setEditingKey(
                          editingKey === "dashscope" ? null : "dashscope",
                        )
                      }
                    >
                      {editingKey === "dashscope"
                        ? "收起"
                        : serverSettings?.has_dashscope_key
                          ? "编辑"
                          : "添加"}
                    </Button>
                  </div>
                </div>
                {editingKey === "dashscope" && (
                  <div className="api-key-edit">
                    <Input
                      className="input"
                      type="password"
                      placeholder="输入 DashScope Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <div className="btn-row">
                      <Button
                        className="btn-save"
                        htmlType="button"
                        disabled={busy}
                        onClick={() => {
                          void onSaveKeyToServer();
                          setEditingKey(null);
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        className="btn-cancel"
                        htmlType="button"
                        disabled={busy}
                        onClick={() => {
                          void onClearServerKey();
                          setEditingKey(null);
                        }}
                      >
                        清除
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 即梦 ARK Key */}
              <div className="api-key-card">
                <div className="api-key-header">
                  <span className="api-key-name">即梦 ARK</span>
                  <div className="api-key-status">
                    <span
                      className={`status-indicator ${serverSettings?.has_ark_key ? "active" : "inactive"}`}
                    ></span>
                    <span className="status-text">
                      {serverSettings?.has_ark_key
                        ? `已保存 ${serverSettings.ark_key_preview ?? ""}`
                        : "未设置"}
                    </span>
                    <Button
                      className="btn-edit"
                      htmlType="button"
                      onClick={() =>
                        setEditingKey(editingKey === "ark" ? null : "ark")
                      }
                    >
                      {editingKey === "ark"
                        ? "收起"
                        : serverSettings?.has_ark_key
                          ? "编辑"
                          : "添加"}
                    </Button>
                  </div>
                </div>
                {editingKey === "ark" && (
                  <div className="api-key-edit">
                    <Input
                      className="input"
                      type="password"
                      placeholder="输入即梦 ARK Key"
                      value={arkKey}
                      onChange={(e) => setArkKey(e.target.value)}
                    />
                    <div className="btn-row">
                      <Button
                        className="btn-save"
                        htmlType="button"
                        disabled={busy}
                        onClick={() => {
                          void onSaveArkKeyToServer();
                          setEditingKey(null);
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        className="btn-cancel"
                        htmlType="button"
                        disabled={busy}
                        onClick={() => {
                          void onClearArkServerKey();
                          setEditingKey(null);
                        }}
                      >
                        清除
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showOcrModal && (
        <div className="modal-overlay" onClick={() => setShowOcrModal(false)}>
          <div className="modal ocr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>OCR识别</h3>
              <Button
                className="close-btn"
                onClick={() => setShowOcrModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsOcrDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isOcrDragOver) setIsOcrDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (
                    !e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    setIsOcrDragOver(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsOcrDragOver(false);
                  if (e.dataTransfer.files) {
                    const files = Array.from(e.dataTransfer.files).filter((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (files.length > 0) {
                      setOcrImages((prev) => [...prev, ...files]);
                      const newItems = files.map((file) => ({
                        file,
                        url: URL.createObjectURL(file),
                      }));
                      setOcrImageItems((prev) => [...prev, ...newItems]);
                    }
                  }
                }}
                style={{
                  border: `2px dashed ${isOcrDragOver ? "#4f46e5" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: 16,
                  textAlign: "center",
                  marginBottom: 20,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontSize: "24px", marginBottom: 8 }}>🖼️</div>
                <p style={{ margin: 0 }}>点击或拖拽上传图片</p>
                <p style={{ color: "#6b7280", marginTop: 2, marginBottom: 0 }}>
                  支持 jpg、png，可多选
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  id="ocr-image-upload"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setOcrImages((prev) => [...prev, ...files]);
                      const newItems = files.map((file) => ({
                        file,
                        url: URL.createObjectURL(file),
                      }));
                      setOcrImageItems((prev) => [...prev, ...newItems]);
                    }
                  }}
                />
                <label
                  htmlFor="ocr-image-upload"
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "8px 16px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#e5e7eb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f3f4f6")
                  }
                >
                  选择图片
                </label>
              </div>

              {ocrImageItems.length > 0 && (
                <div
                  className="thumb-grid top-gap"
                  style={{ marginBottom: 20 }}
                >
                  {ocrImageItems.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${idx}`}
                      className="thumb-card"
                      style={{ position: "relative" }}
                    >
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="thumb-img"
                      />
                      <Button
                        htmlType="button"
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          width: "24px",
                          height: "24px",
                          backgroundColor: "rgba(107, 114, 128, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => {
                          setOcrImages((prev) =>
                            prev.filter((_, i) => i !== idx),
                          );
                          setOcrImageItems((prev) =>
                            prev.filter((_, i) => i !== idx),
                          );
                        }}
                      >
                        ×
                      </Button>
                      <div className="thumb-name" title={item.file.name}>
                        {item.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="btn-row top-gap" style={{ marginBottom: 20 }}>
                <Button
                  className="btn primary"
                  htmlType="button"
                  disabled={busy || ocrImages.length === 0}
                  onClick={async () => {
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
                          chunks.push(`## 图片OCR: ${file.name}\n${text}`);
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
                  }}
                >
                  🔍 OCR识别（仅提取文字）
                </Button>
              </div>

              <div className="top-gap">
                <label className="label">
                  识别结果（可编辑）
                  <TextArea
                    className="textarea"
                    rows={6}
                    value={ocrResult}
                    onChange={(e) => setOcrResult(e.target.value)}
                    style={{ marginBottom: 20 }}
                  />
                </label>
              </div>

              <div className="btn-row top-gap center">
                <Button
                  className="btn primary big"
                  htmlType="button"
                  disabled={!ocrResult.trim()}
                  onClick={() => {
                    setMergedText((prev) => prev + "\n" + ocrResult);
                    setShowOcrModal(false);
                    setOcrImages([]);
                    setOcrImageItems([]);
                    setOcrResult("");
                  }}
                >
                  合并到描述文本
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLog && (
        <div className="log-modal-overlay" onClick={() => setShowLog(false)}>
          <div className="log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <h3>运行日志</h3>
              <Button
                className="btn-close"
                htmlType="button"
                onClick={() => setShowLog(false)}
              >
                ×
              </Button>
            </div>
            <div className="log-modal-content">
              <pre className="log-content">{log || "等待操作..."}</pre>
            </div>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <section className="card">
          <div className="section-header">
            <h2>商品描述文本</h2>
          </div>
          <div className="btn-group" style={{ marginBottom: "16px" }}>
            <Button
              className="btn secondary"
              htmlType="button"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ".txt,.md,.csv,.json,.log,.docx";
                input.onchange = (e) =>
                  void onAddTextFiles((e.target as HTMLInputElement).files);
                input.click();
              }}
            >
              📁 上传文件
            </Button>
            <Button
              className="btn secondary"
              htmlType="button"
              onClick={() => setShowOcrModal(true)}
            >
              🖼️ OCR识别
            </Button>
            <Button
              className="btn secondary"
              htmlType="button"
              onClick={() => setMergedText("")}
            >
              🗑️ 清空
            </Button>
          </div>
          <label className="label">
            <TextArea
              className="textarea"
              rows={8}
              value={mergedText}
              onChange={(e) => setMergedText(e.target.value)}
              placeholder={`在此输入或粘贴商品描述文本...

也可以点击上方按钮：
• 上传文件 - 支持 docx、txt、pdf 等格式
• OCR识别 - 上传图片自动提取文字
提取的商品文字信息将显示在这里，您可以编辑修改。`}
            />
          </label>

          <div className="btn-row top-gap center">
            <Button
              className="btn primary big"
              htmlType="button"
              disabled={busy || !mergedText.trim()}
              onClick={() => void onExtractKeyInfo()}
            >
              提取关键信息
            </Button>
          </div>
          {keyJson && (
            <div className="result-container">
              <div className="result-header">
                <h3>提取结果</h3>
                <div className="result-tabs">
                  <Button
                    className={`tab-btn ${resultViewMode === "structured" ? "active" : ""}`}
                    onClick={() => setResultViewMode("structured")}
                  >
                    结构化
                  </Button>
                  <Button
                    className={`tab-btn ${resultViewMode === "json" ? "active" : ""}`}
                    onClick={() => setResultViewMode("json")}
                  >
                    JSON
                  </Button>
                </div>
              </div>

              {resultViewMode === "structured" ? (
                <div className="structured-result">
                  {/* 商品基础身份 */}
                  {(keyJson as any)["商品基础身份"] && (
                    <div className="result-card">
                      <div className="result-card-header">
                        <span className="icon">📦</span>
                        <h4>商品基础身份</h4>
                      </div>
                      <div className="tag-list">
                        {Object.entries((keyJson as any)["商品基础身份"]).map(
                          ([key, value], index) => (
                            <span key={index} className="tag">
                              {key}: {String(value)}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* 目标用户画像 */}
                  {keyJson.targetAudience &&
                    Array.isArray(keyJson.targetAudience) &&
                    keyJson.targetAudience.length > 0 && (
                      <div className="result-card">
                        <div className="result-card-header">
                          <span className="icon">👤</span>
                          <h4>目标用户画像</h4>
                        </div>
                        <div className="tag-list">
                          {keyJson.targetAudience.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 情感联想 */}
                  {keyJson.emotionalAssociation &&
                    Array.isArray(keyJson.emotionalAssociation) &&
                    keyJson.emotionalAssociation.length > 0 && (
                      <div className="result-card">
                        <div className="result-card-header">
                          <span className="icon">❤️</span>
                          <h4>情感联想</h4>
                        </div>
                        <div className="tag-list">
                          {keyJson.emotionalAssociation.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 风格与调性 */}
                  {keyJson.styleTone &&
                    Array.isArray(keyJson.styleTone) &&
                    keyJson.styleTone.length > 0 && (
                      <div className="result-card">
                        <div className="result-card-header">
                          <span className="icon">🎨</span>
                          <h4>风格与调性</h4>
                        </div>
                        <div className="tag-list">
                          {keyJson.styleTone.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 其他属性 */}
                  {Object.entries(keyJson).map(([key, value]) => {
                    if (
                      key === "targetAudience" ||
                      key === "emotionalAssociation" ||
                      key === "styleTone" ||
                      key === "商品基础身份"
                    ) {
                      return null;
                    }
                    if (typeof value === "object" && value !== null) {
                      return (
                        <div key={key} className="result-card">
                          <div className="result-card-header">
                            <span className="icon">📋</span>
                            <h4>{key}</h4>
                          </div>
                          <div className="tag-list">
                            {Object.entries(
                              value as Record<string, unknown>,
                            ).map(([subKey, subValue], index) => (
                              <span key={index} className="tag">
                                {subKey}: {String(subValue)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (Array.isArray(value)) {
                      return (
                        <div key={key} className="result-card">
                          <div className="result-card-header">
                            <span className="icon">📋</span>
                            <h4>{key}</h4>
                          </div>
                          <div className="tag-list">
                            {value.map((item, index) => (
                              <span key={index} className="tag">
                                {String(item)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="result-card">
                        <div className="result-card-header">
                          <span className="icon">📋</span>
                          <h4>{key}</h4>
                        </div>
                        <div className="tag-list">
                          <span className="tag">{String(value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="json-result">
                  <pre>{JSON.stringify(keyJson, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          <div className="step-nav top-gap">
            <Button
              className="btn primary"
              htmlType="button"
              disabled={busy || !keyJson}
              onClick={() => setCurrentStep(2)}
            >
              下一步：生成主图
            </Button>
          </div>
        </section>
      )}

      {currentStep === 2 && (
        <section className="card step-main-card">
          <div className="step-main-body">
            <div className="section-header">
              <h2>步骤二：生成主图</h2>
              <Button
                className="btn secondary"
                htmlType="button"
                onClick={() => setCurrentStep(1)}
              >
                返回修改
              </Button>
            </div>

            <div
              className="step-main-upload-panel"
              onDragEnter={(e) => {
                e.preventDefault();
                setIsStep2DragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isStep2DragOver) setIsStep2DragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setIsStep2DragOver(false);
                }
              }}
              onDrop={(e) => void onDropToWhites(e, "main")}
              style={{
                border: `2px dashed ${isStep2DragOver ? "#4f46e5" : "transparent"}`,
                borderRadius: 12,
                padding: isStep2DragOver ? 12 : 0,
                transition:
                  "border-color 0.2s ease, background-color 0.2s ease, padding 0.2s ease",
                backgroundColor: isStep2DragOver
                  ? "rgba(79, 70, 229, 0.06)"
                  : "transparent",
              }}
            >
              <label className="label">
                主图白底商品图（多选）
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onSelectWhiteFiles(e.target.files)}
                />
              </label>
              <div className="hint"></div>
              {whiteImageItems.length > 0 && (
                <div className="thumb-grid top-gap">
                  {whiteImageItems.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${idx}`}
                      className="thumb-card"
                      style={{ position: "relative" }}
                    >
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="thumb-img"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setPreviewImageUrl(item.url);
                          setPreviewImageName(item.file.name);
                        }}
                      />
                      <Button
                        htmlType="button"
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          width: "24px",
                          height: "24px",
                          backgroundColor: "rgba(107, 114, 128, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => onRemoveWhiteFileAt(idx)}
                      >
                        ×
                      </Button>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "8px",
                        }}
                      >
                        <div className="thumb-name" title={item.file.name}>
                          {item.file.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div
                            style={{
                              width: "1px",
                              height: "12px",
                              backgroundColor: "#e5e7eb",
                              margin: "0 4px",
                            }}
                          ></div>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "2px",
                              padding: "4px 6px",
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "10px",
                              color: "#4b5563",
                              transition: "all 0.2s ease",
                            }}
                            title="替换图片"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#3b82f6";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#4b5563";
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            替换
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                onReplaceWhiteFileAt(
                                  idx,
                                  e.target.files?.[0] ?? null,
                                );
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid-2 top-gap step-main-fields">
              <label className="label">
                商品名称
                <Input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="label">
                生成策略
                <Select
                  className="input"
                  value={strategy}
                  onChange={(value) => setStrategy(value)}
                  options={STRATEGIES.map((s) => ({
                    value: s.value,
                    label: s.label,
                  }))}
                />
              </label>
            </div>
            <div className="top-gap step-main-qty">
              <label className="label">
                主图数量
                <Input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={nMainInput}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === "") {
                      setNMainInput("");
                      return;
                    }
                    if (isDigitsOnly(value)) {
                      setNMainInput(value);
                      setNMain(Number(value));
                    }
                  }}
                />
              </label>
            </div>
            <div className="btn-row top-gap step-main-actions">
              <Button
                className="btn secondary"
                htmlType="button"
                disabled={busy}
                onClick={() => void onPlanByKind("main")}
              >
                生成主图提示词
              </Button>
              {(activePlanKind === "main" || mainSlots.length > 0) && (
                <Button
                  className="btn ghost"
                  htmlType="button"
                  style={{ width: "40px", height: "38px", padding: "8px" }}
                  onClick={() => setCollapseMainPanel((v) => !v)}
                >
                  <img
                    src={collapseMainPanel ? foldIcon : unfoldIcon}
                    alt={collapseMainPanel ? "折叠" : "展开"}
                    style={{ width: "20px", height: "20px" }}
                  />
                </Button>
              )}
            </div>
            {(activePlanKind === "main" || mainSlots.length > 0) && (
              <div>
                <div className="top-gap">
                  {!collapseMainPanel &&
                    (mainSlots.length > 0 ? (
                      <>
                        <div className="table-wrap">
                          <Table
                            rowKey={(row) => `main-row-${row.list_index}`}
                            pagination={false}
                            dataSource={mainSlots}
                            columns={[
                              {
                                title: "序号",
                                dataIndex: "index",
                                key: "index",
                                width: 80,
                              },
                              {
                                title: "参考图",
                                key: "ref",
                                width: 140,
                                render: (_, s) => renderRefWhiteCell(s),
                              },
                              {
                                title: "提示词",
                                key: "prompt",
                                render: (_, s) => (
                                  <TextArea
                                    className="small-textarea"
                                    rows={2}
                                    value={s.prompt}
                                    onChange={(e) =>
                                      updateSlotPrompt(
                                        s.list_index,
                                        e.target.value,
                                      )
                                    }
                                  />
                                ),
                              },
                              {
                                title: "操作",
                                key: "actions",
                                width: 220,
                                render: (_, s) => (
                                  <div
                                    className="btn-row"
                                    style={{ marginTop: 0 }}
                                  >
                                    <Button
                                      className="btn ghost"
                                      htmlType="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void onRefineSlotPrompt(s.list_index)
                                      }
                                    >
                                      重构提示词
                                    </Button>
                                    <Button
                                      className="btn secondary"
                                      htmlType="button"
                                      disabled={busy || !whiteFiles.length}
                                      onClick={() =>
                                        void onGenerate("main", [s.list_index])
                                      }
                                    >
                                      生图
                                    </Button>
                                  </div>
                                ),
                              },
                            ]}
                          />
                        </div>
                        <div className="btn-row top-gap">
                          <Button
                            className="btn primary big"
                            htmlType="button"
                            disabled={
                              busy || !whiteFiles.length || !mainSlots.length
                            }
                            onClick={() => void onGenerate("main")}
                          >
                            一键生成主图
                          </Button>
                          {mainJob.jobId && mainJob.status === "completed" && (
                            <Button
                              className="btn secondary"
                              htmlType="button"
                              onClick={() => onDownloadZip("main")}
                            >
                              下载 ZIP
                            </Button>
                          )}
                          {mainJob.status && (
                            <span className="hint">
                              任务状态：{mainJob.status}{" "}
                              {mainJob.progress.t > 0
                                ? `(${mainJob.progress.p}/${mainJob.progress.t})`
                                : ""}
                            </span>
                          )}
                        </div>
                        {mainResultMap.size > 0 && (
                          <div className="thumb-grid top-gap">
                            {mainSlots
                              .filter((s) => mainResultMap.has(s.list_index))
                              .map((s) => {
                                const jobId = mainResultMap.get(s.list_index);
                                if (!jobId) return null;
                                const imageUrl = `/api/jobs/${jobId}/result/${s.list_index}`;
                                return (
                                  <div
                                    key={`main-result-${s.list_index}`}
                                    className="thumb-result-item"
                                  >
                                    <Button
                                      className="thumb-card thumb-btn"
                                      htmlType="button"
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "text/plain",
                                          imageUrl,
                                        );
                                        e.dataTransfer.setData(
                                          "text/onemix-result-url",
                                          imageUrl,
                                        );
                                        e.dataTransfer.setData(
                                          "text/onemix-result-name",
                                          `主图_${s.index}.jpg`,
                                        );
                                      }}
                                      onClick={() => {
                                        setPreviewImageUrl(imageUrl);
                                        setPreviewImageName(`主图_${s.index}`);
                                      }}
                                    >
                                      <img
                                        className="thumb-img"
                                        src={imageUrl}
                                        alt={`主图_${s.index}`}
                                      />
                                      <div className="thumb-name">
                                        主图 {s.index}
                                      </div>
                                    </Button>
                                    <Button
                                      className="btn secondary thumb-add-btn"
                                      htmlType="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void addGeneratedImageToWhites(
                                          "main",
                                          imageUrl,
                                          `主图_${s.index}.jpg`,
                                        )
                                      }
                                    >
                                      选为参考图
                                    </Button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="hint">
                        点击"生成主图提示词"后，这里会展示主图提示词。
                      </div>
                    ))}
                </div>

                <div className="step-nav top-gap">
                  <Button
                    className="btn secondary"
                    htmlType="button"
                    onClick={() => setCurrentStep(1)}
                  >
                    上一步：信息提取
                  </Button>
                  <Button
                    className="btn primary"
                    htmlType="button"
                    disabled={busy || !mainSlots.length}
                    onClick={() => setCurrentStep(3)}
                  >
                    下一步：生成详情
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {currentStep === 3 && (
        <section className="card step-detail-card">
          <div className="step-detail-body">
            <div className="section-header">
              <h2>步骤三：生成详情图</h2>
              <Button
                className="btn secondary"
                htmlType="button"
                onClick={() => setCurrentStep(2)}
              >
                返回修改
              </Button>
            </div>
            <div
              className="step-detail-upload-panel"
              onDragEnter={(e) => {
                e.preventDefault();
                setIsStep3DragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isStep3DragOver) setIsStep3DragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setIsStep3DragOver(false);
                }
              }}
              onDrop={(e) => {
                setIsStep3DragOver(false);
                void onDropToWhites(e, "detail");
              }}
              style={{
                border: `2px dashed ${isStep3DragOver ? "#0ea5e9" : "transparent"}`,
                borderRadius: 12,
                padding: isStep3DragOver ? 12 : 0,
                transition:
                  "border-color 0.2s ease, background-color 0.2s ease, padding 0.2s ease",
                backgroundColor: isStep3DragOver
                  ? "rgba(14, 165, 233, 0.08)"
                  : "transparent",
              }}
            >
              <div>
                <div style={{ marginBottom: "8px" }}>
                  详情图白底商品图（多选）
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => onSelectDetailWhiteFiles(e.target.files)}
                    style={{ flex: "1 1 0", maxWidth: "400px" }}
                  />
                  <Button
                    htmlType="button"
                    className="btn secondary"
                    onClick={() => {
                      setActiveImageTab("generated");
                      setSelectedMainImages([]);
                      setShowMainImageLibrary(true);
                    }}
                    style={{ height: "38px" }}
                  >
                    从主图库选择
                  </Button>
                </div>
              </div>
              <div className="hint"></div>
              {detailWhiteImageItems.length > 0 && (
                <div className="thumb-grid top-gap">
                  {detailWhiteImageItems.map((item, idx) => (
                    <div
                      key={`detail-${item.file.name}-${idx}`}
                      className="thumb-card"
                      style={{ position: "relative" }}
                    >
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="thumb-img"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setPreviewImageUrl(item.url);
                          setPreviewImageName(item.file.name);
                        }}
                      />
                      <Button
                        htmlType="button"
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          width: "24px",
                          height: "24px",
                          backgroundColor: "rgba(107, 114, 128, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => {
                          setDetailWhiteImageItems((prev) => {
                            const next = [...prev];
                            const itemToRemove = next[idx];
                            if (itemToRemove)
                              URL.revokeObjectURL(itemToRemove.url);
                            next.splice(idx, 1);
                            return next;
                          });
                          setDetailWhiteFiles((prev) =>
                            prev.filter((_, i) => i !== idx),
                          );
                          setDetailWhiteViewDescs((prev) =>
                            prev.filter((_, i) => i !== idx),
                          );
                        }}
                      >
                        ×
                      </Button>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "8px",
                        }}
                      >
                        <div className="thumb-name" title={item.file.name}>
                          {item.file.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div
                            style={{
                              width: "1px",
                              height: "12px",
                              backgroundColor: "#e5e7eb",
                              margin: "0 8px",
                            }}
                          ></div>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "2px",
                              padding: "4px 6px",
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "10px",
                              color: "#4b5563",
                              transition: "all 0.2s ease",
                            }}
                            title="替换图片"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#3b82f6";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#4b5563";
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            替换
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  const nextUrl = URL.createObjectURL(file);
                                  setDetailWhiteImageItems((prev) => {
                                    const next = [...prev];
                                    const old = next[idx];
                                    if (!old) return prev;
                                    URL.revokeObjectURL(old.url);
                                    next[idx] = { file, url: nextUrl };
                                    return next;
                                  });
                                  setDetailWhiteFiles((prev) =>
                                    prev.map((f, i) => (i === idx ? file : f)),
                                  );
                                  e.currentTarget.value = "";
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid-2 top-gap step-detail-fields">
              <label className="label">
                商品名称
                <Input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="label">
                生成策略
                <Select
                  className="input"
                  value={strategy}
                  onChange={(value) => setStrategy(value)}
                  options={STRATEGIES.map((s) => ({
                    value: s.value,
                    label: s.label,
                  }))}
                />
              </label>
            </div>
            <div className="top-gap step-detail-qty">
              <label className="label">
                详情数量
                <Input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  value={nDetailInput}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === "") {
                      setNDetailInput("");
                      return;
                    }
                    if (isDigitsOnly(value)) {
                      setNDetailInput(value);
                      setNDetail(Number(value));
                    }
                  }}
                />
              </label>
            </div>
            <div className="btn-row top-gap step-detail-actions">
              <Button
                className="btn secondary"
                htmlType="button"
                disabled={busy}
                onClick={() => void onPlanByKind("detail")}
              >
                生成详情图提示词
              </Button>
              {(activePlanKind === "detail" || detailSlots.length > 0) && (
                <Button
                  className="btn ghost"
                  htmlType="button"
                  style={{ width: "40px", height: "38px", padding: "8px" }}
                  onClick={() => setCollapseDetailPanel((v) => !v)}
                >
                  <img
                    src={collapseDetailPanel ? foldIcon : unfoldIcon}
                    alt={collapseDetailPanel ? "折叠" : "展开"}
                    style={{ width: "20px", height: "20px" }}
                  />
                </Button>
              )}
            </div>
            {(activePlanKind === "detail" || detailSlots.length > 0) && (
              <div>
                <div className="top-gap">
                  {!collapseDetailPanel &&
                    (detailSlots.length > 0 ? (
                      <>
                        <div className="table-wrap">
                          <Table
                            rowKey={(row) => `detail-row-${row.list_index}`}
                            pagination={false}
                            dataSource={detailSlots}
                            columns={[
                              {
                                title: "序号",
                                dataIndex: "index",
                                key: "index",
                                width: 80,
                              },
                              {
                                title: "参考图",
                                key: "ref",
                                width: 140,
                                render: (_, s) => renderRefWhiteCell(s),
                              },
                              {
                                title: "提示词",
                                key: "prompt",
                                render: (_, s) => (
                                  <TextArea
                                    className="small-textarea"
                                    rows={2}
                                    value={s.prompt}
                                    onChange={(e) =>
                                      updateSlotPrompt(
                                        s.list_index,
                                        e.target.value,
                                      )
                                    }
                                  />
                                ),
                              },
                              {
                                title: "操作",
                                key: "actions",
                                width: 220,
                                render: (_, s) => (
                                  <div
                                    className="btn-row"
                                    style={{ marginTop: 0 }}
                                  >
                                    <Button
                                      className="btn ghost"
                                      htmlType="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void onRefineSlotPrompt(s.list_index)
                                      }
                                    >
                                      重构提示词
                                    </Button>
                                    <Button
                                      className="btn secondary"
                                      htmlType="button"
                                      disabled={
                                        busy ||
                                        (!detailWhiteFiles.length &&
                                          !whiteFiles.length)
                                      }
                                      onClick={() =>
                                        void onGenerate("detail", [
                                          s.list_index,
                                        ])
                                      }
                                    >
                                      生图
                                    </Button>
                                  </div>
                                ),
                              },
                            ]}
                          />
                        </div>
                        <div className="btn-row top-gap">
                          <Button
                            className="btn primary big"
                            htmlType="button"
                            disabled={
                              busy ||
                              (!detailWhiteFiles.length &&
                                !whiteFiles.length) ||
                              !detailSlots.length
                            }
                            onClick={() => void onGenerate("detail")}
                          >
                            一键生成详情图
                          </Button>
                          {detailJob.jobId &&
                            detailJob.status === "completed" && (
                              <Button
                                className="btn secondary"
                                htmlType="button"
                                onClick={() => onDownloadZip("detail")}
                              >
                                下载 ZIP
                              </Button>
                            )}
                          {detailJob.status && (
                            <span className="hint">
                              任务状态：{detailJob.status}{" "}
                              {detailJob.progress.t > 0
                                ? `(${detailJob.progress.p}/${detailJob.progress.t})`
                                : ""}
                            </span>
                          )}
                        </div>
                        {detailResultMap.size > 0 && (
                          <div className="thumb-grid top-gap">
                            {detailSlots
                              .filter((s) => detailResultMap.has(s.list_index))
                              .map((s) => {
                                const jobId = detailResultMap.get(s.list_index);
                                if (!jobId) return null;
                                const imageUrl = `/api/jobs/${jobId}/result/${s.list_index}`;
                                return (
                                  <div
                                    key={`detail-result-${s.list_index}`}
                                    className="thumb-result-item"
                                  >
                                    <Button
                                      className="thumb-card thumb-btn"
                                      htmlType="button"
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "text/plain",
                                          imageUrl,
                                        );
                                        e.dataTransfer.setData(
                                          "text/onemix-result-url",
                                          imageUrl,
                                        );
                                        e.dataTransfer.setData(
                                          "text/onemix-result-name",
                                          `详情图_${s.index}.jpg`,
                                        );
                                      }}
                                      onClick={() => {
                                        setPreviewImageUrl(imageUrl);
                                        setPreviewImageName(
                                          `详情图_${s.index}`,
                                        );
                                      }}
                                    >
                                      <img
                                        className="thumb-img"
                                        src={imageUrl}
                                        alt={`详情图_${s.index}`}
                                      />
                                      <div className="thumb-name">
                                        详情图 {s.index}
                                      </div>
                                    </Button>
                                    <Button
                                      className="btn secondary thumb-add-btn"
                                      htmlType="button"
                                      disabled={busy}
                                      onClick={() =>
                                        void addGeneratedImageToWhites(
                                          "detail",
                                          imageUrl,
                                          `详情图_${s.index}.jpg`,
                                        )
                                      }
                                    >
                                      选为参考图
                                    </Button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="hint">
                        点击"生成详情图提示词"后，这里会展示详情图提示词。
                      </div>
                    ))}
                </div>

                <div className="step-nav top-gap">
                  <Button
                    className="btn secondary"
                    htmlType="button"
                    onClick={() => setCurrentStep(2)}
                  >
                    上一步：生成主图
                  </Button>
                  <Button
                    className="btn primary"
                    htmlType="button"
                    disabled={busy || !detailSlots.length}
                    onClick={() => void onGenerate("detail")}
                  >
                    生成详情图
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 主图库选择弹窗 */}
      {showMainImageLibrary && (
        <div
          className="modal-overlay"
          onClick={() => setShowMainImageLibrary(false)}
        >
          <div
            className="modal"
            style={{ width: "90%", maxWidth: "600px", padding: "10px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3>选择主图素材</h3>
              <Button
                htmlType="button"
                className="close-btn"
                onClick={() => setShowMainImageLibrary(false)}
              >
                ×
              </Button>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                }}
              >
                <Button
                  className="btn"
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    border: "none",
                    backgroundColor:
                      activeImageTab === "generated" ? "#3b82f6" : "#f9fafb",
                    color: activeImageTab === "generated" ? "white" : "#4b5563",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: activeImageTab === "generated" ? "500" : "400",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    if (activeImageTab !== "generated") {
                      setSelectedMainImages([]);
                      setActiveImageTab("generated");
                    }
                  }}
                >
                  已生成主图
                </Button>
                <div style={{ width: "1px", backgroundColor: "#e5e7eb" }}></div>
                <Button
                  className="btn"
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    border: "none",
                    backgroundColor:
                      activeImageTab === "uploaded" ? "#3b82f6" : "#f9fafb",
                    color: activeImageTab === "uploaded" ? "white" : "#4b5563",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: activeImageTab === "uploaded" ? "500" : "400",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    if (activeImageTab !== "uploaded") {
                      setSelectedMainImages([]);
                      setActiveImageTab("uploaded");
                    }
                  }}
                >
                  已上传原图
                </Button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              {activeImageTab === "generated" ? (
                /* 已生成主图 */
                generatedMainItems.length > 0 ? (
                  generatedMainItems.map((item, index) => (
                    <div
                      key={`${item.jobId}-${item.listIndex}`}
                      style={{
                        position: "relative",
                        border: `2px solid ${selectedMainImages.includes(index) ? "#3b82f6" : "#e5e7eb"}`,
                        borderRadius: "8px",
                        padding: "4px",
                        backgroundColor: "#f9fafb",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        if (selectedMainImages.includes(index)) {
                          setSelectedMainImages(
                            selectedMainImages.filter((i) => i !== index),
                          );
                        } else {
                          setSelectedMainImages([...selectedMainImages, index]);
                        }
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={`生成主图 ${item.displayIndex}`}
                        style={{
                          width: "100%",
                          height: "120px",
                          objectFit: "cover",
                          borderRadius: "4px",
                        }}
                      />
                      {selectedMainImages.includes(index) && (
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "40px",
                            height: "40px",
                            backgroundColor: "rgba(59, 130, 246, 0.9)",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "18px",
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      padding: "20px",
                    }}
                  >
                    暂无生成的主图
                  </div>
                )
              ) : /* 已上传原图 */
              whiteImageItems.length > 0 ? (
                whiteImageItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      border: `2px solid ${selectedMainImages.includes(index) ? "#3b82f6" : "#e5e7eb"}`,
                      borderRadius: "8px",
                      padding: "4px",
                      backgroundColor: "#f9fafb",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (selectedMainImages.includes(index)) {
                        setSelectedMainImages(
                          selectedMainImages.filter((i) => i !== index),
                        );
                      } else {
                        setSelectedMainImages([...selectedMainImages, index]);
                      }
                    }}
                  >
                    <img
                      src={item.url}
                      alt={`上传原图 ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "120px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                    {selectedMainImages.includes(index) && (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: "40px",
                          height: "40px",
                          backgroundColor: "rgba(59, 130, 246, 0.9)",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "20px",
                  }}
                >
                  暂无上传的原图
                </div>
              )}
            </div>
            <Button
              className="btn primary big"
              style={{ width: "100%" }}
              onClick={async () => {
                // 处理选择后的逻辑，将选中的图片添加到步骤三的图片列表中
                if (activeImageTab === "generated") {
                  const selectedImageIndices = [...selectedMainImages];
                  if (selectedImageIndices.length > 0) {
                    const fetchedItems = await Promise.all(
                      selectedImageIndices.map(async (index) => {
                        const selected = generatedMainItems[index];
                        if (!selected) return null;
                        const resp = await fetch(selected.imageUrl, {
                          headers,
                        });
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
                    const newItems = fetchedItems.filter(
                      Boolean,
                    ) as WhiteImageItem[];

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
                  // 从已上传原图中选择
                  const selectedImages = selectedMainImages
                    .map((index) => {
                      const item = whiteImageItems[index];
                      if (!item) return null;
                      // 为每个图片创建新的blob URL，避免原始URL被revoke后影响
                      const newUrl = URL.createObjectURL(item.file);
                      return {
                        file: item.file,
                        url: newUrl,
                      };
                    })
                    .filter(Boolean) as WhiteImageItem[];

                  // 添加到步骤三的图片列表
                  if (selectedImages.length > 0) {
                    setDetailWhiteFiles((prev) => [
                      ...prev,
                      ...selectedImages.map((item) => item.file),
                    ]);
                    setDetailWhiteImageItems((prev) => [
                      ...prev,
                      ...selectedImages,
                    ]);
                    setDetailWhiteViewDescs((prev) => [
                      ...prev,
                      ...selectedImages.map(() => ""),
                    ]);
                  }
                }

                // 清空选中状态并关闭弹窗
                setSelectedMainImages([]);
                setShowMainImageLibrary(false);
              }}
            >
              确认选择({selectedMainImages.length}张)
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
