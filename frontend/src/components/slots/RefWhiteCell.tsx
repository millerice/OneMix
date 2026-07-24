import type { SlotRow, WhiteImageItem } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RefWhiteCellProps = {
  slot: SlotRow;
  refItems: WhiteImageItem[];
  refIndex: number;
  disabled?: boolean;
  onRefChange: (listIndex: number, refWhiteIndex: number) => void;
  onPreviewError: (slot: SlotRow, index: number) => void;
};

export function RefWhiteCell({
  slot,
  refItems,
  refIndex,
  disabled,
  onRefChange,
  onPreviewError,
}: RefWhiteCellProps) {
  const refItem = refItems.length > 0 ? refItems[refIndex] : undefined;

  return (
    <div className="flex min-w-[72px] flex-col items-center gap-1.5">
      {refItem ? (
        <img
          src={refItem.url}
          alt={`白底参考图 ${refIndex + 1}`}
          className="h-10 w-10 rounded-md object-cover"
          onError={() => onPreviewError(slot, refIndex)}
        />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      {refItems.length > 0 && (
        <Select
          value={String(refIndex)}
          disabled={disabled}
          onValueChange={(v) => onRefChange(slot.list_index, Number(v))}
        >
          <SelectTrigger className="h-8 max-w-[7rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {refItems.map((it, i) => (
              <SelectItem key={`${it.file.name}-${i}`} value={String(i)}>
                白底图 {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
