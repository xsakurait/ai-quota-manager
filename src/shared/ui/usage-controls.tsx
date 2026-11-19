"use client";

import { Button } from "./button";
import { Input } from "./input";
import { parseUsageInput } from "../lib/quota";
import type { ServiceDef } from "../types";

export interface UsageControlsProps {
  service: ServiceDef;
  used: number;
  accountLabel?: string;
  onDelta: (service: ServiceDef, delta: number) => void;
  onSetUsed: (service: ServiceDef, value: number) => void;
}

export function UsageControls({ service, used, accountLabel, onDelta, onSetUsed }: UsageControlsProps) {
  const label = accountLabel ? `${service.name}（${accountLabel}）` : service.name;
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" aria-label={`${label} の使用量を減らす`} onClick={() => onDelta(service, -1)}>
        -
      </Button>
      <Input
        type="number"
        className="w-24"
        aria-label={`${label} の使用量`}
        value={used}
        min={0}
        max={service.limit}
        onChange={(e) => onSetUsed(service, parseUsageInput(e.target.value))}
      />
      <Button type="button" variant="outline" size="sm" aria-label={`${label} の使用量を増やす`} onClick={() => onDelta(service, 1)}>
        +
      </Button>
    </div>
  );
}
