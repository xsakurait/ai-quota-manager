export type ServiceKind = "video" | "image" | "local" | "gpu" | "voice";
export type ResetCycle = "daily" | "weekly" | "monthly" | "5hour";
export type Status = "ok" | "warning" | "exhausted";
export type KindFilter = ServiceKind | "all";

export interface AccountDef {
  id: string;
  label: string;
}

export interface ServiceDef {
  id: string;
  name: string;
  kind: ServiceKind;
  limit: number;
  unit: string;
  cycle: ResetCycle;
  note: string;
  /** Official usage/billing page opened in a new tab; the login itself is
   *  handled by the user's existing browser session (no credentials stored). */
  dashboardUrl?: string;
  accounts?: AccountDef[];
}

export interface ReadingWindow {
  windowMinutes: number;
  usedPercent: number;
  /** Unix seconds when this window resets. */
  resetsAt: number;
}

export interface LiveReading {
  serviceId: string;
  accountId?: string;
  source: string;
  capturedAt: string;
  windows: ReadingWindow[];
  note?: string;
}

export interface QuotaStatus {
  serviceId: string;
  used: number;
  remaining: number;
  usagePercent: number;
  remainingPercent: number;
  status: Status;
  statusLabel: string;
  nextReset: string;
}

export interface Summary {
  count: number;
  used: number;
  limit: number;
  exhausted: number;
}

export type UsageMap = Record<string, number>;
