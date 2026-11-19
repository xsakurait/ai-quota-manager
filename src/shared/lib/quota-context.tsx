"use client";

import * as React from "react";
import type { KindFilter, LiveReading, ServiceDef, Summary, UsageMap } from "../types";

export interface QuotaContextValue {
  services: ServiceDef[];
  usage: UsageMap;
  readings: LiveReading[];
  summary: Summary;
  query: string;
  kind: KindFilter;
  setQuery: (q: string) => void;
  setKind: (k: KindFilter) => void;
  onDelta: (service: ServiceDef, delta: number, accountId?: string) => void;
  onSetUsed: (service: ServiceDef, value: number, accountId?: string) => void;
  nextResetText: (service: ServiceDef) => string;
}

const QuotaContext = React.createContext<QuotaContextValue | null>(null);

export function QuotaProvider({
  value,
  children,
}: {
  value: QuotaContextValue;
  children: React.ReactNode;
}) {
  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>;
}

export function useQuota(): QuotaContextValue {
  const ctx = React.useContext(QuotaContext);
  if (ctx === null) {
    throw new Error("useQuota must be used within QuotaProvider");
  }
  return ctx;
}
