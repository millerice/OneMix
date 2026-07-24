import type { DragEvent } from "react";
import { Download, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ResultThumbItem = {
  listIndex: number;
  displayIndex: number;
  imageUrl: string;
  label: string;
};

type ResultThumbGridProps = {
  items: ResultThumbItem[];
  disabled?: boolean;
  onDragStart: (e: DragEvent<HTMLElement>, imageUrl: string, displayIndex: number) => void;
  onPreview: (url: string, name: string) => void;
  onAddAsRef: (imageUrl: string, imageName: string) => void;
  onDownloadOne?: (item: ResultThumbItem) => void | Promise<void>;
  onDownloadAll?: () => void | Promise<void>;
  canDownloadAll?: boolean;
};

export function ResultThumbGrid({
  items,
  disabled,
  onDragStart,
  onPreview,
  onAddAsRef,
  onDownloadOne,
  onDownloadAll,
  canDownloadAll = false,
}: ResultThumbGridProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium text-foreground">生成结果</h3>
          <p className="text-xs text-muted-foreground">可单张下载，或一键批量打包</p>
        </div>
        {onDownloadAll ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !canDownloadAll}
            onClick={() => void onDownloadAll()}
          >
            <Download className="h-3.5 w-3.5" />
            一键批量下载
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
        {items.map((item) => (
          <div key={`result-${item.listIndex}`} className="space-y-2">
            <button
              type="button"
              draggable
              disabled={disabled}
              onDragStart={(e) => onDragStart(e, item.imageUrl, item.displayIndex)}
              onClick={() => onPreview(item.imageUrl, item.label)}
              className="group block w-full overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-colors duration-150 hover:border-primary/40 disabled:opacity-50"
            >
              <img
                src={item.imageUrl}
                alt={item.label}
                className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
              />
              <p className="truncate px-2.5 py-2 text-xs font-medium text-foreground">
                {item.label}
              </p>
            </button>
            <div className="flex gap-1.5">
              {onDownloadOne ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 min-w-0 flex-1 gap-1 px-1.5 text-[11px]"
                  disabled={disabled}
                  onClick={() => void onDownloadOne(item)}
                >
                  <Download className="h-3 w-3 shrink-0" />
                  <span className="truncate">下载此图</span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 min-w-0 flex-1 gap-1 px-1.5 text-[11px]"
                disabled={disabled}
                onClick={() =>
                  onAddAsRef(item.imageUrl, `${item.label.replace(/\s/g, "")}.jpg`)
                }
              >
                <ImagePlus className="h-3 w-3 shrink-0" />
                <span className="truncate">选为参考图</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
