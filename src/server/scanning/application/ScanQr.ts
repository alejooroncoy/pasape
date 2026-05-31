import type { Result } from "@/server/_shared/result";
import { ok } from "@/server/_shared/result";
import type { TicketRepository } from "@/server/tickets/ports/TicketRepository";
import type { ScanResult } from "../domain/ScanResult";

type Deps = { ticketRepo: TicketRepository };

export const scanQr = async (
  { ticketRepo }: Deps,
  input: { qrCode: string; scannerId: string; usedAt?: Date },
): Promise<Result<ScanResult>> => {
  const result = await ticketRepo.markUsedByQr(input.qrCode, input.scannerId, input.usedAt);
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
    holderDniLast2: result.value.holderDniLast2,
    ticketTypeName: result.value.ticketTypeName,
    boxLabel: result.value.boxLabel,
    boxHostName: result.value.boxHostName,
    boxFilled: result.value.boxFilled,
    boxCapacity: result.value.boxCapacity,
  });
};
