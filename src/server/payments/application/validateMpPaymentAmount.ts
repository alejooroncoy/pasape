import "server-only";
import { Money } from "@/lib/_shared/money";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";

const AMOUNT_TOLERANCE_CENTS = 1;

/** El monto cobrado por MP debe coincidir con orders.total_cents. */
export function validateMpPaymentAmount(
  totalCents: number,
  transactionAmountSoles: number | null | undefined,
  orderId: string,
): Result<true> {
  if (transactionAmountSoles == null || Number.isNaN(transactionAmountSoles)) {
    Sentry.captureMessage(`mp_amount_missing: orden ${orderId}`, "warning");
    return err("payment_amount_missing");
  }
  const paidCents = Money.toCents(transactionAmountSoles);
  if (Math.abs(paidCents - totalCents) > AMOUNT_TOLERANCE_CENTS) {
    Sentry.captureMessage(
      `mp_amount_mismatch: orden ${orderId} esperaba ${totalCents}c, MP cobró ${paidCents}c`,
      "error",
    );
    return err("payment_amount_mismatch");
  }
  return ok(true);
}
