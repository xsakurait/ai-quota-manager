"use client";

import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { UsageControls } from "./usage-controls";
import { CONFIG } from "../config/catalog";
import { cycleLabel, kindLabel, remaining, statusLabel, statusOf, usagePercent } from "../lib/quota";
import { isStale, windowLabel } from "../lib/readings";
import type { AccountDef, LiveReading, ServiceDef, Status } from "../types";

const STATUS_VARIANT: Record<Status, "secondary" | "default" | "destructive"> = {
  ok: "secondary",
  warning: "default",
  exhausted: "destructive",
};

export interface ServiceCardProps {
  service: ServiceDef;
  account?: AccountDef;
  used: number;
  reading?: LiveReading;
  nextResetText: string;
  onDelta: (service: ServiceDef, delta: number, accountId?: string) => void;
  onSetUsed: (service: ServiceDef, value: number, accountId?: string) => void;
}

export function ServiceCard({ service, account, used, reading, nextResetText, onDelta, onSetUsed }: ServiceCardProps) {
  const status = statusOf(service, used);
  const accountId = account?.id;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{service.name}</CardTitle>
          <div className="flex gap-1">
            {account ? <Badge variant="outline">{account.label}</Badge> : null}
            <Badge variant="outline">{kindLabel(service.kind)}</Badge>
            <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status)}</Badge>
          </div>
        </div>
        <CardDescription>{service.note}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>上限: {service.limit} {service.unit}</div>
          <div>使用量: {used}</div>
          <div>残量: {remaining(service, used)}</div>
          <div>使用率: {usagePercent(service, used)}%</div>
          <div className="col-span-2">周期: {cycleLabel(service.cycle)}</div>
          <div className="col-span-2">次回リセット: {nextResetText}</div>
        </dl>
        {reading ? (
          <div className="space-y-1 rounded-md border p-2 text-sm" aria-label={`${service.name} のライブ実測`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{CONFIG.liveLabels.title}</span>
              {isStale(reading) ? <Badge variant="destructive">{CONFIG.liveLabels.stale}</Badge> : null}
            </div>
            {reading.windows.map((w) => (
              <div key={w.windowMinutes}>
                {windowLabel(w.windowMinutes)}: {w.usedPercent}% / リセット{" "}
                {new Date(w.resetsAt * 1000).toLocaleString("ja-JP")}
              </div>
            ))}
            <div>
              出典: {reading.source} / 取得: {new Date(reading.capturedAt).toLocaleString("ja-JP")}
            </div>
            {reading.note ? <div>{reading.note}</div> : null}
          </div>
        ) : null}
        <UsageControls
          service={service}
          used={used}
          accountLabel={account?.label}
          onDelta={(s, d) => onDelta(s, d, accountId)}
          onSetUsed={(s, v) => onSetUsed(s, v, accountId)}
        />
        {service.dashboardUrl ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={service.dashboardUrl} target="_blank" rel="noopener noreferrer">
              {CONFIG.dashboardLinkLabel}
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
