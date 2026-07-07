// Port de despacho de notificaciones transaccionales (no in-app).
// Implementaciones: ResendEmailSender, WhatsAppNotificationSender, CompositeNotificationSender.
// El "cómo se manda" por WhatsApp (Kapso vs Meta) vive detrás de WhatsAppGateway.

export type TicketDeliveryRecipient = {
  email?: string | null;
  phone?: string | null;
};

export type TicketDeliveryInput = {
  to: TicketDeliveryRecipient;
  holderName: string;
  eventTitle: string;
  eventStartsAt: string;
  eventVenue: string | null;
  ticketUrl: string;
  walletSignupUrl: string;
  /** Cuántos tickets de la orden caen en este mismo destinatario (agrupados
   *  por contacto en DispatchTicketDelivery) — 1 = copy singular, >1 = "tienes N". */
  ticketCount: number;
};

export type TicketDeliveryResult = {
  emailSent: boolean;
  whatsappSent: boolean;
  errors?: { channel: "email" | "whatsapp"; message: string }[];
};

export interface NotificationSender {
  sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult>;
}
