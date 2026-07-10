import { Money } from "@/lib/_shared/money";
import "server-only";
import crypto from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl, isPublicBaseUrl, buildOrderItems, mpPeruIdentification, peekCardToken } from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";
import { assertOrderPaymentAccess } from "./assertOrderPaymentAccess";
import { validateMpPaymentAmount } from "./validateMpPaymentAmount";
import { settleApprovedPayment } from "./settleApprovedPayment";
import { acquireOrderPaymentLock, releaseOrderPaymentLock } from "./acquireOrderPaymentLock";
import { parseE164 } from "@/lib/phone/countries";
import { decryptDni } from "@/server/_shared/crypto/dni";
import { signalHash } from "@/server/tickets/domain/signalHash";
import { effectiveMaxPerCard } from "@/server/tickets/domain/purchaseCaps";
import { countOrderAdmission, countPaidAdmissionByInstrument } from "./admissionCounts";
import { purchaseSignalsRepo } from "@/server/tickets/infrastructure/PurchaseSignalsRepo";
import {
  CARD_RING_DNI_THRESHOLD,
  decideCardEnforcement,
  enforceCardDecision,
  enforcementMode,
} from "@/server/tickets/domain/botEnforcement";
import { serverEvents } from "@/lib/analytics/serverEvents";

// Why: en prod, si MP_ACCESS_TOKEN no arranca con "APP_USR-" (o sea, parece
// ser de sandbox tipo "TEST-...") cobraríamos con dinero real usando
// credenciales de prueba — o peor, el token de prod contra el sandbox. Es un
// error silencioso y carísimo si nadie lo nota, así que lo dejamos imposible
// de ignorar en los logs (sin crashear la app).
const assertProductionMpToken = (token: string): void => {
  if (process.env.NODE_ENV !== "production") return;
  if (token.startsWith("APP_USR-")) return;
  const message = "MP_ACCESS_TOKEN no parece ser de producción (no empieza con APP_USR-)";
  console.error(`[payWithCard] ${message}`);
  Sentry.captureException(new Error(`mercadopago_sandbox_token_in_production: ${message}`), {
    tags: { area: "mercadopago", mp_stage: "config" },
  });
};

// Why: cobramos tarjeta con SDK v2 + Secure Fields para mantener UX embebida
// consistente con Yape. El frontend tokeniza con `mp.createCardToken({...})`
// y nos manda el token; nosotros hacemos `POST /v1/payments` aquí.

export type PayWithCardInput = {
  orderId: string;
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string | null;
  deviceId?: string | null;
  /** Token firmado de la orden (misma llave que /processing?k=). */
  orderToken?: string | null;
};

// Datos del challenge 3DS cuando el emisor pide autenticación. El frontend debe
// renderizar el `externalResourceUrl` (POST del `creq`) en un iframe.
export type ThreeDsInfo = { externalResourceUrl: string; creq: string };

export type PayWithCardOutput = {
  status: "approved" | "in_process" | "rejected" | "challenge";
  paymentId: string;
  message?: string;
  threeDsInfo?: ThreeDsInfo;
};

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
  status: string;
  total_cents: number;
  guest_email: string | null;
  guest_name: string | null;
  guest_dni: string | null;
  guest_dni_enc: string | null;
  guest_phone: string | null;
};

type ProfileRow = { id: string; email: string | null; full_name: string | null; phone: string | null };
type EventRow = { id: string; title: string; max_tickets_per_person: number | null };

export const payWithCard = async (
  input: PayWithCardInput,
): Promise<Result<PayWithCardOutput>> => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return err("missing_mp_access_token");
  assertProductionMpToken(accessToken);

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select(
      "id, buyer_id, event_id, status, total_cents, guest_email, guest_name, guest_dni, guest_dni_enc, guest_phone",
    )
    .eq("id", input.orderId)
    .maybeSingle<OrderRow>();
  if (!order) return err("order_not_found");
  if (order.status === "paid") return ok({ status: "approved", paymentId: "already_paid" });
  if (order.status !== "pending") return err(`order_status_invalid:${order.status}`);

  const access = await assertOrderPaymentAccess({
    orderId: order.id,
    buyerId: order.buyer_id,
    guestEmail: order.guest_email,
    orderToken: input.orderToken,
  });
  if (!access.ok) return err(access.error);

  let email = order.guest_email ?? null;
  let fullName = order.guest_name ?? null;
  let phone = order.guest_phone ?? null;
  let dni = decryptDni(order.guest_dni_enc) ?? order.guest_dni ?? null;
  if (order.buyer_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", order.buyer_id)
      .maybeSingle<ProfileRow>();
    email = email ?? profile?.email ?? null;
    fullName = fullName ?? profile?.full_name ?? null;
    phone = phone ?? profile?.phone ?? null;
    // El DNI de un comprador LOGUEADO no vive en orders.guest_* (esas columnas
    // solo se pueblan en checkout de invitado) sino en kyc_documents. Sin esto,
    // el anti-multicuenta por tarjeta (card_many_dni) queda ciego para cualquier
    // atacante que use cuentas logueadas en vez de guest checkout.
    if (!dni) {
      const { data: kyc } = await db
        .from("kyc_documents")
        .select("doc_number")
        .eq("profile_id", order.buyer_id)
        .eq("doc_kind", "dni")
        .maybeSingle<{ doc_number: string }>();
      dni = kyc?.doc_number ?? null;
    }
  }
  const phoneParsed = phone ? parseE164(phone) : null;
  if (!email) return err("payer_email_missing");

  const { data: event } = await db
    .from("events")
    .select("id, title, max_tickets_per_person")
    .eq("id", order.event_id)
    .maybeSingle<EventRow>();

  const [firstName, ...rest] = (fullName ?? "Comprador").split(" ");
  const lastName = rest.join(" ").trim() || "—";
  const description = event ? `Pasape: ${event.title}` : "Pasape";
  const base = appBaseUrl();

  // MP rechaza notification_url no pública. En dev sin túnel la omitimos — el
  // polling de status cubre la confirmación vía /api/tickets/order/[id]/status.
  const isPublicUrl = isPublicBaseUrl(base);
  // Why: additional_info.items + payer.phone son parte del checklist oficial
  // de "medición de calidad" de MP (mejor approval rate, mejor puntaje) — ver
  // https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/integration-test/go-to-production-requirements
  const items = await buildOrderItems(db, order.id);
  const body: Record<string, unknown> = {
    transaction_amount: Money.toSoles(Math.round(order.total_cents)),
    token: input.token,
    payment_method_id: input.paymentMethodId,
    installments: input.installments,
    description,
    external_reference: order.id,
    ...(isPublicUrl ? { notification_url: `${base}/api/webhook/mp` } : {}),
    statement_descriptor: "PASAPE",
    // 3DS 2.0: "optional" = MP solo pide challenge cuando el emisor lo exige.
    // Requiere capture automático (default true) y binary_mode desactivado
    // (default false) — ambos ya se cumplen al no enviarlos. Ver manejo de
    // `pending_challenge` abajo.
    three_d_secure_mode: "optional",
    payer: {
      email,
      first_name: firstName,
      last_name: lastName,
      // DNI (8 díg) o C.E (9-12 díg); pasaporte alfanumérico → null → se omite
      // (MP Perú no tiene tipo pasaporte; la identificación es opcional).
      ...(mpPeruIdentification(dni) ? { identification: mpPeruIdentification(dni)! } : {}),
    },
    additional_info: {
      ...(items.length > 0 ? { items } : {}),
      payer: {
        first_name: firstName,
        last_name: lastName,
        // El teléfono se guarda en E.164 (el comprador puede ser extranjero: la
        // tarjeta acepta país). Lo partimos en area_code (código del país) +
        // número nacional; legacy sin país cae a Perú (51).
        ...(phoneParsed?.national
          ? {
              phone: {
                area_code: phoneParsed.country?.dial ?? "51",
                number: phoneParsed.national,
              },
            }
          : {}),
      },
    },
  };
  if (input.issuerId) body.issuer_id = input.issuerId;

  // Lock atómico: solo un request concurrente puede tomar la orden. `status`
  // tiene un CHECK constraint que no incluye un valor "processing", así que
  // usamos `mp_status` (texto libre) como marca de lock — un UPDATE
  // condicional que solo pasa si nadie más la tomó ya. Dos requests
  // concurrentes (doble clic, reintento de red) ya no pueden ambos leer
  // "pending" y ambos cobrar en MP: el segundo pierde el CAS y no llama a MP.
  const locked = await acquireOrderPaymentLock(order.id);
  if (!locked) {
    return err("order_already_processing");
  }

  const revertLock = async () => {
    await releaseOrderPaymentLock(order.id);
  };

  // ── Enforcement anti-multicuenta por tarjeta (PRE-COBRO) ────────────────────
  // Correlacionamos la tarjeta con el DNI ANTES de cobrar. El BIN+últimos4 se
  // leen del card token con un GET (que NO lo consume: lo gasta el POST /payments
  // de más abajo), así podemos rechazar un anillo sin mover un centavo. Todo el
  // bloque es best-effort y fail-open: si el peek no trae BIN, o la correlación
  // falla, `cardAssessed` queda false y el pago sigue su curso — el enforcement
  // degrada a solo-observación post-cobro (nunca cobramos-y-revertimos a un
  // comprador posiblemente legítimo). Ver decideCardEnforcement para cómo una
  // familia (varios DNIs, 1 device) queda protegida.
  //
  // Peek SIEMPRE (ya no solo en enforcement != shadow): además del detector de
  // anillo, el cardHash alimenta el CAP POR TARJETA, que es una regla DURA de
  // negocio (anti-sobrecompra), siempre activa e independiente de BOT_ENFORCEMENT.
  // Tradeoff: un GET extra a MP antes del cobro; aceptable para no permitir que
  // una sola tarjeta compre N×tope creando multicuentas.
  let cardAssessed = false;
  const cardEnforcementMode = enforcementMode();
  const peek = await peekCardToken(input.token);
  const cardHash = peek
    ? signalHash("card", `${peek.bin}${peek.last4}:${peek.cardholderName}`)
    : null;
  if (peek && cardHash) {
    const dniHash = signalHash("dni", dni);

    // ── CAP POR TARJETA (duro, pre-cobro, siempre activo) ────────────────────
    // Entradas individuales ya pagadas con esta tarjeta en el evento + las de
    // esta orden. Si supera el tope (2× el tope por persona) rechazamos ANTES de
    // cobrar. Corta el "N DNIs × tope c/u con una sola tarjeta".
    const maxPerCard = effectiveMaxPerCard(event?.max_tickets_per_person ?? null);
    const priorByCard = await countPaidAdmissionByInstrument(
      db,
      order.event_id,
      "card_hash",
      cardHash,
    );
    const thisOrderAdmission = await countOrderAdmission(db, order.id);
    if (priorByCard + thisOrderAdmission > maxPerCard) {
      console.warn(
        `[antibot] cap por tarjeta superado: ${priorByCard}+${thisOrderAdmission} > ${maxPerCard} (order ${order.id}).`,
      );
      await revertLock();
      return err("max_per_card_exceeded");
    }

    // Sella la huella de la tarjeta en la orden ANTES de cobrar, para que cuente
    // en el cap aunque el pago se liquide asíncrono (3DS challenge / in_process
    // vía webhook) y nunca pase por la rama `approved` de abajo. El conteo filtra
    // status='paid', así que una orden que luego falle/expire no suma.
    await db.from("orders").update({ card_hash: cardHash }).eq("id", order.id);

    // ── Anillo por tarjeta (heurística anti-multicuenta, gate por modo) ──────
    // En shadow no bloquea; solo el recordCard post-cobro deja telemetría.
    if (cardEnforcementMode !== "shadow") {
      const assessment = await purchaseSignalsRepo.assessCard({
        orderId: order.id,
        eventId: order.event_id,
        cardHash,
        dniHash,
      });
      if (assessment) {
        cardAssessed = true;
        const mode = cardEnforcementMode;
        const decision = enforceCardDecision(
          decideCardEnforcement(
            { distinctDnis: assessment.distinctDnis, distinctDevices: assessment.distinctDevices },
            mode,
          ),
        );
        if (decision.reason) {
          serverEvents.botSignal(order.buyer_id ?? order.id, {
            phase: "card",
            bot_score: 100,
            reasons: [decision.reason],
            action: decision.action,
            enforcement_mode: mode,
            event_id: order.event_id,
            order_id: order.id,
            checkout_token_ok: false,
          });
        }
        if (decision.block) {
          if (assessment.signalId) {
            await purchaseSignalsRepo.markCardBlocked(
              assessment.signalId,
              decision.reason ?? "card_multiaccount",
            );
          }
          console.warn(
            `[antibot] multicuenta por tarjeta BLOQUEADA antes de cobrar: ${assessment.distinctDnis} DNIs / ${assessment.distinctDevices} devices con la misma tarjeta (order ${order.id}, modo ${mode}).`,
          );
          await revertLock();
          return err("card_multiaccount");
        }
        if (decision.reason === "card_many_dni") {
          console.warn(
            `[antibot] posible multicuenta por tarjeta: ${assessment.distinctDnis} DNIs distintos con la misma tarjeta (order ${order.id}, modo ${mode}, no bloqueado).`,
          );
        }
      }
    }
  }

  // Idempotency key determinística: hash de orderId + token de tarjeta. Un
  // reintento del MISMO request (mismo token) reusa la key y MP lo dedupea de
  // verdad; un intento nuevo (nuevo token, p.ej. tras un fallo) genera una key
  // distinta y no queda bloqueado por una respuesta cacheada vieja.
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`card:${order.id}:${input.token}`)
    .digest("hex");

  type MpPaymentResponse = {
    id?: number | string;
    status?: string;
    status_detail?: string;
    message?: string;
    error?: string;
    transaction_amount?: number;
    three_ds_info?: { external_resource_url?: string; creq?: string };
    // MP devuelve el BIN + últimos 4 + titular de la tarjeta usada.
    card?: {
      first_six_digits?: string | null;
      last_four_digits?: string | null;
      cardholder?: { name?: string | null } | null;
    };
  };
  type CreateBody = Parameters<Payment["create"]>[0]["body"];

  // SDK oficial de MP (checklist "SDK de backend", +5 pts): manda los headers de
  // tracking (X-Product-Id / User-Agent) que MP reconoce como integración con
  // SDK. Preservamos idempotencyKey y el device_id vía requestOptions — el SDK
  // los mapea a X-Idempotency-Key y X-Meli-Session-Id, idénticos al flujo raw.
  const client = new MercadoPagoConfig({ accessToken });
  let data: MpPaymentResponse;
  try {
    data = (await new Payment(client).create({
      body: body as unknown as CreateBody,
      requestOptions: {
        idempotencyKey,
        // Device fingerprint (antifraude / approval rate). MP lo ignora si es vacío.
        ...(input.deviceId ? { meliSessionId: input.deviceId } : {}),
      },
    })) as MpPaymentResponse;
  } catch (e) {
    // El SDK lanza ante error de API (rechazo de request, auth) o de red. Los
    // rechazos de tarjeta (fondos, CVV…) NO caen aquí: vuelven con status 2xx y
    // status="rejected", y se tratan más abajo. El error de API trae `message`
    // y, cuando aplica, `status`/`cause` con el detalle de MP.
    await revertLock();
    const apiErr = e as { message?: string; status?: number; cause?: unknown };
    const message = apiErr?.message ?? "mp_error";
    reportMpError(message, {
      stage: "payment",
      method: "card",
      orderId: order.id,
      httpStatus: apiErr?.status ?? 0,
      mpResponse: apiErr,
    });
    return err(`mp_payment_failed: ${message}`);
  }

  const paymentId = String(data.id ?? "");
  const status = (data.status ?? "rejected") as string;

  // Anti-multicuenta por tarjeta (FALLBACK post-cobro, solo-observación): si el
  // peek pre-cobro no pudo leer el BIN del token (MP no lo devolvió, token
  // expirado…), aún registramos la correlación con el BIN+últimos4 que MP sí
  // trae en la respuesta del pago. Aquí NO bloqueamos: el pago ya se ejecutó, y
  // cobrar-y-revertir a un comprador posiblemente legítimo es peor que observar.
  // El enforcement real es el pre-cobro de arriba. Fire-and-forget.
  if (!cardAssessed) {
    const bin = data.card?.first_six_digits ?? "";
    const last4 = data.card?.last_four_digits ?? "";
    if (bin && last4) {
      const respCardHash = signalHash("card", `${bin}${last4}:${data.card?.cardholder?.name ?? ""}`);
      const dniHash = signalHash("dni", dni);
      if (respCardHash) {
        void purchaseSignalsRepo
          .recordCard({ orderId: order.id, eventId: order.event_id, cardHash: respCardHash, dniHash })
          .then((distinctDnis) => {
            if (distinctDnis >= CARD_RING_DNI_THRESHOLD) {
              serverEvents.botSignal(order.buyer_id ?? order.id, {
                phase: "card",
                bot_score: 100,
                reasons: ["card_many_dni"],
                action: "would_block",
                enforcement_mode: enforcementMode(),
                event_id: order.event_id,
                order_id: order.id,
                checkout_token_ok: false,
              });
              console.warn(
                `[antibot] posible multicuenta por tarjeta (post-cobro, sin peek): ${distinctDnis} DNIs distintos con la misma tarjeta (order ${order.id}).`,
              );
            }
          });
      }
    }
  }

  const patch: Record<string, unknown> = {
    mp_payment_id: paymentId,
    mp_status: status,
  };

  if (status === "approved") {
    const amountOk = validateMpPaymentAmount(
      order.total_cents,
      data.transaction_amount,
      order.id,
    );
    if (!amountOk.ok) {
      await revertLock();
      await db
        .from("orders")
        .update({
          mp_status: "approved_amount_mismatch",
          mp_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return err(amountOk.error);
    }
    const settled = await settleApprovedPayment(order.id, paymentId, status);
    if (!settled.ok) {
      await revertLock();
      return settled;
    }
    // Fallback: si el peek pre-cobro no pudo leer el BIN (cardHash null), no se
    // selló arriba — lo sellamos ahora con el BIN+últimos4 que MP devolvió en la
    // respuesta. Cuando el peek sí funcionó, card_hash ya está escrito (pre-cobro,
    // arriba) y esto no corre. No-PII, irreversible.
    if (!cardHash && data.card?.first_six_digits && data.card?.last_four_digits) {
      const respHash = signalHash(
        "card",
        `${data.card.first_six_digits}${data.card.last_four_digits}:${data.card.cardholder?.name ?? ""}`,
      );
      if (respHash) {
        await db.from("orders").update({ card_hash: respHash }).eq("id", order.id);
      }
    }
  } else if (status === "rejected" || status === "cancelled") {
    patch.status = "failed";
    await db.from("orders").update(patch).eq("id", order.id);
  } else {
    await db.from("orders").update(patch).eq("id", order.id);
  }

  // 3DS challenge: MP pide autenticar. La orden queda pending (el webhook la
  // resolverá cuando el comprador complete el challenge). El frontend debe
  // renderizar el challenge con `threeDsInfo` — arrancarlo en <30s (regla de MP).
  const tds = data.three_ds_info;
  if (
    status === "pending" &&
    data.status_detail === "pending_challenge" &&
    tds?.external_resource_url &&
    tds?.creq
  ) {
    return ok({
      status: "challenge",
      paymentId,
      message: data.status_detail,
      threeDsInfo: { externalResourceUrl: tds.external_resource_url, creq: tds.creq },
    });
  }

  return ok({
    status:
      status === "approved" || status === "in_process" || status === "rejected"
        ? (status as "approved" | "in_process" | "rejected")
        : status === "pending"
          ? "in_process"
          : "rejected",
    paymentId,
    message: data.status_detail,
  });
};
