import { Money } from "@/lib/_shared/money";
import "server-only";
import crypto from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl, isPublicBaseUrl, buildOrderItems, mpPeruIdentification } from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";

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
  token: string; // yape token generado por SDK v2 en el frontend
  phoneNumber: string; // 9 dígitos PE, viene del form
  // Device fingerprint de MP (window.MP_DEVICE_SESSION_ID, creado por el SDK v2).
  // Se envía como header X-Meli-Session-Id. Es el ítem "SDK de frontend" del
  // checklist de calidad: si la medición cae sobre un pago Yape, sin esto MP no
  // detecta el uso del SDK y baja el puntaje. También mejora el antifraude.
  deviceId?: string | null;
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
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type EventRow = { id: string; title: string };

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
      "id, buyer_id, event_id, status, total_cents, guest_email, guest_name, guest_dni",
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

  // Resolver email/nombre/dni: buyer profile o guest fields.
  let email = order.guest_email ?? null;
  let fullName = order.guest_name ?? null;
  const dni = order.guest_dni ?? null;
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
    .select("id, title")
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
  const { data: lockedOrder, error: lockErr } = await db
    .from("orders")
    .update({ mp_status: "locked" })
    .eq("id", order.id)
    .eq("status", "pending")
    .or("mp_status.is.null,mp_status.neq.locked")
    .select("id")
    .maybeSingle();
  if (lockErr || !lockedOrder) {
    return err("order_already_processing");
  }

  const revertLock = async () => {
    await db
      .from("orders")
      .update({ mp_status: null })
      .eq("id", order.id)
      .eq("mp_status", "locked");
  };

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

  // Persistir snapshot del estado MP en la order.
  const patch: Record<string, unknown> = {
    mp_payment_id: paymentId,
    mp_status: status,
  };
  if (status === "approved") {
    patch.status = "paid";
    patch.paid_at = new Date().toISOString();
  } else if (status === "rejected" || status === "cancelled") {
    patch.status = "failed";
  }
  // in_process/pending: `status` sigue "pending" (nunca lo cambiamos, solo
  // el lock en mp_status) — el webhook la moverá a paid/failed cuando MP
  // resuelva async. mp_status ya queda sobrescrito arriba con el valor real,
  // liberando el lock.
  await db.from("orders").update(patch).eq("id", order.id);

  // Si quedó aprobado, dispara el envío del QR. El webhook también lo
  // intentará — DispatchTicketDelivery es idempotente vía notification_dispatches.
  if (status === "approved") {
    after(() =>
      dispatchTicketDelivery({}, order.id).catch((e) => {
        console.error("[payWithYape] dispatchTicketDelivery failed:", e);
        Sentry.captureException(e, { tags: { area: "ticket-delivery", orderId: order.id } });
      }),
    );
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
