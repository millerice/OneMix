import { Loader2 } from "lucide-react";

type BusyOverlayProps = {
  busy: boolean;
};

export function BusyOverlay({ busy }: BusyOverlayProps) {
  if (!busy) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
        <p className="mt-5 text-base font-medium tracking-tight">正在处理，请稍候…</p>
        <p className="mt-2 text-sm text-muted-foreground">
          页面已暂时锁定，避免重复提交。
        </p>
      </div>
    </div>
  );
}
