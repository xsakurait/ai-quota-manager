#!/usr/bin/env node
/**
 * Codex reader: produce a LiveReading for the `codex` service from the
 * Codex CLI's local rollout logs and merge it into ./data/readings.json.
 *
 * Run this AS THE USER WHO USES CODEX (the rollout files live in that
 * user's home):  node scripts/readers/codex.mjs
 *
 * The extraction logic mirrors src/shared/lib/codex-rollout.ts
 * (extractLatestRateLimits). It is duplicated here on purpose so this
 * script stays dependency-free plain Node.
 *
 * Behavior:
 * - Scans $CODEX_HOME (or ~/.codex) /sessions recursively for
 *   rollout-*.jsonl files, newest first, and uses the first file that
 *   contains a rate_limits snapshot.
 * - Merges { serviceId: "codex", source: "codex-rollout", ... } into
 *   ./data/readings.json, preserving other services' entries and
 *   replacing any previous entry with the same serviceId+accountId.
 * - If no Codex data is found, prints a message and exits 0 without
 *   touching the readings file.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVICE_ID = "codex";
const SOURCE = "codex-rollout";
const MAX_FILES = 5;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toWindow(value) {
  if (!isRecord(value)) return null;
  const { used_percent, window_minutes, resets_at } = value;
  if (!Number.isFinite(used_percent) || !Number.isFinite(window_minutes) || !Number.isFinite(resets_at)) {
    return null;
  }
  return { windowMinutes: window_minutes, usedPercent: used_percent, resetsAt: resets_at };
}

// Mirror of extractLatestRateLimits in src/shared/lib/codex-rollout.ts.
function extractLatestRateLimits(jsonlText) {
  let latest = null;
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || parsed.type !== "event_msg") continue;
    const payload = parsed.payload;
    if (!isRecord(payload) || payload.type !== "token_count") continue;
    const rateLimits = payload.rate_limits;
    if (!isRecord(rateLimits)) continue;
    const windows = [];
    for (const key of ["primary", "secondary"]) {
      const window = toWindow(rateLimits[key]);
      if (window !== null) windows.push(window);
    }
    if (windows.length === 0) continue;
    if (typeof parsed.timestamp !== "string" || parsed.timestamp === "") continue;
    latest = { capturedAt: parsed.timestamp, windows };
  }
  return latest;
}

function collectRolloutFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRolloutFiles(full, out);
    } else if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
      try {
        out.push({ path: full, mtimeMs: statSync(full).mtimeMs });
      } catch {
        // Unreadable file: skip it.
      }
    }
  }
  return out;
}

function main() {
  const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const sessionsDir = join(codexHome, "sessions");
  if (!existsSync(sessionsDir)) {
    console.log(`[codex-reader] No Codex sessions directory found at ${sessionsDir}. Nothing to do.`);
    return;
  }
  const files = collectRolloutFiles(sessionsDir, []).sort((a, b) => b.mtimeMs - a.mtimeMs);
  let extracted = null;
  for (const file of files.slice(0, MAX_FILES)) {
    let text;
    try {
      text = readFileSync(file.path, "utf-8");
    } catch {
      continue;
    }
    extracted = extractLatestRateLimits(text);
    if (extracted !== null) break;
  }
  if (extracted === null) {
    console.log("[codex-reader] No rate_limits snapshot found in the newest Codex rollout files. Nothing to do.");
    return;
  }

  const reading = {
    serviceId: SERVICE_ID,
    source: SOURCE,
    capturedAt: extracted.capturedAt,
    windows: extracted.windows,
  };

  const dataDir = join(process.cwd(), "data");
  const readingsPath = join(dataDir, "readings.json");
  let existing = [];
  if (existsSync(readingsPath)) {
    try {
      const parsed = JSON.parse(readFileSync(readingsPath, "utf-8"));
      const list = Array.isArray(parsed) ? parsed : parsed?.readings;
      if (Array.isArray(list)) existing = list;
    } catch {
      existing = [];
    }
  }
  const kept = existing.filter(
    (r) => !(isRecord(r) && r.serviceId === SERVICE_ID && (r.accountId ?? "") === (reading.accountId ?? "")),
  );
  kept.push(reading);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(readingsPath, `${JSON.stringify({ readings: kept }, null, 2)}\n`, "utf-8");
  console.log(
    `[codex-reader] Wrote ${SERVICE_ID} reading (capturedAt ${reading.capturedAt}, ${reading.windows.length} window(s)) to ${readingsPath}`,
  );
}

main();
