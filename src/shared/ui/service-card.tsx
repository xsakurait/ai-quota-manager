"use client";

import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { UsageControls } from "./usage-controls";
import { cycleLabel, kindLabel, remaining, statusLabel, statusOf, usagePercent } from "../lib/quota";
import type { ServiceDef, Status } from "../types";

const STATUS_VARIANT: Record<Status, "secondary" | "default" | "destructive"> = {
  ok: "secondary",
  warning: "default",
  exhausted: "destructive",
};

export interface ServiceCardProps {
  service: ServiceDef;
  used: number;
  nextResetText: string;
  onDelta: (service: ServiceDef, delta: number) => void;
  onSetUsed: (service: ServiceDef, value: number) => void;
}

export function ServiceCard({ service, used, nextResetText, onDelta, onSetUsed }: ServiceCardProps) {
  const status = statusOf(service, used);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{service.name}</CardTitle>
          <div className="flex gap-1">
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
        <UsageControls service={service} used={used} onDelta={onDelta} onSetUsed={onSetUsed} />
      </CardContent>
    </Card>
  );
}
