import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { CATALOG, CONFIG } from "../../../shared/config/catalog";
import { buildStatus, clampUsage, filterServices, findService, summarize } from "../../../shared/lib/quota";
import { parseReadings } from "../../../shared/lib/readings";
import type { KindFilter, UsageMap } from "../../../shared/types";

export const runtime = "nodejs";

const app = new Hono().basePath("/api");

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

app.get("/catalog", (c) => {
  const kindParam = c.req.query("kind");
  const kind: KindFilter =
    kindParam === "video" || kindParam === "local" || kindParam === "gpu" || kindParam === "voice"
      ? kindParam
      : "all";
  const q = c.req.query("q") ?? "";
  const services = filterServices(CATALOG, q, kind);
  return c.json({
    services,
    config: {
      storageKey: CONFIG.storageKey,
      thresholds: CONFIG.thresholds,
      statusLabels: CONFIG.statusLabels,
      kindLabels: CONFIG.kindLabels,
      cycleLabels: CONFIG.cycleLabels,
    },
  });
});

app.get("/catalog/:id", (c) => {
  const service = findService(c.req.param("id"));
  if (!service) {
    return c.json(errorBody("SERVICE_NOT_FOUND", "指定されたサービスが見つかりません"), 404);
  }
  return c.json({ service });
});

app.post("/usage/validate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(errorBody("INVALID_BODY", "JSONボディが不正です"), 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json(errorBody("INVALID_BODY", "ボディはオブジェクトである必要があります"), 400);
  }
  const record = body as Record<string, unknown>;
  if (typeof record.serviceId !== "string") {
    return c.json(errorBody("INVALID_BODY", "serviceId は文字列で指定してください"), 400);
  }
  const service = findService(record.serviceId);
  if (!service) {
    return c.json(errorBody("SERVICE_NOT_FOUND", "指定されたサービスが見つかりません"), 404);
  }
  const used = clampUsage(service, record.used);
  const status = buildStatus(service, used);
  return c.json({
    serviceId: service.id,
    used,
    remaining: status.remaining,
    usagePercent: status.usagePercent,
    status: status.status,
  });
});

app.get("/readings", async (c) => {
  let text: string;
  try {
    text = await readFile(CONFIG.readingsFile, "utf-8");
  } catch {
    return c.json({ readings: [] });
  }
  return c.json({ readings: parseReadings(text) });
});

app.get("/status", (c) => {
  const usage: UsageMap = {};
  for (const s of CATALOG) {
    const raw = c.req.query(`used_${s.id}`);
    if (raw !== undefined) {
      const parsed = Number(raw);
      usage[s.id] = Number.isFinite(parsed) ? parsed : 0;
    }
  }
  const items = CATALOG.map((s) => buildStatus(s, usage[s.id] ?? 0));
  return c.json({ summary: summarize(usage), items });
});

export const GET = handle(app);
export const POST = handle(app);
