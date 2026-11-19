"use client";

import { ServiceCard } from "../../shared/ui/service-card";
import { useQuota } from "../../shared/lib/quota-context";

export function LocalAgentSection() {
  const { services, usage, onDelta, onSetUsed, nextResetText } = useQuota();
  const items = services.filter((s) => s.kind === "local");
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-label="ローカルエージェント" className="space-y-3">
      <h2 className="text-xl font-semibold">ローカルエージェント</h2>
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
