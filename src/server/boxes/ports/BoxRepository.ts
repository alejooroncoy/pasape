import type { Result } from "@/server/_shared/result";
import type { Box } from "../domain/Box";

export type BoxRepository = {
  createForTicket(input: {
    ticketId: string;
    ownerId: string;
    capacity: number;
  }): Promise<Result<Box>>;
  /** Crea (idempotente) el grupo de cada box-host de una orden pagada. Se llama
      al confirmarse el pago: el box existe desde que pagas, no al abrir el wallet. */
  ensureForOrder(orderId: string): Promise<void>;
  getByToken(token: string): Promise<Box | null>;
  getByTicketId(ticketId: string, ownerId: string): Promise<Box | null>;
  join(input: {
    token: string;
    profileId: string;
    holderName: string;
    holderDni: string | null;
    holderPhone: string | null;
  }): Promise<Result<Box>>;
  /** El host quita a un integrante: anula su QR y libera el asiento. Solo el
      dueño del box; no puede quitarse a sí mismo. */
  removeMember(input: {
    token: string;
    ownerId: string;
    memberProfileId: string;
  }): Promise<Result<Box>>;
  /** El host agrega un acompañante SIN celular: ocupa un asiento, pero su QR lo
      lleva el host (current_holder = ownerId). Solo el dueño del box. */
  addCompanion(input: {
    token: string;
    ownerId: string;
    holderName: string;
    holderDni: string | null;
  }): Promise<Result<Box>>;
};
