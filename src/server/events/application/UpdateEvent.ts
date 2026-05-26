import type { Result } from "@/server/_shared/result";
import type { Event } from "../domain/Event";
import type { EventRepository, UpdateEventInput } from "../ports/EventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

type Deps = { repo: EventRepository };

// Which UpdateEventInput fields are buyer-relevant. Title/venue/startsAt
// affect logistics; `status` only matters when it transitions to
// "cancelled" or "closed".
const BUYER_RELEVANT_FIELDS = ["title", "venue", "startsAt", "status"] as const;
type BuyerRelevantField = (typeof BUYER_RELEVANT_FIELDS)[number];

const diffRelevantFields = (
  before: Event,
  input: UpdateEventInput,
): BuyerRelevantField[] => {
  const changes: BuyerRelevantField[] = [];
  if (input.title !== undefined && input.title !== before.title) changes.push("title");
  if (input.venue !== undefined && input.venue !== before.venue) changes.push("venue");
  if (input.startsAt !== undefined && input.startsAt !== before.startsAt)
    changes.push("startsAt");
  if (
    input.status !== undefined &&
    input.status !== before.status &&
    (input.status === "cancelled" || input.status === "closed")
  ) {
    changes.push("status");
  }
  return changes;
};

const notifyBuyers = async (
  eventId: string,
  eventTitle: string,
  changes: BuyerRelevantField[],
  newStatus: Event["status"] | undefined,
  newStartsAt: string | undefined,
  newVenue: string | null | undefined,
): Promise<void> => {
  const db = supabaseAdmin();
  // Why: only notify confirmed buyers (paid orders). Distinct buyers via Set.
  const { data: orders } = await db
    .from("orders")
    .select("buyer_id")
    .eq("event_id", eventId)
    .eq("status", "paid");
  const buyerIds = Array.from(
    new Set(((orders as Array<{ buyer_id: string }> | null) ?? []).map((o) => o.buyer_id)),
  );
  if (buyerIds.length === 0) return;

  const payload: Record<string, unknown> = {
    eventId,
    eventTitle,
    changes,
  };
  if (changes.includes("startsAt") && newStartsAt) payload.newStartsAt = newStartsAt;
  if (changes.includes("venue")) payload.newVenue = newVenue ?? null;
  if (changes.includes("status") && newStatus) payload.newStatus = newStatus;

  const rows = buyerIds.map((profileId) => ({
    profile_id: profileId,
    kind: "event_updated",
    payload,
  }));
  await db.from("notifications").insert(rows);
};

export const updateEvent = async (
  { repo }: Deps,
  eventId: string,
  orgId: string,
  input: UpdateEventInput,
): Promise<Result<Event>> => {
  // Capture pre-update state so we can compute a diff after the write.
  const before = (await repo.listByOrganization(orgId)).find((e) => e.id === eventId);
  const result = await repo.update(eventId, orgId, input);
  if (!result.ok) return result;

  // Why: idempotent — skip notification fanout when nothing buyer-facing changed.
  if (before) {
    const changes = diffRelevantFields(before, input);
    if (changes.length > 0) {
      await notifyBuyers(
        eventId,
        result.value.title,
        changes,
        input.status,
        input.startsAt,
        input.venue,
      );
    }
  }

  return result;
};
