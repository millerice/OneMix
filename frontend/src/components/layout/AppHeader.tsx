import { ScrollText, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  onSettings: () => void;
  onLog: () => void;
};

export function AppHeader({ onSettings, onLog }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-2xl font-semibold tracking-tight text-foreground dark:text-white md:text-3xl">
          OneMix
        </p>
        <h1 className="max-w-xl text-base font-medium text-muted-foreground dark:text-white/85 md:text-lg">
          一键生成电商图片
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-white/70">
          上传商品信息 → 提取关键参数 → 自动生成提示词并批量生成主图与详情图。
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettings}
          aria-label="API Key 设置"
          title="API Key 设置"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onLog}
          aria-label="运行日志"
          title="运行日志"
        >
          <ScrollText className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
