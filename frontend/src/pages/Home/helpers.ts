import type { ResultThumbItem } from "@/components/images/ResultThumbGrid";
import type { useOneMixApp } from "@/hooks/useOneMixApp";
import type { SlotRow } from "@/types";

export function buildMainResults(
  slots: SlotRow[],
  resultMap: Map<number, string>,
): ResultThumbItem[] {
  return slots
    .filter((s) => resultMap.has(s.list_index))
    .map((s) => {
      const jobId = resultMap.get(s.list_index)!;
      return {
        listIndex: s.list_index,
        displayIndex: s.index,
        imageUrl: `/api/jobs/${jobId}/result/${s.list_index}`,
        label: `主图 ${s.index}`,
      };
    });
}

export function buildDetailResults(
  slots: SlotRow[],
  resultMap: Map<number, string>,
): ResultThumbItem[] {
  return slots
    .filter((s) => resultMap.has(s.list_index))
    .map((s) => {
      const jobId = resultMap.get(s.list_index)!;
      return {
        listIndex: s.list_index,
        displayIndex: s.index,
        imageUrl: `/api/jobs/${jobId}/result/${s.list_index}`,
        label: `详情图 ${s.index}`,
      };
    });
}

export function previewErrorHandler(
  app: ReturnType<typeof useOneMixApp>,
  slot: SlotRow,
  index: number,
) {
  if (slot.kind === "detail") app.refreshDetailPreviewUrl(index);
  else app.refreshWhitePreviewUrl(index);
}
