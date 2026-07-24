import { ArrowRight, Eraser, FileUp, ScanSearch, Sparkles } from "lucide-react";
import type { KeyJson } from "@/types";
import { ExtractResult } from "@/components/extract/ExtractResult";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StepExtractProps = {
  mergedText: string;
  onMergedTextChange: (v: string) => void;
  keyJson: KeyJson | null;
  resultViewMode: "structured" | "json";
  onResultViewModeChange: (mode: "structured" | "json") => void;
  busy: boolean;
  onUploadTextFiles: () => void;
  onOpenOcr: () => void;
  onExtract: () => void | Promise<void>;
  onNext: () => void;
};

export function StepExtract({
  mergedText,
  onMergedTextChange,
  keyJson,
  resultViewMode,
  onResultViewModeChange,
  busy,
  onUploadTextFiles,
  onOpenOcr,
  onExtract,
  onNext,
}: StepExtractProps) {
  return (
    <Card className="page-enter">
      <CardHeader className="space-y-2">
        <CardTitle>商品描述文本</CardTitle>
        <CardDescription>
          上传文件、OCR 识别或手动输入商品描述，然后提取关键信息。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onUploadTextFiles}>
            <FileUp className="h-4 w-4" />
            上传文件
          </Button>
          <Button type="button" variant="outline" onClick={onOpenOcr}>
            <ScanSearch className="h-4 w-4" />
            OCR 识别
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onMergedTextChange("")}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="merged-text">合并文本（可编辑）</Label>
          <Textarea
            id="merged-text"
            rows={9}
            value={mergedText}
            onChange={(e) => onMergedTextChange(e.target.value)}
            className="min-h-[200px] resize-y text-[15px] leading-relaxed"
            placeholder={`在此输入或粘贴商品描述文本…

也可以点击上方按钮：
• 上传文件 — 支持 docx、txt 等格式
• OCR 识别 — 上传图片自动提取文字`}
          />
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            size="lg"
            disabled={busy || !mergedText.trim()}
            onClick={() => void onExtract()}
          >
            <Sparkles className="h-4 w-4" />
            提取关键信息
          </Button>
        </div>

        {keyJson && (
          <ExtractResult
            keyJson={keyJson}
            viewMode={resultViewMode}
            onViewModeChange={onResultViewModeChange}
          />
        )}

        <div className="flex justify-end border-t border-border/60 pt-5">
          <Button type="button" disabled={busy || !keyJson} onClick={onNext}>
            下一步：生成主图
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
