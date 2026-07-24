import { useId } from "react";
import { Check, ImageIcon, ScanSearch, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropZone } from "@/components/images/DropZone";

type OcrImageItem = { file: File; url: string };

type OcrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageItems: OcrImageItem[];
  result: string;
  onResultChange: (v: string) => void;
  dragOver: boolean;
  busy: boolean;
  onDragEnter: React.ComponentProps<typeof DropZone>["onDragEnter"];
  onDragOver: React.ComponentProps<typeof DropZone>["onDragOver"];
  onDragLeave: React.ComponentProps<typeof DropZone>["onDragLeave"];
  onDrop: React.ComponentProps<typeof DropZone>["onDrop"];
  onFileInputChange: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onRecognize: () => void | Promise<void>;
  onConfirm: () => void;
};

export function OcrDialog({
  open,
  onOpenChange,
  imageItems,
  result,
  onResultChange,
  dragOver,
  busy,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  onRemoveImage,
  onRecognize,
  onConfirm,
}: OcrDialogProps) {
  const inputId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>OCR 图片识别</DialogTitle>
        </DialogHeader>

        <DropZone
          dragOver={dragOver}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className="rounded-lg border border-dashed p-6 text-center"
        >
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm">点击或拖拽上传图片</p>
          <p className="text-xs text-muted-foreground">支持 jpg、png，可多选</p>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFileInputChange(e.target.files)}
          />
          <Button type="button" variant="secondary" className="mt-3" asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              <Upload className="h-4 w-4" />
              选择图片
            </label>
          </Button>
        </DropZone>

        {imageItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {imageItems.map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="relative rounded-md border p-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full"
                  onClick={() => onRemoveImage(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="aspect-square w-full rounded object-cover"
                />
                <p className="truncate pt-1 text-[10px]">{item.file.name}</p>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          disabled={busy || imageItems.length === 0}
          onClick={() => void onRecognize()}
        >
          <ScanSearch className="h-4 w-4" />
          OCR 识别（仅提取文字）
        </Button>

        <div className="space-y-2">
          <Label>识别结果（可编辑）</Label>
          <Textarea
            rows={6}
            value={result}
            onChange={(e) => onResultChange(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" disabled={!result.trim()} onClick={onConfirm}>
            <Check className="h-4 w-4" />
            合并到描述文本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
