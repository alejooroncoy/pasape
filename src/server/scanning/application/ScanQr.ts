import type { Result } from "@/server/_shared/result";
import { ok } from "@/server/_shared/result";
import type { ScannerRef, TicketRepository } from "@/server/tickets/ports/TicketRepository";
import type { ScanResult } from "../domain/ScanResult";

type Deps = { ticketRepo: TicketRepository };

export const scanQr = async (
  { ticketRepo }: Deps,
  input: { qrCode: string; scanner: ScannerRef; usedAt?: Date; zoneId?: string | null },
): Promise<Result<ScanResult>> => {
  const result = await ticketRepo.markUsedByQr(input.qrCode, input.scanner, {
    usedAt: input.usedAt,
    zoneId: input.zoneId,
  });
  if (!result.ok) {
    const kind =
      result.error === "already_used"
        ? "already_used"
        : result.error === "wrong_zone"
          ? "wrong_zone"
          : "invalid";
    return ok({ kind, scannedAt: new Date().toISOString() });
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
