"use client";

import { ServiceCard } from "../../shared/ui/service-card";
import { useQuota } from "../../shared/lib/quota-context";

export function VideoQuotaSection() {
  const { services, usage, onDelta, onSetUsed, nextResetText } = useQuota();
  const items = services.filter((s) => s.kind === "video");
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-label="動画生成サービス" className="space-y-3">
      <h2 className="text-xl font-semibold">動画生成サービス</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <ServiceCard
            key={s.id}
            service={s}
            used={usage[s.id] ?? 0}
            nextResetText={nextResetText(s)}
            onDelta={onDelta}
            onSetUsed={onSetUsed}
          />
        ))}
      </div>
    </section>
  );
}
