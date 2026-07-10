import { Money } from "@/lib/_shared/money";
import "server-only";
import crypto from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl, isPublicBaseUrl, buildOrderItems, mpPeruIdentification } from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";
import { assertOrderPaymentAccess } from "./assertOrderPaymentAccess";
import { validateMpPaymentAmount } from "./validateMpPaymentAmount";
import { settleApprovedPayment } from "./settleApprovedPayment";
import { acquireOrderPaymentLock, releaseOrderPaymentLock } from "./acquireOrderPaymentLock";
import { decryptDni } from "@/server/_shared/crypto/dni";
import { signalHash } from "@/server/tickets/domain/signalHash";
import { effectiveMaxPerCard } from "@/server/tickets/domain/purchaseCaps";
import { countOrderAdmission, countPaidAdmissionByInstrument } from "./admissionCounts";

// Why: en prod, si MP_ACCESS_TOKEN no arranca con "APP_USR-" (o sea, parece
// ser de sandbox tipo "TEST-...") cobraríamos con dinero real usando
// credenciales de prueba. Es un error silencioso y carísimo si nadie lo
// nota, así que lo dejamos imposible de ignorar en los logs (sin crashear).
const assertProductionMpToken = (token: string): void => {
  if (process.env.NODE_ENV !== "production") return;
  if (token.startsWith("APP_USR-")) return;
  const message = "MP_ACCESS_TOKEN no parece ser de producción (no empieza con APP_USR-)";
  console.error(`[payWithYape] ${message}`);
  Sentry.captureException(new Error(`mercadopago_sandbox_token_in_production: ${message}`), {
    tags: { area: "mercadopago", mp_stage: "config" },
  });
};

// Why: Yape no se renderiza en el Payment Brick, así que usamos el endpoint
// REST directo de MP (`POST /v1/payments`) con `payment_method_id: "yape"` y
// el token generado por la SDK v2 con `mp.yape({otp, phoneNumber}).create()`.
// Es el mismo flujo que tarjeta, solo cambia el método y el token.

export type PayWithYapeInput = {
  orderId: string;
  token: string;
  phoneNumber: string;
  deviceId?: string | null;
  orderToken?: string | null;
};

export type PayWithYapeOutput = {
  status: "approved" | "in_process" | "rejected";
  paymentId: string;
  message?: string;
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
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type EventRow = { id: string; title: string; max_tickets_per_person: number | null };

export const payWithYape = async (
  input: PayWithYapeInput,
): Promise<Result<PayWithYapeOutput>> => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return err("missing_mp_access_token");
  assertProductionMpToken(accessToken);

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select(
      "id, buyer_id, event_id, status, total_cents, guest_email, guest_name, guest_dni, guest_dni_enc",
    )
    .eq("id", input.orderId)
    .maybeSingle<OrderRow>();

  if (!order) return err("order_not_found");
  if (order.status === "paid") {
    // Idempotente: la order ya está pagada (otro intento exitoso o el webhook
    // ya llegó). Devolvemos approved sin reintentar el cobro.
    return ok({ status: "approved", paymentId: "already_paid" });
  }
  if (order.status !== "pending") {
    return err(`order_status_invalid:${order.status}`);
  }

  const access = await assertOrderPaymentAccess({
    orderId: order.id,
    buyerId: order.buyer_id,
    guestEmail: order.guest_email,
    orderToken: input.orderToken,
  });
  if (!access.ok) return err(access.error);

  // Resolver email/nombre/dni: buyer profile o guest fields.
  let email = order.guest_email ?? null;
  let fullName = order.guest_name ?? null;
  const dni = decryptDni(order.guest_dni_enc) ?? order.guest_dni ?? null;
  if (order.buyer_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", order.buyer_id)
      .maybeSingle<ProfileRow>();
    email = email ?? profile?.email ?? null;
    fullName = fullName ?? profile?.full_name ?? null;
  }
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
    payment_method_id: "yape",
    // Yape no admite cuotificación — MP requiere installments=1 explícito,
    // si no devuelve "Invalid installments".
    installments: 1,
    token: input.token,
    description,
    external_reference: order.id,
    ...(isPublicUrl ? { notification_url: `${base}/api/webhook/mp` } : {}),
    statement_descriptor: "PASAPE",
    payer: {
      email,
      first_name: firstName,
      last_name: lastName,
      // DNI/C.E deducido del formato (Yape es Perú, casi siempre DNI); si no
      // encaja se omite (identificación opcional).
      ...(mpPeruIdentification(dni) ? { identification: mpPeruIdentification(dni)! } : {}),
    },
    additional_info: {
      ...(items.length > 0 ? { items } : {}),
      payer: {
        first_name: firstName,
        last_name: lastName,
        ...(input.phoneNumber ? { phone: { area_code: "51", number: input.phoneNumber } } : {}),
      },
    },
  };

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

  // ── CAP POR CUENTA YAPE (duro, pre-cobro, siempre activo) ───────────────────
  // La cuenta Yape (un teléfono) es la huella no-falsificable del pago, igual que
  // la tarjeta. Sin esto, el cap por tarjeta solo empuja al revendedor a Yape. Se
  // cuenta las entradas ya pagadas con esta cuenta en el evento + las de esta
  // orden; si superan el tope (2× el tope por persona) se rechaza antes de cobrar.
  const yapeHash = signalHash("yape", input.phoneNumber);
  if (yapeHash) {
    const maxPerYape = effectiveMaxPerCard(event?.max_tickets_per_person ?? null);
    const priorByYape = await countPaidAdmissionByInstrument(
      db,
      order.event_id,
      "yape_hash",
      yapeHash,
    );
    const thisOrderAdmission = await countOrderAdmission(db, order.id);
    if (priorByYape + thisOrderAdmission > maxPerYape) {
      console.warn(
        `[antibot] cap por cuenta Yape superado: ${priorByYape}+${thisOrderAdmission} > ${maxPerYape} (order ${order.id}).`,
      );
      await revertLock();
      return err("max_per_card_exceeded");
    }
  }

  // Idempotency key determinística: hash de orderId + token de Yape. Un
  // reintento del MISMO request (mismo token) reusa la key y MP lo dedupea de
  // verdad; un intento nuevo (nuevo token, p.ej. tras un fallo) genera una key
  // distinta y no queda bloqueado por una respuesta cacheada vieja.
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`yape:${order.id}:${input.token}`)
    .digest("hex");

  type MpPaymentResponse = {
    id?: number | string;
    status?: "approved" | "in_process" | "rejected" | "pending" | "cancelled";
    status_detail?: string;
    message?: string;
    error?: string;
    transaction_amount?: number;
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
    // rechazos de Yape (OTP, fondos…) NO caen aquí: vuelven con status 2xx y
    // status="rejected", y se tratan más abajo.
    await revertLock();
    const apiErr = e as { message?: string; status?: number; cause?: unknown };
    const message = apiErr?.message ?? "mp_error";
    reportMpError(message, {
      stage: "payment",
      method: "yape",
      orderId: order.id,
      httpStatus: apiErr?.status ?? 0,
      mpResponse: apiErr,
    });
    return err(`mp_payment_failed: ${message}`);
  }

  const paymentId = String(data.id ?? "");
  const status = data.status ?? "rejected";

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
    // Sella la huella de la cuenta Yape en la orden pagada para el cap de futuras
    // compras (no-PII, irreversible).
    if (yapeHash) {
      await db.from("orders").update({ yape_hash: yapeHash }).eq("id", order.id);
    }
  } else if (status === "rejected" || status === "cancelled") {
    patch.status = "failed";
    await db.from("orders").update(patch).eq("id", order.id);
  } else {
    await db.from("orders").update(patch).eq("id", order.id);
  }

  return ok({
    status: status === "approved" || status === "in_process" || status === "rejected"
      ? status
      : status === "pending"
        ? "in_process"
        : "rejected",
    paymentId,
    message: data.status_detail,
  });
};
