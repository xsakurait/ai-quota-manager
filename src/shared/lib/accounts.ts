import type { AccountDef, ServiceDef, UsageMap } from "../types";

/**
 * Account-aware usage helpers.
 *
 * A service without `accounts` behaves as a single implicit default
 * account: its usage lives under the bare service id, exactly as before.
 * A service with accounts stores one usage value per account under
 * `${serviceId}:${accountId}` in the same UsageMap / localStorage entry.
 */
export const DEFAULT_ACCOUNT: AccountDef = { id: "", label: "" };

export function usageKey(serviceId: string, accountId?: string): string {
  return accountId ? `${serviceId}:${accountId}` : serviceId;
}

export function resolveAccounts(service: ServiceDef): AccountDef[] {
  return service.accounts !== undefined && service.accounts.length > 0
    ? service.accounts
    : [DEFAULT_ACCOUNT];
}

export function getUsage(map: UsageMap, serviceId: string, accountId?: string): number {
  const value = map[usageKey(serviceId, accountId)];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}
