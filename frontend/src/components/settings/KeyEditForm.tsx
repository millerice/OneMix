import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const keySchema = z.object({
  apiKey: z.string().min(1, "请输入 API Key"),
});

type KeyFormValues = z.infer<typeof keySchema>;

type KeyEditFormProps = {
  defaultValue: string;
  onValueChange: (v: string) => void;
  onSave: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  busy: boolean;
  placeholder: string;
};

export function KeyEditForm({
  defaultValue,
  onValueChange,
  onSave,
  onClear,
  busy,
  placeholder,
}: KeyEditFormProps) {
  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keySchema),
    defaultValues: { apiKey: defaultValue },
  });

  useEffect(() => {
    form.reset({ apiKey: defaultValue });
  }, [defaultValue, form]);

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit(async (values) => {
        onValueChange(values.apiKey);
        await onSave();
      })}
    >
      <div className="space-y-2">
        <Label htmlFor={placeholder}>API Key</Label>
        <Input
          id={placeholder}
          type="password"
          placeholder={placeholder}
          {...form.register("apiKey", {
            onChange: (e) => onValueChange(e.target.value),
          })}
        />
        {form.formState.errors.apiKey && (
          <p className="text-xs text-destructive">
            {form.formState.errors.apiKey.message}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onClear()}
        >
          清除
        </Button>
      </div>
    </form>
  );
}
