import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImagePreviewDialogProps = {
  url: string | null;
  name: string;
  onClose: () => void;
};

export function ImagePreviewDialog({
  url,
  name,
  onClose,
}: ImagePreviewDialogProps) {
  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{name}</DialogTitle>
        </DialogHeader>
        {url && (
          <img
            src={url}
            alt={name}
            className="max-h-[70vh] w-full rounded-md object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
