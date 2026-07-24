import { Replace, X } from "lucide-react";
import type { WhiteImageItem } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WhiteImageGridProps = {
  items: WhiteImageItem[];
  onRemove: (index: number) => void;
  onReplace: (index: number, file: File | null) => void;
  onPreview: (url: string, name: string) => void;
  disabled?: boolean;
};

export function WhiteImageGrid({
  items,
  onRemove,
  onReplace,
  onPreview,
  disabled,
}: WhiteImageGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
      {items.map((item, idx) => (
        <div
          key={`${item.file.name}-${idx}`}
          className="group relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full opacity-90 shadow-sm"
            disabled={disabled}
            onClick={() => onRemove(idx)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <button
            type="button"
            className="block w-full cursor-pointer"
            onClick={() => onPreview(item.url, item.file.name)}
          >
            <img
              src={item.url}
              alt={item.file.name}
              className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
            />
          </button>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-2">
            <p className="truncate text-xs text-muted-foreground" title={item.file.name}>
              {item.file.name}
            </p>
            <label
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
              title="替换图片"
            >
              <Replace className="h-3.5 w-3.5" />
              替换
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  onReplace(idx, e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
