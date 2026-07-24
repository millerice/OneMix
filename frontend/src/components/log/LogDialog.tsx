import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: string;
};

export function LogDialog({ open, onOpenChange, log }: LogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>运行日志</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/50 p-4 text-xs leading-relaxed whitespace-pre-wrap">
          {log || "等待操作..."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
