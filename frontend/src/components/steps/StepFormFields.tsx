import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleHelp, RefreshCw } from "lucide-react";
import { STRATEGY_GROUPS } from "@/constants";
import type { StrategyGroup } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const schema = z.object({
  name: z.string().min(1, "请填写商品名称"),
  strategy: z.string().min(1),
  count: z.string().regex(/^\d+$/, "请输入有效数量"),
});

type FormValues = z.infer<typeof schema>;

type StepFormFieldsProps = {
  name: string;
  strategy: string;
  countInput: string;
  countLabel: string;
  countMax: number;
  strategyGroups?: StrategyGroup[];
  syncingStrategies?: boolean;
  onSyncStrategies?: () => void | Promise<void>;
  onNameChange: (v: string) => void;
  onStrategyChange: (v: string) => void;
  onCountChange: (v: string) => void;
};

function ModelHelpHint({ description }: { description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={description}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px] leading-relaxed">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

export function StepFormFields({
  name,
  strategy,
  countInput,
  countLabel,
  countMax,
  strategyGroups = STRATEGY_GROUPS,
  syncingStrategies = false,
  onSyncStrategies,
  onNameChange,
  onStrategyChange,
  onCountChange,
}: StepFormFieldsProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name, strategy, count: countInput },
  });

  useEffect(() => {
    form.reset({ name, strategy, count: countInput });
  }, [name, strategy, countInput, form]);

  const selectedDescription = useMemo(() => {
    for (const g of strategyGroups) {
      const hit = g.models.find((m) => m.value === strategy);
      if (hit?.description) return hit.description;
    }
    return null;
  }, [strategy, strategyGroups]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="step-name">商品名称</Label>
        <Input
          id="step-name"
          {...form.register("name", { onChange: (e) => onNameChange(e.target.value) })}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>生成策略</Label>
          {onSyncStrategies ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={syncingStrategies}
              onClick={() => void onSyncStrategies()}
              title="同步豆包与千问模型开通状态"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncingStrategies ? "animate-spin" : ""}`}
              />
              同步开通状态
            </Button>
          ) : null}
        </div>
        <TooltipProvider delayDuration={200}>
          <Select
            value={strategy}
            onValueChange={(v) => {
              onStrategyChange(v);
              form.setValue("strategy", v);
            }}
          >
            <SelectTrigger aria-label="生成策略">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {strategyGroups.map((group, gi) => (
                <SelectGroup key={group.id}>
                  {gi > 0 ? <SelectSeparator /> : null}
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.models.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      textValue={s.label}
                      hint={
                        s.description ? (
                          <ModelHelpHint description={s.description} />
                        ) : undefined
                      }
                    >
                      {s.label}
                      {s.activation === "open"
                        ? " · 已开通"
                        : s.activation === "closed"
                          ? " · 未开通"
                          : s.synced
                            ? " · 已开通"
                            : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </TooltipProvider>
        {selectedDescription ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {selectedDescription}
          </p>
        ) : null}
      </div>
      <div className="space-y-2 md:col-span-2 md:max-w-xs">
        <Label htmlFor="step-count">{countLabel}</Label>
        <Input
          id="step-count"
          type="number"
          min={1}
          max={countMax}
          {...form.register("count", { onChange: (e) => onCountChange(e.target.value) })}
        />
      </div>
    </div>
  );
}
