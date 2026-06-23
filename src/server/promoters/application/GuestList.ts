import { err, ok, type Result } from "@/server/_shared/result";
import type { PromoterRepository } from "../ports/PromoterRepository";
import type { PromoterGuest } from "../domain/Promoter";
import type { EventRepository } from "@/server/events/ports/EventRepository";
import type { TicketRepository } from "@/server/tickets/ports/TicketRepository";

type Deps = {
  promoterRepo: PromoterRepository;
  eventRepo: EventRepository;
  ticketRepo: TicketRepository;
};

export type AddGuestInput = {
  name: string;
  dni: string;
  email?: string | null;
  phone?: string | null;
};

// El promotor agrega un invitado a su lista: emitimos una cortesía (ticket S/0,
// is_courtesy) sobre la entrada general real del evento, atribuida a su link.
// Reusa el flujo buy:free, que marca la orden pagada y despacha el QR al invitado
// por WhatsApp/correo automáticamente.
export const addGuest = async (
  { promoterRepo, eventRepo, ticketRepo }: Deps,
  promoterId: string,
  slug: string,
  input: AddGuestInput,
): Promise<Result<{ ticketId: string }>> => {
  if (input.name.trim().length < 2) return err("name_required");
  if (!input.email && !input.phone) return err("guest_contact_required");

  // Verifica que el solicitante sea de verdad el promotor de este evento.
  const home = await promoterRepo.getHomeData(promoterId, slug);
  if (!home) return err("not_a_promoter");
  const { link } = home;

  // Destino: la entrada general con la lista activada por el organizador.
  // Respeta el cupo total de cortesías configurado en el composer.
  const tt = await eventRepo.getGuestListTicketType(link.eventId);
  if (!tt.ok) return tt;
  // Cupo total del evento (cortesías de todos los promotores).
  if (tt.value.cap != null && tt.value.courtesyCount >= tt.value.cap) {
    return err("guest_list_full");
  }
  // Cupo individual de este promotor: el suyo o, si no tiene, el default del
  // evento (herencia promotor → evento). null = sin tope individual; -1 =
  // personalizado a "sin tope" (no hereda el default del evento).
  const scheme = await eventRepo.getPromoterScheme(link.eventId);
  const effectiveGuestQuota =
    link.guestListQuota === -1
      ? null
      : link.guestListQuota ?? scheme.defaultGuestListQuota;
  if (effectiveGuestQuota != null) {
    const mine = await promoterRepo.countCourtesies(link.id);
    if (mine >= effectiveGuestQuota) return err("guest_list_promoter_full");
  }

  const res = await ticketRepo.buy({
    eventId: link.eventId,
    items: [{ ticketTypeId: tt.value.id, qty: 1, holderName: input.name.trim() }],
    // Cortesía: gratis sobre la entrada real, marcada is_courtesy, sin agotar stock.
    courtesy: true,
    // promoCode atribuye la cortesía al promotor (misma vía que una venta).
    promoCode: link.code,
    guest: {
      fullName: input.name.trim(),
      dni: input.dni,
      email: input.email ?? null,
      phone: input.phone ?? null,
    },
  });
  if (!res.ok) return res;

  return ok({ ticketId: res.value.tickets[0]?.id ?? "" });
};

export const listGuests = async (
  { promoterRepo }: Deps,
  promoterId: string,
  slug: string,
): Promise<Result<PromoterGuest[]>> => {
  const home = await promoterRepo.getHomeData(promoterId, slug);
  if (!home) return err("not_a_promoter");
  return ok(await promoterRepo.listGuests(home.link.id));
};
