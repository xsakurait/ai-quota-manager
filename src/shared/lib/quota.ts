import { CATALOG, CONFIG } from "../config/catalog";
import type {
  KindFilter,
  QuotaStatus,
  ResetCycle,
  ServiceDef,
  ServiceKind,
  Status,
  Summary,
  UsageMap,
} from "../types";

export function normalizeUsed(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

export function clampUsage(def: ServiceDef, value: unknown): number {
  const used = normalizeUsed(value);
  if (def.limit <= 0) {
    return 0;
  }
  return used > def.limit ? def.limit : used;
}

export function applyDelta(def: ServiceDef, current: unknown, delta: unknown): number {
  const step = typeof delta === "number" && Number.isFinite(delta) ? delta : 0;
  return clampUsage(def, normalizeUsed(current) + step);
}

export function remaining(def: ServiceDef, used: unknown): number {
  return Math.max(0, def.limit - normalizeUsed(used));
}

export function usagePercent(def: ServiceDef, used: unknown): number {
  if (def.limit <= 0) {
    return 0;
  }
  const pct = Math.round((normalizeUsed(used) / def.limit) * 100);
  return pct > 100 ? 100 : pct;
}

export function remainingPercent(def: ServiceDef, used: unknown): number {
  return 100 - usagePercent(def, used);
}

export function statusOf(def: ServiceDef, used: unknown): Status {
  const pct = usagePercent(def, used);
  if (pct >= CONFIG.thresholds.exhausted) {
    return "exhausted";
  }
  if (pct >= CONFIG.thresholds.warning) {
    return "warning";
  }
  return "ok";
}

export function statusLabel(status: Status): string {
  return (CONFIG.statusLabels as Record<string, string>)[status] ?? status;
}

export function kindLabel(kind: ServiceKind): string {
  return (CONFIG.kindLabels as Record<string, string>)[kind] ?? kind;
}

export function cycleLabel(cycle: ResetCycle): string {
  return (CONFIG.cycleLabels as Record<string, string>)[cycle] ?? cycle;
}

export function findService(id: string): ServiceDef | undefined {
  return CATALOG.find((s) => s.id === id);
}

export function parseUsageInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return 0;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? normalizeUsed(parsed) : 0;
}

export function nextReset(cycle: ResetCycle, now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  if (cycle === "daily") {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  } else if (cycle === "weekly") {
    const add = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + add);
    d.setHours(0, 0, 0, 0);
  } else if (cycle === "monthly") {
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(0, 0, 0, 0);
  } else {
    const rem = d.getHours() % 5;
    d.setHours(d.getHours() + (5 - rem), 0, 0, 0);
  }
  return d;
}

export function summarize(usage: UsageMap, catalog: readonly ServiceDef[] = CATALOG): Summary {
  let used = 0;
  let limit = 0;
  let exhausted = 0;
  for (const s of catalog) {
    const u = normalizeUsed(usage[s.id] ?? 0);
    used += u;
    limit += s.limit;
    if (statusOf(s, u) === "exhausted") {
      exhausted += 1;
    }
  }
  return { count: catalog.length, used, limit, exhausted };
}

export function filterServices(
  services: readonly ServiceDef[],
  query: string,
  kind: KindFilter,
): ServiceDef[] {
  const q = query.trim().toLowerCase();
  return services.filter(
    (s) => (kind === "all" || s.kind === kind) && (q === "" || s.name.toLowerCase().includes(q)),
  );
}

export function buildStatus(def: ServiceDef, used: unknown, now: Date = new Date()): QuotaStatus {
  const u = normalizeUsed(used);
  const status = statusOf(def, u);
  return {
    serviceId: def.id,
    used: u,
    remaining: remaining(def, u),
    usagePercent: usagePercent(def, u),
    remainingPercent: remainingPercent(def, u),
    status,
    statusLabel: statusLabel(status),
    nextReset: nextReset(def.cycle, now).toISOString(),
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadUsage(storage: StorageLike | null, key: string = CONFIG.storageKey): UsageMap {
  if (storage === null) {
    return {};
  }
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return {};
  }
  if (raw === null) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const out: UsageMap = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = normalizeUsed(v);
  }
  return out;
}

export function saveUsage(
  storage: StorageLike | null,
  usage: UsageMap,
  key: string = CONFIG.storageKey,
): boolean {
  if (storage === null) {
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify(usage));
    return true;
  } catch {
    return false;
  }
}
