import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type KeyCardProps = {
  title: string;
  configured: boolean;
  preview?: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  children?: ReactNode;
};

export function KeyCard({
  title,
  configured,
  preview,
  editing,
  onToggleEdit,
  children,
}: KeyCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? `已保存 ${preview ?? ""}` : "未设置"}
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={onToggleEdit}>
              {editing ? "收起" : configured ? "编辑" : "添加"}
            </Button>
          </div>
        </div>
        <CardDescription>服务端默认 Key，用于 LLM 与图像生成</CardDescription>
      </CardHeader>
      {editing && children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
