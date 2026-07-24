import type { DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
} from "lucide-react";
import type { JobState, SlotRow, StrategyGroup, WhiteImageItem } from "@/types";
import type { ResultThumbItem } from "@/components/images/ResultThumbGrid";
import { DropZone } from "@/components/images/DropZone";
import { WhiteImageGrid } from "@/components/images/WhiteImageGrid";
import { GenerationPanel } from "@/components/steps/GenerationPanel";
import { StepFormFields } from "@/components/steps/StepFormFields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StepMainProps = {
  name: string;
  strategy: string;
  nMainInput: string;
  onNameChange: (v: string) => void;
  onStrategyChange: (v: string) => void;
  onCountChange: (v: string) => void;
  strategyGroups?: StrategyGroup[];
  syncingStrategies?: boolean;
  onSyncStrategies?: () => void | Promise<void>;
  whiteImageItems: WhiteImageItem[];
  isDragOver: boolean;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onSelectWhiteFiles: (files: FileList | null) => void;
  onRemoveWhite: (index: number) => void;
  onReplaceWhite: (index: number, file: File | null) => void;
  onPreview: (url: string, name: string) => void;
  busy: boolean;
  activePlanKind: "main" | "detail" | null;
  mainSlots: SlotRow[];
  collapsePanel: boolean;
  onToggleCollapse: () => void;
  onPlan: () => void | Promise<void>;
  onGenerateAll: () => void | Promise<void>;
  onDownloadZip: () => void;
  onDownloadOneResult?: (item: ResultThumbItem) => void;
  mainJob: JobState;
  resultItems: ResultThumbItem[];
  onMainResultDragStart: (
    e: DragEvent<HTMLElement>,
    imageUrl: string,
    displayIndex: number,
  ) => void;
  onAddGeneratedToWhites: (url: string, name: string) => void;
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
  hasWhiteFiles: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function StepMain(props: StepMainProps) {
  const showSlots = props.activePlanKind === "main" || props.mainSlots.length > 0;

  return (
    <Card className="page-enter">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-2">
          <CardTitle>步骤二：生成主图</CardTitle>
          <CardDescription>上传白底商品图并生成主图提示词与图片。</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={props.onBack}>
          <ArrowLeft className="h-4 w-4" />
          返回修改
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <DropZone
          dragOver={props.isDragOver}
          onDragEnter={props.onDragEnter}
          onDragOver={props.onDragOver}
          onDragLeave={props.onDragLeave}
          onDrop={props.onDrop}
        >
          <div className="space-y-2">
            <Label htmlFor="main-white-upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              主图白底商品图（多选）
            </Label>
            <p className="text-xs text-muted-foreground">
              支持多选或拖拽图片到此区域；也可将生成结果拖回作为参考图。
            </p>
            <Input
              id="main-white-upload"
              type="file"
              accept="image/*"
              multiple
              disabled={props.busy}
              onChange={(e) => props.onSelectWhiteFiles(e.target.files)}
            />
          </div>
          <WhiteImageGrid
            items={props.whiteImageItems}
            disabled={props.busy}
            onRemove={props.onRemoveWhite}
            onReplace={props.onReplaceWhite}
            onPreview={props.onPreview}
          />
        </DropZone>

        <StepFormFields
          name={props.name}
          strategy={props.strategy}
          countInput={props.nMainInput}
          countLabel="主图数量"
          countMax={10}
          strategyGroups={props.strategyGroups}
          syncingStrategies={props.syncingStrategies}
          onSyncStrategies={props.onSyncStrategies}
          onNameChange={props.onNameChange}
          onStrategyChange={props.onStrategyChange}
          onCountChange={props.onCountChange}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={props.busy}
            onClick={() => void props.onPlan()}
          >
            <Sparkles className="h-4 w-4" />
            生成主图提示词
          </Button>
          {showSlots && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={props.onToggleCollapse}
              aria-label={props.collapsePanel ? "展开提示词面板" : "折叠提示词面板"}
            >
              {props.collapsePanel ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        <GenerationPanel
          showPanel={showSlots}
          collapsePanel={props.collapsePanel}
          slots={props.mainSlots}
          strategy={props.strategy}
          emptyHint='点击「生成主图提示词」后，这里会展示主图提示词。'
          busy={props.busy}
          canGenerate={props.hasWhiteFiles}
          getRefWhiteItems={props.getRefWhiteItems}
          getRefWhiteIndex={props.getRefWhiteIndex}
          onPromptChange={props.onPromptChange}
          onRefChange={props.onRefChange}
          onAspectChange={props.onAspectChange}
          onResolutionChange={props.onResolutionChange}
          onBatchImageSizeChange={props.onBatchImageSizeChange}
          onRefine={props.onRefine}
          onGenerateOne={props.onGenerateOne}
          onPreviewError={props.onPreviewError}
          onGenerateAll={props.onGenerateAll}
          onDownloadZip={props.onDownloadZip}
          onDownloadOne={props.onDownloadOneResult}
          job={props.mainJob}
          generateLabel="一键生成主图"
          resultItems={props.resultItems}
          onResultDragStart={props.onMainResultDragStart}
          onPreview={props.onPreview}
          onAddAsRef={props.onAddGeneratedToWhites}
        />

        <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-5">
          <Button type="button" variant="outline" onClick={props.onBack}>
            上一步：信息提取
          </Button>
          <Button
            type="button"
            disabled={props.busy || props.mainSlots.length === 0}
            onClick={props.onNext}
          >
            下一步：生成详情
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
