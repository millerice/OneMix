import { RefreshCw } from "lucide-react";
import type { ServerSettings } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyCard } from "./KeyCard";
import { KeyEditForm } from "./KeyEditForm";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverSettings: ServerSettings | null;
  apiKey: string;
  setApiKey: (v: string) => void;
  arkKey: string;
  setArkKey: (v: string) => void;
  editingKey: "dashscope" | "ark" | null;
  setEditingKey: (v: "dashscope" | "ark" | null) => void;
  onSaveDashScope: () => void | Promise<void>;
  onClearDashScope: () => void | Promise<void>;
  onSaveArk: () => void | Promise<void>;
  onClearArk: () => void | Promise<void>;
  onSyncArkModels?: () => void | Promise<void>;
  onSyncQwenModels?: () => void | Promise<void>;
  syncingArkModels?: boolean;
  syncingQwenModels?: boolean;
  busy: boolean;
};

export function SettingsDialog({
  open,
  onOpenChange,
  serverSettings,
  apiKey,
  setApiKey,
  arkKey,
  setArkKey,
  editingKey,
  setEditingKey,
  onSaveDashScope,
  onClearDashScope,
  onSaveArk,
  onClearArk,
  onSyncArkModels,
  onSyncQwenModels,
  syncingArkModels = false,
  syncingQwenModels = false,
  busy,
}: SettingsDialogProps) {
  const handleSaveDashScope = async () => {
    await onSaveDashScope();
    setEditingKey(null);
  };

  const handleSaveArk = async () => {
    await onSaveArk();
    setEditingKey(null);
  };

  const canSyncArk = !!arkKey.trim() || !!serverSettings?.has_ark_key;
  const canSyncQwen = !!apiKey.trim() || !!serverSettings?.has_dashscope_key;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Key 设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <KeyCard
            title="阿里百炼 (DashScope)"
            configured={!!serverSettings?.has_dashscope_key}
            preview={serverSettings?.dashscope_key_preview}
            editing={editingKey === "dashscope"}
            onToggleEdit={() =>
              setEditingKey(editingKey === "dashscope" ? null : "dashscope")
            }
          >
            <KeyEditForm
              defaultValue={apiKey}
              onValueChange={setApiKey}
              onSave={handleSaveDashScope}
              onClear={onClearDashScope}
              busy={busy}
              placeholder="输入 DashScope Key"
            />
            {onSyncQwenModels ? (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy || syncingQwenModels || !canSyncQwen}
                  onClick={() => void onSyncQwenModels()}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncingQwenModels ? "animate-spin" : ""}`}
                  />
                  同步 Qwen-Image 开通状态
                </Button>
                <p className="text-xs text-muted-foreground">
                  调用百炼 Models.list / Models.get，过滤 qwen-image；未在账号可见则不会标「已开通」。
                </p>
              </div>
            ) : null}
          </KeyCard>
          <KeyCard
            title="豆包 ARK"
            configured={!!serverSettings?.has_ark_key}
            preview={serverSettings?.ark_key_preview}
            editing={editingKey === "ark"}
            onToggleEdit={() => setEditingKey(editingKey === "ark" ? null : "ark")}
          >
            <KeyEditForm
              defaultValue={arkKey}
              onValueChange={setArkKey}
              onSave={handleSaveArk}
              onClear={onClearArk}
              busy={busy}
              placeholder="输入豆包 ARK Key"
            />
            {onSyncArkModels ? (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy || syncingArkModels || !canSyncArk}
                  onClick={() => void onSyncArkModels()}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncingArkModels ? "animate-spin" : ""}`}
                  />
                  同步 Seedream 模型列表
                </Button>
                <p className="text-xs text-muted-foreground">
                  调用方舟模型列表，并对 Seedream 做免出图开通探测（未开通会标「未开通」）。
                </p>
              </div>
            ) : null}
          </KeyCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}
