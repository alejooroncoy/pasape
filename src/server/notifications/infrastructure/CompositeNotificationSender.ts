import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";

// Despacha por todos los canales en paralelo, agregando resultados y errores.
// Si un canal falla, los demás siguen.

export class CompositeNotificationSender implements NotificationSender {
  constructor(private readonly senders: NotificationSender[]) {}

  async sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult> {
    const results = await Promise.all(
      this.senders.map((s) =>
        s.sendTicketDelivery(input).catch(
          (err): TicketDeliveryResult => ({
            emailSent: false,
            whatsappSent: false,
            errors: [{ channel: "email", message: err instanceof Error ? err.message : String(err) }],
          }),
        ),
      ),
    );
    const merged: TicketDeliveryResult = { emailSent: false, whatsappSent: false };
    const errors: NonNullable<TicketDeliveryResult["errors"]> = [];
    for (const r of results) {
      if (r.emailSent) merged.emailSent = true;
      if (r.whatsappSent) merged.whatsappSent = true;
      if (r.errors) errors.push(...r.errors);
    }
    if (errors.length > 0) merged.errors = errors;
    return merged;
  }
}
