import { render } from "@react-email/components";
import type { Result } from "@/server/_shared/result";
import type { TicketRepository, RefundRequestSummary } from "../ports/TicketRepository";
import { RefundRequestEmail } from "@/server/notifications/emails/RefundRequestEmail";

type Deps = { repo: TicketRepository };

type Input = {
  ticketId: string;
  profileId: string;
  reason: string;
};

const TEAM_EMAIL = "team@pasape.lat";

const formatAmount = (cents: number, currency: string): string =>
  `${currency === "PEN" ? "S/" : currency} ${(cents / 100).toFixed(2)}`;

// Flujo intencionalmente no escalable (ver TODOS.md "Cancelación/reembolso de
// evento para artistas independientes"): solo registra la solicitud
// (refunds.status = "requested") y avisa por correo. El reembolso en sí lo
// procesa el equipo a mano — no hay panel ni automatización todavía.
export const requestRefund = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<RefundRequestSummary>> => {
  const result = await repo.requestRefund(input);
  if (!result.ok) return result;

  // Ya había una solicitud pendiente para este pago (orden multi-entrada o
  // doble-tap): el repo no insertó fila nueva, así que tampoco reenviamos el
  // correo — el equipo ya lo recibió. La UI muestra un toast "ya solicitaste".
  if (result.value.alreadyRequested) return result;

  // Best-effort: el correo nunca bloquea la confirmación al comprador — si
  // Resend falla, la solicitud ya quedó guardada en `refunds` y se puede
  // encontrar ahí igual (mismo criterio que notifyPendingReview).
  await notifyRefundRequested(result.value, input.reason).catch((err) =>
    console.error("[requestRefund] aviso por correo falló:", err instanceof Error ? err.message : err),
  );

  return result;
};

const notifyRefundRequested = async (summary: RefundRequestSummary, reason: string): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[requestRefund] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
    return;
  }

  // Dynamic import: la dep es opcional (mismo patrón que ResendEmailSender.ts /
  // NotifyPendingReview.ts) — no rompe la build si no está instalada.
  const mod = (await import("resend").catch(() => null)) as
    | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
    | null;
  if (!mod) {
    console.warn("[requestRefund] paquete `resend` no instalado — skip");
    return;
  }

  const amount = formatAmount(summary.amountCents, summary.currency);
  const html = await render(
    RefundRequestEmail({
      eventTitle: summary.eventTitle,
      amount,
      reason,
      buyerName: summary.buyerName,
      buyerEmail: summary.buyerEmail,
      orderId: summary.orderId,
    }),
  );
  const text = `${summary.buyerName ?? "Un comprador"} pidió reembolso de ${amount} para "${summary.eventTitle}". Motivo: ${reason}. Orden: ${summary.orderId}.`;

  const client = new mod.Resend(apiKey);
  await client.emails.send({
    from,
    to: TEAM_EMAIL,
    subject: `Solicitud de reembolso: "${summary.eventTitle}" — ${amount}`,
    html,
    text,
  });
};
