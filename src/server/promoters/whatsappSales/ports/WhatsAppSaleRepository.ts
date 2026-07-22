import type { Result } from "@/server/_shared/result";
import type { CreateWhatsAppSaleInput, WhatsAppSale } from "../domain/WhatsAppSale";

export interface WhatsAppSaleRepository {
  create(input: CreateWhatsAppSaleInput & { confirmationCode: string }): Promise<Result<WhatsAppSale>>;

  // Único pedido pendiente entre este promotor y este comprador — así el bot
  // sabe si "pagado" se refiere a una venta ya abierta o si hace falta pedir
  // el código explícito (ver HandleIncomingWhatsAppMessage).
  findPendingByPromoterAndBuyer(
    promoterId: string,
    buyerPhone: string,
  ): Promise<Result<WhatsAppSale | null>>;

  findByConfirmationCode(code: string): Promise<Result<WhatsAppSale | null>>;

  // Busca el promotor dueño de este número de WhatsApp (autorización: solo el
  // promotor registrado con ese teléfono puede aprobar/rechazar sus ventas).
  findPromoterIdByPhone(phone: string): Promise<Result<string | null>>;

  // Transición atómica CAS (pending_payment -> paid), ver
  // confirm_whatsapp_sale en la migración. `null` si la venta no existía o ya
  // no estaba pending_payment para ese promotor (doble aprobación, carrera).
  confirmPayment(saleId: string, promoterId: string): Promise<Result<WhatsAppSale | null>>;

  rejectPayment(saleId: string, promoterId: string): Promise<Result<WhatsAppSale | null>>;

  listByPromoter(promoterId: string): Promise<Result<WhatsAppSale[]>>;
}
