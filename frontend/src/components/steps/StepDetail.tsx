import type { DragEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, FolderOpen, Sparkles } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type StepDetailProps = {
  name: string;
  strategy: string;
  nDetailInput: string;
  onNameChange: (v: string) => void;
  onStrategyChange: (v: string) => void;
  onCountChange: (v: string) => void;
  strategyGroups?: StrategyGroup[];
  syncingStrategies?: boolean;
  onSyncStrategies?: () => void | Promise<void>;
  detailWhiteImageItems: WhiteImageItem[];
  isDragOver: boolean;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onSelectDetailWhiteFiles: (files: FileList | null) => void;
  onRemoveDetailWhite: (index: number) => void;
  onReplaceDetailWhite: (index: number, file: File | null) => void;
  onOpenMainImageLibrary: () => void;
  onPreview: (url: string, name: string) => void;
  busy: boolean;
  activePlanKind: "main" | "detail" | null;
  detailSlots: SlotRow[];
  collapsePanel: boolean;
  onToggleCollapse: () => void;
  onPlan: () => void | Promise<void>;
  onGenerateAll: () => void | Promise<void>;
  onDownloadZip: () => void;
  onDownloadOneResult?: (item: ResultThumbItem) => void;
  detailJob: JobState;
  resultItems: ResultThumbItem[];
  onDetailResultDragStart: (
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
  canGenerate: boolean;
  onBack: () => void;
};

export function StepDetail(props: StepDetailProps) {
  const showSlots = props.activePlanKind === "detail" || props.detailSlots.length > 0;

  return (
    <Card className="page-enter">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-2">
          <CardTitle>步骤三：生成详情图</CardTitle>
          <CardDescription>上传或从主图库选择白底图，生成详情页图片。</CardDescription>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="detail-white-upload">详情图白底商品图（多选）</Label>
              <p className="text-xs text-muted-foreground">
                可上传、拖拽，或从主图库选用已生成/已上传素材。
              </p>
              <Input
                id="detail-white-upload"
                type="file"
                accept="image/*"
                multiple
                disabled={props.busy}
                onChange={(e) => props.onSelectDetailWhiteFiles(e.target.files)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={props.onOpenMainImageLibrary}
            >
              <FolderOpen className="h-4 w-4" />
              从主图库选择
            </Button>
          </div>
          <WhiteImageGrid
            items={props.detailWhiteImageItems}
            disabled={props.busy}
            onRemove={props.onRemoveDetailWhite}
            onReplace={props.onReplaceDetailWhite}
            onPreview={props.onPreview}
          />
        </DropZone>

        <StepFormFields
          name={props.name}
          strategy={props.strategy}
          countInput={props.nDetailInput}
          countLabel="详情数量"
          countMax={20}
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
            生成详情图提示词
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
          slots={props.detailSlots}
          strategy={props.strategy}
          emptyHint='点击「生成详情图提示词」后，这里会展示详情图提示词。'
          busy={props.busy}
          canGenerate={props.canGenerate}
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
          job={props.detailJob}
          generateLabel="一键生成详情图"
          resultItems={props.resultItems}
          onResultDragStart={props.onDetailResultDragStart}
          onPreview={props.onPreview}
          onAddAsRef={props.onAddGeneratedToWhites}
        />

        <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-5">
          <Button type="button" variant="outline" onClick={props.onBack}>
            上一步：生成主图
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={props.busy || props.detailSlots.length === 0}
            onClick={() => void props.onGenerateAll()}
          >
            <Sparkles className="h-4 w-4" />
            生成详情图
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
