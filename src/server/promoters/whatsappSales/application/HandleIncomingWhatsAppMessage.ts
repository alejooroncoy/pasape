import type { WhatsAppGateway } from "@/server/notifications/ports/WhatsAppGateway";
import { formatWhatsAppPhone } from "@/server/notifications/infrastructure/whatsapp/phone";
import { generateConfirmationCode } from "../domain/WhatsAppSale";
import type { WhatsAppSaleRepository } from "../ports/WhatsAppSaleRepository";

type Deps = {
  saleRepo: WhatsAppSaleRepository;
  gateway: WhatsAppGateway;
  // Resuelve un sales_code ("PROMO-CARLOS" -> org_promoter_id) — vive en
  // infra porque hoy es una tabla más (org_promoters), no lógica de dominio.
  resolvePromoterBySalesCode: (code: string) => Promise<{ id: string; name: string; phone: string } | null>;
};

export type IncomingMessage = {
  fromPhone: string;
  text: string;
};

// Extrae "PROMO-<code>" del texto del link prellenado (case-insensitive, con o
// sin espacios alrededor). No es más robusto que esto a propósito — es el MVP.
const extractSalesCode = (text: string): string | null => {
  const match = text.match(/PROMO[-_\s]?([A-Za-z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
};

const isConfirmation = (text: string): boolean =>
  /^\s*pagad[oa]\b/i.test(text) || /^\s*ya\s*(le\s*)?pag/i.test(text);

const isRejection = (text: string): boolean =>
  /^\s*no\s*(lleg|pag)/i.test(text) || /^\s*rechaz/i.test(text);

// Router mínimo del bot: decide si el mensaje entrante es (a) un promotor
// aprobando/rechazando una venta suya, o (b) un comprador nuevo iniciando una
// compra. No hay máquina de estados de conversación persistida todavía — cada
// mensaje se interpreta solo, apoyado en lo que ya existe en la DB
// (pending_payment abierto, o no). Eso alcanza para el MVP; si la
// conversación se vuelve más rica (varios turnos de cotización) esto necesita
// evolucionar a un estado explícito por conversación.
export const handleIncomingWhatsAppMessage = async (
  { saleRepo, gateway, resolvePromoterBySalesCode }: Deps,
  msg: IncomingMessage,
): Promise<void> => {
  const from = formatWhatsAppPhone(msg.fromPhone);
  const text = msg.text.trim();

  const promoterIdResult = await saleRepo.findPromoterIdByPhone(from);
  const senderIsPromoter = promoterIdResult.ok && promoterIdResult.value !== null;

  if (senderIsPromoter && promoterIdResult.ok && promoterIdResult.value) {
    await handlePromoterMessage({ saleRepo, gateway }, promoterIdResult.value, from, text);
    return;
  }

  await handleBuyerMessage({ saleRepo, gateway, resolvePromoterBySalesCode }, from, text);
};

const handlePromoterMessage = async (
  { saleRepo, gateway }: Pick<Deps, "saleRepo" | "gateway">,
  promoterId: string,
  promoterPhone: string,
  text: string,
): Promise<void> => {
  // El bot siempre le pide el código al promotor al abrir la venta (ver
  // handleBuyerMessage) — por eso "pagado"/"no llegó" sin código no alcanza,
  // no hay forma confiable de adivinar a qué venta se refiere.
  const codeMatch = text.match(/([A-Z0-9]{6})/i);
  const explicitCode = codeMatch ? codeMatch[1].toUpperCase() : null;

  if (!explicitCode) {
    await gateway.sendText({
      to: promoterPhone,
      body: "Dime con qué código — responde 'pagado <código>' o 'no llegó <código>'.",
    });
    return;
  }

  const sale = await saleRepo.findByConfirmationCode(explicitCode);
  if (!sale.ok || !sale.value) {
    await gateway.sendText({
      to: promoterPhone,
      body: "No encontré ninguna venta con ese código.",
    });
    return;
  }

  if (sale.value.promoterId !== promoterId) {
    await gateway.sendText({
      to: promoterPhone,
      body: "Esa venta no te pertenece.",
    });
    return;
  }

  if (isConfirmation(text)) {
    const updated = await saleRepo.confirmPayment(sale.value.id, promoterId);
    if (!updated.ok || !updated.value) {
      await gateway.sendText({ to: promoterPhone, body: "Esa venta ya no estaba pendiente (¿doble mensaje?)." });
      return;
    }
    await gateway.sendText({
      to: promoterPhone,
      body: `Listo, marcada como pagada: ${updated.value.confirmationCode}.`,
    });
    await gateway.sendText({
      to: updated.value.buyerPhone,
      body: `¡Confirmado! Tu compra quedó registrada con el código ${updated.value.confirmationCode}. Muéstraselo a tu promotor en la puerta.`,
    });
    return;
  }

  if (isRejection(text)) {
    const updated = await saleRepo.rejectPayment(sale.value.id, promoterId);
    if (!updated.ok || !updated.value) return;
    await gateway.sendText({
      to: updated.value.buyerPhone,
      body: "Tu compra fue cancelada porque el pago no llegó. Escríbele a tu promotor si crees que es un error.",
    });
    return;
  }
};

const handleBuyerMessage = async (
  { saleRepo, gateway, resolvePromoterBySalesCode }: Deps,
  buyerPhone: string,
  text: string,
): Promise<void> => {
  const salesCode = extractSalesCode(text);
  if (!salesCode) {
    // Fallback: no vino por el link con texto prellenado (ver diseño del MVP).
    await gateway.sendText({
      to: buyerPhone,
      body: "¡Hola! ¿De parte de quién vienes? Escribe el nombre de tu promotor y le avisamos.",
    });
    return;
  }

  const promoter = await resolvePromoterBySalesCode(salesCode);
  if (!promoter) {
    await gateway.sendText({
      to: buyerPhone,
      body: "No reconocí ese código de promotor. ¿Puedes confirmarlo con la persona que te invitó?",
    });
    return;
  }

  // Idempotencia: si el comprador reenvía el mismo link (doble clic, o abre
  // el chat de nuevo) sin que el promotor haya confirmado todavía, no
  // duplicamos la venta — le recordamos el código que ya tiene abierto.
  const existing = await saleRepo.findPendingByPromoterAndBuyer(promoter.id, buyerPhone);
  if (existing.ok && existing.value) {
    await gateway.sendText({
      to: buyerPhone,
      body: `Ya tienes un pedido abierto con ${promoter.name} (código ${existing.value.confirmationCode}). Coordina el pago con tu promotor.`,
    });
    return;
  }

  // El MVP no tiene catálogo de precios (no hay ticket_types de por medio) —
  // el promotor negocia el monto directamente con el comprador, como ya hace
  // hoy. El bot solo abre el registro; el monto se completa cuando el
  // promotor confirma el pago (ver TODO en docs del MVP: hoy se registra 0 y
  // se ajusta a mano — pendiente de resolver antes de producción real).
  const code = generateConfirmationCode();
  const created = await saleRepo.create({
    promoterId: promoter.id,
    promoterPhone: promoter.phone,
    buyerPhone,
    amountCents: 0,
    confirmationCode: code,
  });
  if (!created.ok) return;

  await gateway.sendText({
    to: buyerPhone,
    body: `¡Hola! Tu pedido con ${promoter.name} quedó registrado (código ${code}). Coordina el pago por Yape/transferencia directamente con tu promotor — apenas confirme, te aviso por aquí.`,
  });
  await gateway.sendText({
    to: promoter.phone,
    body: `Nuevo comprador por tu link (código ${code}). Cuando te llegue el pago, respóndeme "pagado ${code}".`,
  });
};
