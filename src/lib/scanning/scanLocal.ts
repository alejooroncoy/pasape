import { lookupTicket, markUsedLocal } from "./scanCache";
import { enqueuePendingScan } from "./scanQueue";

export type ScanLocalResult = {
  kind: "valid" | "already_used" | "invalid";
  holderName: string | null;
  holderDniLast2: string | null;
  ticketTypeName: string | null;
  boxLabel: string | null;
  boxHostName: string | null;
  boxFilled: number | null;
  boxCapacity: number | null;
};

export async function scanLocal(qrCode: string): Promise<ScanLocalResult> {
  const t = await lookupTicket(qrCode);
  if (!t) {
    return {
      kind: "invalid",
      holderName: null,
      holderDniLast2: null,
      ticketTypeName: null,
      boxLabel: null,
      boxHostName: null,
      boxFilled: null,
      boxCapacity: null,
    };
  }
  if (t.status === "used") {
    return {
      kind: "already_used",
      holderName: t.holderName,
      holderDniLast2: t.holderDniLast2,
      ticketTypeName: t.ticketTypeName,
      boxLabel: t.boxLabel,
      boxHostName: null,
      boxFilled: null,
      boxCapacity: null,
    };
  }
  // valid → mark used locally + queue sync
  await markUsedLocal(qrCode);
  await enqueuePendingScan({
    ticketId: t.ticketId,
    qrCode,
    scannedAt: new Date().toISOString(),
  });
  return {
    kind: "valid",
    holderName: t.holderName,
    holderDniLast2: t.holderDniLast2,
    ticketTypeName: t.ticketTypeName,
    boxLabel: t.boxLabel,
    boxHostName: null,
    boxFilled: null,
    boxCapacity: null,
  };
}
