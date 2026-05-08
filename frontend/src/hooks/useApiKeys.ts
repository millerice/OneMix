import { useState, useMemo } from "react";

export function useApiKeys() {
  const [apiKey, setApiKey] = useState("");
  const [arkKey, setArkKey] = useState("");
  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (apiKey.trim()) h["X-DashScope-Key"] = apiKey.trim();
    if (arkKey.trim()) h["X-Ark-Key"] = arkKey.trim();
    return h;
  }, [apiKey, arkKey]);
  return { apiKey, setApiKey, arkKey, setArkKey, headers };
}