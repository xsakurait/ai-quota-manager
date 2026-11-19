import { CONFIG } from "../config/catalog";
import type { LiveReading, ReadingWindow } from "../types";

/**
 * Live readings: measured usage snapshots produced outside the app
 * (reader scripts, external agents) and delivered as a JSON document:
 * `{ "readings": LiveReading[] }` (a bare array is also accepted).
 * A window normally carries `usedPercent`; balance-type services (an
 * accumulating balance with no cap, e.g. Civitai Buzz) instead carry a
 * free-text `detail` measurement, and `usedPercent` is omitted.
 * Every parser here is defensive: invalid input is skipped, never thrown.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseReadingWindow(value: unknown): ReadingWindow | null {
  if (!isRecord(value)) {
    return null;
  }
  const { windowMinutes, resetsAt } = value;
  if (!isFiniteNumber(windowMinutes) || !isFiniteNumber(resetsAt)) {
    return null;
  }
  // An invalid usedPercent (non-number / NaN) is treated as absent, and a
  // non-string or empty detail is treated as absent; the window is valid
  // only when at least one of the two measurements survives.
  const usedPercent = isFiniteNumber(value.usedPercent) ? value.usedPercent : undefined;
  const detail =
    typeof value.detail === "string" && value.detail !== "" ? value.detail : undefined;
  if (usedPercent === undefined && detail === undefined) {
    return null;
  }
  const window: ReadingWindow = { windowMinutes, resetsAt };
  if (usedPercent !== undefined) {
    window.usedPercent = usedPercent;
  }
  if (detail !== undefined) {
    window.detail = detail;
  }
  return window;
}

export function parseLiveReading(value: unknown): LiveReading | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.serviceId !== "string" || value.serviceId === "") {
    return null;
  }
  if (typeof value.source !== "string" || value.source === "") {
    return null;
  }
  if (typeof value.capturedAt !== "string" || Number.isNaN(Date.parse(value.capturedAt))) {
    return null;
  }
  if (!Array.isArray(value.windows)) {
    return null;
  }
  const windows: ReadingWindow[] = [];
  for (const entry of value.windows) {
    const window = parseReadingWindow(entry);
    if (window !== null) {
      windows.push(window);
    }
  }
  if (windows.length === 0) {
    return null;
  }
  const reading: LiveReading = {
    serviceId: value.serviceId,
    source: value.source,
    capturedAt: value.capturedAt,
    windows,
  };
  if (typeof value.accountId === "string" && value.accountId !== "") {
    reading.accountId = value.accountId;
  }
  if (typeof value.note === "string") {
    reading.note = value.note;
  }
  return reading;
}

export function parseReadings(jsonText: string): LiveReading[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const list: unknown = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? parsed.readings
      : undefined;
  if (!Array.isArray(list)) {
    return [];
  }
  const readings: LiveReading[] = [];
  for (const entry of list) {
    const reading = parseLiveReading(entry);
    if (reading !== null) {
      readings.push(reading);
    }
  }
  return readings;
}

export function findReading(
  readings: readonly LiveReading[],
  serviceId: string,
  accountId?: string,
): LiveReading | undefined {
  return readings.find((r) => r.serviceId === serviceId && (r.accountId ?? "") === (accountId ?? ""));
}

export function isStale(reading: LiveReading, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - Date.parse(reading.capturedAt);
  if (ageMs > CONFIG.readingStaleHours * 60 * 60 * 1000) {
    return true;
  }
  return reading.windows.every((w) => w.resetsAt * 1000 <= now.getTime());
}

export function windowLabel(windowMinutes: number): string {
  return CONFIG.windowLabels[windowMinutes] ?? `${windowMinutes}${CONFIG.windowMinuteUnit}`;
}
