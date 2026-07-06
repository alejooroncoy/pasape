import { listZones } from "@/server/events/application/ManageZones";

/** Reglas de puerta para validar offline y en scan-cache. */
export type ZoneScanPolicy = {
  /** false = una sola puerta o puerta principal → acepta todos los tipos. */
  enforce: boolean;
  allowedTicketTypeIds: string[];
};

/**
 * Espeja la lógica de isAllowedInZone en SupabaseTicketRepository:
 * multi-puerta → cada zona no-default solo admite sus ticket_types asignados.
 */
export async function resolveZoneScanPolicy(
  eventId: string,
  zoneId: string | null,
): Promise<ZoneScanPolicy> {
  const zones = await listZones(eventId);
  if (zones.length <= 1) {
    return { enforce: false, allowedTicketTypeIds: [] };
  }
  const zone =
    (zoneId ? zones.find((z) => z.id === zoneId) : null) ??
    zones.find((z) => z.isDefault) ??
    zones[0];
  if (!zone || zone.isDefault || zone.ticketTypeIds.length === 0) {
    return { enforce: false, allowedTicketTypeIds: [] };
  }
  return { enforce: true, allowedTicketTypeIds: zone.ticketTypeIds };
}

export function isTicketTypeAllowedInPolicy(
  ticketTypeId: string,
  policy: ZoneScanPolicy,
): boolean {
  if (!policy.enforce) return true;
  return policy.allowedTicketTypeIds.includes(ticketTypeId);
}
