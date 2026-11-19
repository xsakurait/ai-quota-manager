export type ServiceKind = "video" | "local";
export type ResetCycle = "daily" | "weekly" | "monthly" | "5hour";
export type Status = "ok" | "warning" | "exhausted";
export type KindFilter = ServiceKind | "all";

export interface ServiceDef {
  id: string;
  name: string;
  kind: ServiceKind;
  limit: number;
  unit: string;
  cycle: ResetCycle;
  note: string;
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
