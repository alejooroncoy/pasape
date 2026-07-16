import { err, ok, type Result } from "@/server/_shared/result";
import type { TicketType } from "../domain/Event";
import type {
  CreateTicketTypeInput,
  EventRepository,
  UpdateTicketTypeInput,
} from "../ports/EventRepository";
import { MIN_PAID_TICKET_PRICE_CENTS } from "@/lib/tickets/serviceFee";

type Deps = { repo: EventRepository };

export const createTicketType = async (
  { repo }: Deps,
  eventId: string,
  input: CreateTicketTypeInput,
): Promise<Result<TicketType>> => {
  if (!input.name.trim()) return err("name_required");
  if (input.priceCents < 0) return err("price_invalid");
  // Piso absoluto S/3 (el fee nunca puede superar el precio). Entre S/3 y
  // S/15 el fee se cobra igual pero se oculta como línea aparte (ver
  // resolveOrderFee) — no depende de fee_mode, por eso el mínimo es fijo.
  if (input.priceCents > 0 && input.priceCents < MIN_PAID_TICKET_PRICE_CENTS) {
    return err("price_below_minimum");
  }
  if (input.capacity !== null && input.capacity < 0) return err("capacity_invalid");
  if (input.kind === "box" && !input.boxLabel?.trim()) return err("box_label_required");
  // Un box siempre es finito (asientos reales) — "sin límite" solo aplica a
  // entradas normales.
  if (input.kind === "box" && input.capacity === null) return err("box_capacity_required");
  if (input.requiresApproval && input.priceCents > 0) return err("approval_only_for_free_tickets");
  return repo.createTicketType(eventId, input);
};

export const updateTicketType = async (
  { repo }: Deps,
  eventId: string,
  ticketTypeId: string,
  input: UpdateTicketTypeInput,
): Promise<Result<TicketType>> => {
  const current = await repo.getTicketType(ticketTypeId, eventId);
  if (!current) return err("not_found");
  // Reglas anti-pie-en-la-mano:
  //   - no permitir reducir capacity por debajo de tickets ya vendidos
  //     (null = subir a sin límite, nunca puede chocar con lo vendido)
  if (input.capacity != null && input.capacity < current.sold) {
    return err("capacity_below_sold");
  }
  if (input.capacity === null && current.kind === "box") {
    return err("box_capacity_required");
  }
  const nextPrice = input.priceCents ?? current.priceCents;
  const nextRequiresApproval = input.requiresApproval ?? current.requiresApproval;
  if (nextRequiresApproval && nextPrice > 0) return err("approval_only_for_free_tickets");
  if (input.priceCents !== undefined) {
    if (input.priceCents < 0) return err("price_invalid");
    if (input.priceCents > 0 && input.priceCents < MIN_PAID_TICKET_PRICE_CENTS) {
      return err("price_below_minimum");
    }
  }
  if (input.name !== undefined && !input.name.trim()) return err("name_required");
  return repo.updateTicketType(ticketTypeId, eventId, input);
};

export const deleteTicketType = async (
  { repo }: Deps,
  eventId: string,
  ticketTypeId: string,
): Promise<Result<{ id: string }>> => {
  const current = await repo.getTicketType(ticketTypeId, eventId);
  if (!current) return err("not_found");
  // Solo permitimos eliminar tipos sin tickets vendidos. Caso contrario habría
  // que reembolsar y borrar tickets — flujo separado fuera del CRUD.
  if (current.sold > 0) return err("has_sold_tickets");
  return repo.deleteTicketType(ticketTypeId, eventId);
};
