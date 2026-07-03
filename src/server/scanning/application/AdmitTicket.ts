import type { Result } from "@/server/_shared/result";
import { ok } from "@/server/_shared/result";
import type { ScannerRef, TicketRepository } from "@/server/tickets/ports/TicketRepository";
import type { ScanResult } from "../domain/ScanResult";

type Deps = { ticketRepo: TicketRepository };

// Admisión confiable por ticketId (alta manual desde la lista, o sync de un scan
// ya verificado offline). No pasa por la firma: el portero admite a alguien que
// buscó por nombre/DNI, o reconcilia un ingreso ya validado en la puerta.
export const admitTicket = async (
  { ticketRepo }: Deps,
  input: { ticketId: string; scanner: ScannerRef; usedAt?: Date; expectedEventId?: string },
): Promise<Result<ScanResult>> => {
  const result = await ticketRepo.markUsedByTicketId(input.ticketId, input.scanner, {
    usedAt: input.usedAt,
    expectedEventId: input.expectedEventId,
  });
  if (!result.ok) {
    return ok({
      kind: result.error === "already_used" ? "already_used" : "invalid",
      scannedAt: new Date().toISOString(),
    });
  }
  return ok({
    kind: "valid",
    ticketId: result.value.ticket.id,
    eventId: result.value.eventId,
    scannedAt: new Date().toISOString(),
    holderName: result.value.holderName,
    holderDniLast4: result.value.holderDniLast4,
    ticketTypeName: result.value.ticketTypeName,
    boxLabel: result.value.boxLabel,
    boxHostName: result.value.boxHostName,
    boxFilled: result.value.boxFilled,
    boxCapacity: result.value.boxCapacity,
  });
};
