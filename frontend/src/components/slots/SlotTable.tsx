import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ListChecks, RefreshCw, Sparkles } from "lucide-react";
import {
  clampSlotImageSize,
  defaultAspectForKind,
  getModelImageSizeProfile,
  listAspectOptions,
  listResolutionOptions,
} from "@/constants";
import type { SlotRow, WhiteImageItem } from "@/types";
import { RefWhiteCell } from "@/components/slots/RefWhiteCell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SlotTableProps = {
  slots: SlotRow[];
  strategy: string;
  busy: boolean;
  canGenerate: boolean;
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
};

export function SlotTable({
  slots,
  strategy,
  busy,
  canGenerate,
  getRefWhiteItems,
  getRefWhiteIndex,
  onPromptChange,
  onRefChange,
  onAspectChange,
  onResolutionChange,
  onBatchImageSizeChange,
  onRefine,
  onGenerateOne,
  onPreviewError,
}: SlotTableProps) {
  const profile = useMemo(() => getModelImageSizeProfile(strategy), [strategy]);
  const resolutionOptions = useMemo(
    () => listResolutionOptions(profile),
    [profile],
  );
  const slotKind = slots[0]?.kind ?? "main";
  const sizeOpts = { kind: slotKind as "main" | "detail" };

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchResolution, setBatchResolution] = useState(profile.defaultResolution);
  const [batchAspect, setBatchAspect] = useState(
    defaultAspectForKind(strategy, slotKind),
  );

  const batchAspectOptions = useMemo(
    () => listAspectOptions(profile, batchResolution),
    [profile, batchResolution],
  );

  const openBatchDialog = () => {
    const first = slots[0];
    const clamped = clampSlotImageSize(
      strategy,
      first?.aspect_ratio,
      first?.resolution,
      sizeOpts,
    );
    setBatchResolution(clamped.resolution);
    setBatchAspect(clamped.aspect_ratio);
    setBatchOpen(true);
  };

  const columns = useMemo<ColumnDef<SlotRow>[]>(
    () => [
      {
        accessorKey: "index",
        header: "序号",
        cell: ({ row }) => row.original.index,
      },
      {
        id: "ref",
        header: "参考图",
        cell: ({ row }) => {
          const slot = row.original;
          return (
            <RefWhiteCell
              slot={slot}
              refItems={getRefWhiteItems(slot)}
              refIndex={getRefWhiteIndex(slot)}
              disabled={busy}
              onRefChange={onRefChange}
              onPreviewError={onPreviewError}
            />
          );
        },
      },
      {
        id: "aspect",
        header: () => (
          <div className="flex items-center gap-1">
            <span>尺寸</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              disabled={busy || slots.length === 0}
              onClick={openBatchDialog}
              title="批量设置尺寸与分辨率"
            >
              <ListChecks className="h-3 w-3" />
              批量
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const slot = row.original;
          const clamped = clampSlotImageSize(
            strategy,
            slot.aspect_ratio,
            slot.resolution,
            { kind: slot.kind },
          );
          const aspects = listAspectOptions(profile, clamped.resolution);
          return (
            <Select
              value={clamped.aspect_ratio}
              disabled={busy}
              onValueChange={(v) => onAspectChange(slot.list_index, v)}
            >
              <SelectTrigger className="h-8 min-w-[7.5rem] text-xs" aria-label="尺寸">
                <SelectValue placeholder="尺寸" />
              </SelectTrigger>
              <SelectContent>
                {aspects.map((opt) => (
                  <SelectItem key={opt.aspect} value={opt.aspect}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "resolution",
        header: "分辨率",
        cell: ({ row }) => {
          const slot = row.original;
          const clamped = clampSlotImageSize(
            strategy,
            slot.aspect_ratio,
            slot.resolution,
            { kind: slot.kind },
          );
          const singleRes = resolutionOptions.length <= 1;
          return (
            <Select
              value={clamped.resolution}
              disabled={busy || singleRes}
              onValueChange={(v) => {
                onResolutionChange(slot.list_index, v);
                const nextAspects = listAspectOptions(profile, v);
                if (!nextAspects.some((a) => a.aspect === clamped.aspect_ratio)) {
                  onAspectChange(
                    slot.list_index,
                    defaultAspectForKind(strategy, slot.kind, v),
                  );
                }
              }}
            >
              <SelectTrigger
                className="h-8 min-w-[5.5rem] text-xs"
                aria-label="分辨率"
              >
                <SelectValue placeholder="分辨率" />
              </SelectTrigger>
              <SelectContent>
                {resolutionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "prompt",
        header: "提示词",
        cell: ({ row }) => (
          <Textarea
            rows={2}
            value={row.original.prompt}
            disabled={busy}
            className="min-w-[12rem] text-sm"
            onChange={(e) => onPromptChange(row.original.list_index, e.target.value)}
          />
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onRefine(row.original.list_index)}
            >
              <RefreshCw className="h-3 w-3" />
              重构
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !canGenerate}
              onClick={() => onGenerateOne(row.original.list_index)}
            >
              <Sparkles className="h-3 w-3" />
              生图
            </Button>
          </div>
        ),
      },
    ],
    [
      busy,
      canGenerate,
      getRefWhiteItems,
      getRefWhiteIndex,
      onAspectChange,
      onGenerateOne,
      onPreviewError,
      onPromptChange,
      onRefChange,
      onRefine,
      onResolutionChange,
      profile,
      resolutionOptions,
      slots.length,
      strategy,
    ],
  );

  const table = useReactTable({
    data: slots,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `slot-${row.list_index}`,
  });

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  暂无槽位
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批量设置尺寸与分辨率</DialogTitle>
            <DialogDescription>
              选项来自当前生成策略官方参数，将应用到本表全部 {slots.length}{" "}
              个槽位。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>分辨率</Label>
              <Select
                value={batchResolution}
                disabled={resolutionOptions.length <= 1}
                onValueChange={(v) => {
                  setBatchResolution(v);
                  const next = listAspectOptions(profile, v);
                  if (!next.some((a) => a.aspect === batchAspect)) {
                    setBatchAspect(
                      defaultAspectForKind(strategy, slotKind, v),
                    );
                  }
                }}
              >
                <SelectTrigger aria-label="批量分辨率">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>尺寸</Label>
              <Select value={batchAspect} onValueChange={setBatchAspect}>
                <SelectTrigger aria-label="批量尺寸">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {batchAspectOptions.map((opt) => (
                    <SelectItem key={opt.aspect} value={opt.aspect}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                onBatchImageSizeChange(batchAspect, batchResolution);
                setBatchOpen(false);
              }}
            >
              应用到全部
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
