import type { Result } from "@/server/_shared/result";
import type { Event } from "../domain/Event";
import type { EventRepository, UpdateEventInput } from "../ports/EventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { notifyPendingReview } from "@/server/notifications/application/NotifyPendingReview";

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
  // Estado pre-update, ya cargado por el guard del controller (una sola fila,
  // getBySlug) — evitar volver a pedirlo aquí con listByOrganization(orgId),
  // que trae TODOS los eventos de la org solo para encontrar este por id (el
  // costo dominante de cualquier guardado, incluso de un cambio mínimo).
  before: Event,
): Promise<Result<Event>> => {

  // La revisión de Pasape aplica solo a la PRIMERA publicación: pedir status
  // "published" desde draft/pending_review (o por /publish) cae en
  // pending_review hasta que Pasape lo aprueba a mano. Ver
  // SupabaseEventRepository.publish. Reenviar a revisión también limpia un
  // rechazo previo — es un intento nuevo, no el mismo. Un evento que YA está
  // "published" (o "closed", vía "Reabrir evento" en settings/page.tsx) no
  // pierde su aprobación por editarse: los cambios siguen públicos sin volver
  // a revisión.
  //
  // Excepción: organizaciones con `organizations.trusted = true` se saltan la
  // revisión y publican directo — ver 20260707100000_organizations_trusted.sql.
  //
  // `before` es el snapshot que trajo el guard del controller, ANTES de
  // safeParse/validación — hay una ventana entre esa lectura y este punto
  // donde otro request pudo cambiar `status` (doble clic en "Publicar", o un
  // guardado concurrente). Releer el status puntual acá evita que dos
  // requests concurrentes evalúen ambos `entersFirstPublish = true` sobre un
  // estado ya viejo.
  const wantsPublish = input.status === "published";
  let currentStatus = before?.status;
  if (wantsPublish) {
    const db = supabaseAdmin();
    const { data: current } = await db
      .from("events")
      .select("status")
      .eq("id", eventId)
      .maybeSingle<{ status: Event["status"] }>();
    if (current) currentStatus = current.status;
  }
  const entersFirstPublish =
    wantsPublish && currentStatus !== "closed" && currentStatus !== "published";
  let orgTrusted = false;
  if (entersFirstPublish) {
    const db = supabaseAdmin();
    const { data: org } = await db
      .from("organizations")
      .select("trusted")
      .eq("id", orgId)
      .maybeSingle<{ trusted: boolean }>();
    orgTrusted = org?.trusted ?? false;
  }
  const gatedInput =
    entersFirstPublish && !orgTrusted
      ? { ...input, status: "pending_review" as const, rejectedReason: null }
      : input;

  const result = await repo.update(eventId, orgId, gatedInput);
  if (!result.ok) return result;

  // Solo avisar a Pasape en la TRANSICIÓN a pending_review — si el organizador
  // reguarda un evento que ya estaba en revisión, no hay nada nuevo que avisar.
  // Fire-and-forget: es una notificación interna best-effort (ver su propio
  // try/catch) que no debe sumar la latencia de Resend + queries a la
  // respuesta que el organizador está esperando.
  if (gatedInput.status === "pending_review" && before?.status !== "pending_review") {
    notifyPendingReview(eventId).catch((notifyErr) =>
      console.error("[updateEvent] notifyPendingReview falló:", notifyErr),
    );
  }

  // Why: idempotent — skip notification fanout when nothing buyer-facing changed.
  // Fire-and-forget, igual que notifyPendingReview arriba: es un fanout best-
  // effort a compradores, no debe sumar su latencia (queries + insert masivo)
  // a la respuesta que espera el organizador.
  const changes = diffRelevantFields(before, input);
  if (changes.length > 0) {
    notifyBuyers(
      eventId,
      result.value.title,
      changes,
      input.status,
      input.startsAt,
      input.venue,
    ).catch((notifyErr) => console.error("[updateEvent] notifyBuyers falló:", notifyErr));
  }

  return result;
};
