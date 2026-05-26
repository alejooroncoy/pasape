// Port de despacho de notificaciones transaccionales (no in-app).
// Implementaciones: ResendEmailSender, TwilioWhatsAppSender, CompositeNotificationSender.

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
};

export type TicketDeliveryResult = {
  emailSent: boolean;
  whatsappSent: boolean;
  errors?: { channel: "email" | "whatsapp"; message: string }[];
};

export interface NotificationSender {
  sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult>;
}
