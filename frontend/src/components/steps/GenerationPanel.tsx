import type { DragEvent } from "react";
import { Download, Sparkles } from "lucide-react";
import type { JobState, SlotRow, WhiteImageItem } from "@/types";
import { ResultThumbGrid, type ResultThumbItem } from "@/components/images/ResultThumbGrid";
import { SlotTable } from "@/components/slots/SlotTable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type GenerationPanelProps = {
  showPanel: boolean;
  collapsePanel: boolean;
  slots: SlotRow[];
  strategy: string;
  emptyHint: string;
  busy: boolean;
  canGenerate: boolean;
  getRefWhiteItems: (slot: SlotRow) => WhiteImageItem[];
  getRefWhiteIndex: (slot: SlotRow) => number;
  onPromptChange: (listIndex: number, prompt: string) => void;
  onRefChange: (listIndex: number, refWhiteIndex: number) => void;
  onAspectChange: (listIndex: number, aspectRatio: string) => void;
  onResolutionChange: (listIndex: number, resolution: string) => void;
  onBatchImageSizeChange: (aspectRatio: string, resolution: string) => void;
  onRefine: (listIndex: number) => void;
  onGenerateOne: (listIndex: number) => void;
  onPreviewError: (slot: SlotRow, index: number) => void;
  onGenerateAll: () => void | Promise<void>;
  onDownloadZip: () => void;
  onDownloadOne?: (item: ResultThumbItem) => void | Promise<void>;
  job: JobState;
  generateLabel: string;
  resultItems: ResultThumbItem[];
  onResultDragStart: (
    e: DragEvent<HTMLElement>,
    imageUrl: string,
    displayIndex: number,
  ) => void;
  onPreview: (url: string, name: string) => void;
  onAddAsRef: (url: string, name: string) => void;
};

export function GenerationPanel({
  showPanel,
  collapsePanel,
  slots,
  strategy,
  emptyHint,
  busy,
  canGenerate,
  getRefWhiteItems,
  getRefWhiteIndex,
  onPromptChange,
  onRefChange,
  onAspectChange,
  onResolutionChange,
  onBatchImageSizeChange,
  onRefine,
  onGenerateOne,
  onPreviewError,
  onGenerateAll,
  onDownloadZip,
  onDownloadOne,
  job,
  generateLabel,
  resultItems,
  onResultDragStart,
  onPreview,
  onAddAsRef,
}: GenerationPanelProps) {
  if (!showPanel || collapsePanel) return null;

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    );
  }

  const progressPct =
    job.progress.t > 0
      ? Math.min(100, Math.round((job.progress.p / job.progress.t) * 100))
      : 0;

  const canBatchDownload =
    !!job.jobId && (job.status === "completed" || resultItems.length > 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-border/80">
        <SlotTable
          slots={slots}
          strategy={strategy}
          busy={busy}
          canGenerate={canGenerate}
          getRefWhiteItems={getRefWhiteItems}
          getRefWhiteIndex={getRefWhiteIndex}
          onPromptChange={onPromptChange}
          onRefChange={onRefChange}
          onAspectChange={onAspectChange}
          onResolutionChange={onResolutionChange}
          onBatchImageSizeChange={onBatchImageSizeChange}
          onRefine={onRefine}
          onGenerateOne={onGenerateOne}
          onPreviewError={onPreviewError}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          size="lg"
          disabled={busy || !canGenerate}
          onClick={() => void onGenerateAll()}
        >
          <Sparkles className="h-4 w-4" />
          {generateLabel}
        </Button>
        {canBatchDownload && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onDownloadZip}
          >
            <Download className="h-4 w-4" />
            一键批量下载
          </Button>
        )}
        {job.status && (
          <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[180px]">
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>任务状态：{job.status}</span>
              {job.progress.t > 0 && (
                <span>
                  {job.progress.p}/{job.progress.t}
                </span>
              )}
            </div>
            {job.progress.t > 0 && <Progress value={progressPct} className="h-1.5" />}
          </div>
        )}
      </div>

      <ResultThumbGrid
        items={resultItems}
        disabled={busy}
        onDragStart={onResultDragStart}
        onPreview={onPreview}
        onAddAsRef={onAddAsRef}
        onDownloadOne={onDownloadOne}
        onDownloadAll={onDownloadZip}
        canDownloadAll={canBatchDownload}
      />
    </div>
  );
}
