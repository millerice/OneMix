import type { DragEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  dragOver: boolean;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  className?: string;
  children: ReactNode;
};

export function DropZone({
  dragOver,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  className,
  children,
}: DropZoneProps) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors duration-150 ease-out",
        dragOver && "border-primary bg-primary/5 ring-2 ring-primary/15",
        className,
      )}
    >
      {children}
    </div>
  );
}
