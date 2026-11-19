"use client";

import { CONFIG } from "../../shared/config/catalog";
import { ServiceCard } from "../../shared/ui/service-card";
import { getUsage, resolveAccounts, usageKey } from "../../shared/lib/accounts";
import { useQuota } from "../../shared/lib/quota-context";
import { findReading } from "../../shared/lib/readings";

export function VideoQuotaSection() {
  const { services, usage, readings, onDelta, onSetUsed, nextResetText } = useQuota();
  const items = services.filter((s) => s.kind === "video");
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-label={CONFIG.sectionLabels.video} className="space-y-3">
      <h2 className="text-xl font-semibold">{CONFIG.sectionLabels.video}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.flatMap((s) =>
          resolveAccounts(s).map((account) => {
            const accountId = account.id === "" ? undefined : account.id;
            return (
              <ServiceCard
                key={usageKey(s.id, accountId)}
                service={s}
                account={accountId === undefined ? undefined : account}
                used={getUsage(usage, s.id, accountId)}
                reading={findReading(readings, s.id, accountId)}
                nextResetText={nextResetText(s)}
                onDelta={onDelta}
                onSetUsed={onSetUsed}
              />
            );
          }),
        )}
      </div>
    </section>
  );
}
