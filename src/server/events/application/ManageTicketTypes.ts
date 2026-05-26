import { err, ok, type Result } from "@/server/_shared/result";
import type { TicketType } from "../domain/Event";
import type {
  CreateTicketTypeInput,
  EventRepository,
  UpdateTicketTypeInput,
} from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const createTicketType = async (
  { repo }: Deps,
  eventId: string,
  input: CreateTicketTypeInput,
): Promise<Result<TicketType>> => {
  if (!input.name.trim()) return err("name_required");
  if (input.priceCents < 0) return err("price_invalid");
  if (input.capacity < 0) return err("capacity_invalid");
  if (input.kind === "box" && !input.boxLabel?.trim()) return err("box_label_required");
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
  if (input.capacity !== undefined && input.capacity < current.sold) {
    return err("capacity_below_sold");
  }
  if (input.priceCents !== undefined && input.priceCents < 0) return err("price_invalid");
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
