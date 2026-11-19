"use client";

import * as React from "react";
import { CATALOG, CONFIG } from "../../shared/config/catalog";
import { usageKey } from "../../shared/lib/accounts";
import {
  applyDelta,
  clampUsage,
  filterServices,
  loadUsage,
  nextReset,
  saveUsage,
  summarize,
} from "../../shared/lib/quota";
import { QuotaProvider, type QuotaContextValue } from "../../shared/lib/quota-context";
import { parseReadings } from "../../shared/lib/readings";
import { Button } from "../../shared/ui/button";
import { Input } from "../../shared/ui/input";
import type { KindFilter, LiveReading, ServiceDef, UsageMap } from "../../shared/types";

const KIND_FILTERS: KindFilter[] = ["all", "video", "local", "gpu", "voice"];

export function Dashboard({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = React.useState<UsageMap>({});
  const [readings, setReadings] = React.useState<LiveReading[]>([]);
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setUsage(loadUsage(window.localStorage));
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (loaded) {
      saveUsage(window.localStorage, usage);
    }
  }, [usage, loaded]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/readings")
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) {
          setReadings(parseReadings(text));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadings([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDelta = React.useCallback((service: ServiceDef, delta: number, accountId?: string) => {
    setUsage((prev) => {
      const key = usageKey(service.id, accountId);
      return { ...prev, [key]: applyDelta(service, prev[key] ?? 0, delta) };
    });
  }, []);

  const onSetUsed = React.useCallback((service: ServiceDef, value: number, accountId?: string) => {
    setUsage((prev) => {
      const key = usageKey(service.id, accountId);
      return { ...prev, [key]: clampUsage(service, value) };
    });
  }, []);

  const nextResetText = React.useCallback((service: ServiceDef) => {
    return nextReset(service.cycle).toLocaleString("ja-JP");
  }, []);

  const filtered = filterServices(CATALOG, query, kind);
  const summary = summarize(usage);

  const value: QuotaContextValue = {
    services: filtered,
    usage,
    readings,
    summary,
    query,
    kind,
    setQuery,
    setKind,
    onDelta,
    onSetUsed,
    nextResetText,
  };

  return (
    <QuotaProvider value={value}>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{CONFIG.appName}</h1>
          <p className="text-sm text-muted-foreground">
            対象 {summary.count} 件 / 合計使用量 {summary.used} / 合計上限 {summary.limit} / 枯渇 {summary.exhausted} 件
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="サービス名で検索"
            aria-label="サービス名で検索"
            className="max-w-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {KIND_FILTERS.map((k) => (
            <Button key={k} type="button" variant={kind === k ? "default" : "outline"} size="sm" onClick={() => setKind(k)}>
              {CONFIG.filterLabels[k]}
            </Button>
          ))}
        </div>
        {children}
        {filtered.length === 0 ? <p>該当するサービスがありません</p> : null}
      </main>
    </QuotaProvider>
  );
}
