import type { ReadingWindow } from "../types";

/**
 * Codex rollout parser.
 *
 * The Codex CLI appends one JSON object per line to
 * `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. `event_msg` lines whose
 * payload type is `token_count` carry the server's `rate_limits` snapshot:
 * `{ primary, secondary }`, each `{ used_percent, window_minutes, resets_at }`
 * (resets_at is unix seconds). The LAST such snapshot in the file is the
 * freshest reading; its line `timestamp` is the capture time.
 * Parsing is defensive: malformed lines are skipped, never thrown.
 */

export interface CodexRateLimits {
  capturedAt: string;
  windows: ReadingWindow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toWindow(value: unknown): ReadingWindow | null {
  if (!isRecord(value)) {
    return null;
  }
  const usedPercent = value.used_percent;
  const windowMinutes = value.window_minutes;
  const resetsAt = value.resets_at;
  if (!isFiniteNumber(usedPercent) || !isFiniteNumber(windowMinutes) || !isFiniteNumber(resetsAt)) {
    return null;
  }
  return { windowMinutes, usedPercent, resetsAt };
}

export function extractLatestRateLimits(jsonlText: string): CodexRateLimits | null {
  let latest: CodexRateLimits | null = null;
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || parsed.type !== "event_msg") {
      continue;
    }
    const payload = parsed.payload;
    if (!isRecord(payload) || payload.type !== "token_count") {
      continue;
    }
    const rateLimits = payload.rate_limits;
    if (!isRecord(rateLimits)) {
      continue;
    }
    const windows: ReadingWindow[] = [];
    for (const key of ["primary", "secondary"]) {
      const window = toWindow(rateLimits[key]);
      if (window !== null) {
        windows.push(window);
      }
    }
    if (windows.length === 0) {
      continue;
    }
    if (typeof parsed.timestamp !== "string" || parsed.timestamp === "") {
      continue;
    }
    latest = { capturedAt: parsed.timestamp, windows };
  }
  return latest;
}
