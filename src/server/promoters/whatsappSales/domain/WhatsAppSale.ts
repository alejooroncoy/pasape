// MVP de venta por WhatsApp (docs/mvp-whatsapp-promotores-2026-07-21.md).
//
// Deliberadamente sin QR de acceso ni vínculo a ticket_types: el organizador
// (cuando lo hay) ya controla su propia puerta, así que un QR de Pasape acá
// sería decorativo. Esto es solo registro de venta + comprobante simple.

export type WhatsAppSaleStatus = "pending_payment" | "paid" | "rejected";

export type WhatsAppSale = {
  id: string;
  promoterId: string;
  promoterPhone: string;
  buyerPhone: string;
  buyerName: string | null;
  description: string | null;
  amountCents: number;
  currency: string;
  status: WhatsAppSaleStatus;
  confirmationCode: string;
  createdAt: string;
  paidAt: string | null;
};

export type CreateWhatsAppSaleInput = {
  promoterId: string;
  promoterPhone: string;
  buyerPhone: string;
  buyerName?: string | null;
  description?: string | null;
  amountCents: number;
  currency?: string;
};

// Código de comprobante corto que el comprador puede mostrar en la puerta,
// tipo "PROMO-CARLOS #048" — no es un QR firmado, es solo un identificador
// legible para que el promotor ubique la venta.
export const generateConfirmationCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1, ambiguos a mano
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
