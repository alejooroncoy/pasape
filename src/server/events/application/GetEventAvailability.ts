import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseEventRepository } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { unitsRemaining } from "@/lib/events/ticketDisplay";

export type EventAvailability = {
  totalRemaining: number;
  lowStock: boolean;
  asOf: string;
};

/** Stock en vivo para vitrina/pay-error — el frontend no infiere escasez de cache. */
export const getEventAvailability = async (slug: string): Promise<Result<EventAvailability>> => {
  const data = await supabaseEventRepository.getBySlug(slug);
  if (!data) return err("event_not_found");
  if (data.event.status !== "published" && data.event.status !== "closed") {
    return err("event_not_found");
  }

  const totalRemaining = data.ticketTypes.reduce(
    (sum, tt) => sum + unitsRemaining(tt),
    0,
  );

  return ok({
    totalRemaining,
    lowStock: totalRemaining > 0 && totalRemaining <= 20,
    asOf: new Date().toISOString(),
  });
};
