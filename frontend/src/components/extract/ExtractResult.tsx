import {
  ClipboardList,
  Heart,
  Package,
  Palette,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { KeyJson } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ExtractResultProps = {
  keyJson: KeyJson;
  viewMode: "structured" | "json";
  onViewModeChange: (mode: "structured" | "json") => void;
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  商品基础身份: Package,
  targetAudience: User,
  emotionalAssociation: Heart,
  styleTone: Palette,
};

function ResultSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
        <Icon className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((tag, i) => (
        <Badge key={i} variant="secondary">
          {tag}
        </Badge>
      ))}
    </>
  );
}

function StructuredView({ keyJson }: { keyJson: KeyJson }) {
  const baseIdentity = keyJson["商品基础身份"] as
    | Record<string, unknown>
    | undefined;

  const skipKeys = new Set([
    "targetAudience",
    "emotionalAssociation",
    "styleTone",
    "商品基础身份",
  ]);

  return (
    <div className="space-y-3">
      {baseIdentity && (
        <ResultSection title="商品基础身份" icon={Package}>
          {Object.entries(baseIdentity).map(([k, v], i) => (
            <Badge key={i} variant="secondary">
              {k}: {String(v)}
            </Badge>
          ))}
        </ResultSection>
      )}

      {Array.isArray(keyJson.targetAudience) && keyJson.targetAudience.length > 0 && (
        <ResultSection title="目标用户画像" icon={User}>
          <TagList items={keyJson.targetAudience.map(String)} />
        </ResultSection>
      )}

      {Array.isArray(keyJson.emotionalAssociation) &&
        keyJson.emotionalAssociation.length > 0 && (
          <ResultSection title="情感联想" icon={Heart}>
            <TagList items={keyJson.emotionalAssociation.map(String)} />
          </ResultSection>
        )}

      {Array.isArray(keyJson.styleTone) && keyJson.styleTone.length > 0 && (
        <ResultSection title="风格与调性" icon={Palette}>
          <TagList items={keyJson.styleTone.map(String)} />
        </ResultSection>
      )}

      {Object.entries(keyJson).map(([key, value]) => {
        if (skipKeys.has(key)) return null;
        const Icon = SECTION_ICONS[key] ?? ClipboardList;

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return (
            <ResultSection key={key} title={key} icon={Icon}>
              {Object.entries(value as Record<string, unknown>).map(([sk, sv], i) => (
                <Badge key={i} variant="secondary">
                  {sk}: {String(sv)}
                </Badge>
              ))}
            </ResultSection>
          );
        }

        if (Array.isArray(value)) {
          return (
            <ResultSection key={key} title={key} icon={Icon}>
              <TagList items={value.map(String)} />
            </ResultSection>
          );
        }

        return (
          <ResultSection key={key} title={key} icon={Icon}>
            <Badge variant="secondary">{String(value)}</Badge>
          </ResultSection>
        );
      })}
    </div>
  );
}

export function ExtractResult({
  keyJson,
  viewMode,
  onViewModeChange,
}: ExtractResultProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
      <h3 className="text-sm font-medium">提取结果</h3>
      <Tabs
        value={viewMode}
        onValueChange={(v) => onViewModeChange(v as "structured" | "json")}
      >
        <TabsList>
          <TabsTrigger value="structured">结构化</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="structured" className="mt-4">
          <StructuredView keyJson={keyJson} />
        </TabsContent>
        <TabsContent value="json" className="mt-4">
          <pre className="max-h-96 overflow-auto rounded-xl border border-border/70 bg-card p-4 text-xs leading-relaxed">
            {JSON.stringify(keyJson, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
