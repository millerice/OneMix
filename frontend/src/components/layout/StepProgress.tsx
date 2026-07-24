import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["信息提取", "生成主图", "生成详情"] as const;

type StepProgressProps = {
  currentStep: number;
};

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <nav
      aria-label="流程进度"
      className="rounded-xl border border-border/80 bg-card/70 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-6"
    >
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const completed = currentStep > stepNum;
          const current = currentStep === stepNum;
          const isLast = i === STEPS.length - 1;

          return (
            <li key={label} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors duration-150",
                    completed && "bg-primary text-primary-foreground",
                    current && !completed && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                    !completed && !current && "bg-muted text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={cn(
                    "hidden text-sm sm:inline",
                    current || completed
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-3 h-px flex-1 sm:mx-4",
                    completed ? "bg-primary/50" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
