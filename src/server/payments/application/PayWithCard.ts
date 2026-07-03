import { Money } from "@/lib/_shared/money";
import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl, isPublicBaseUrl, buildOrderItems } from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";

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
  paymentMethodId: string; // "visa", "master", "amex", "debvisa", etc. — MP lo infiere del BIN
  installments: number; // 1 = pago único
  issuerId?: string | null;
};

export type PayWithCardOutput = {
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
  guest_phone: string | null;
};

type ProfileRow = { id: string; email: string | null; full_name: string | null; phone: string | null };
type EventRow = { id: string; title: string };

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
      "id, buyer_id, event_id, status, total_cents, guest_email, guest_name, guest_dni, guest_phone",
    )
    .eq("id", input.orderId)
    .maybeSingle<OrderRow>();
  if (!order) return err("order_not_found");
  if (order.status === "paid") return ok({ status: "approved", paymentId: "already_paid" });
  if (order.status !== "pending") return err(`order_status_invalid:${order.status}`);

  let email = order.guest_email ?? null;
  let fullName = order.guest_name ?? null;
  let phone = order.guest_phone ?? null;
  const dni = order.guest_dni ?? null;
  if (order.buyer_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", order.buyer_id)
      .maybeSingle<ProfileRow>();
    email = email ?? profile?.email ?? null;
    fullName = fullName ?? profile?.full_name ?? null;
    phone = phone ?? profile?.phone ?? null;
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
    token: input.token,
    payment_method_id: input.paymentMethodId,
    installments: input.installments,
    description,
    external_reference: order.id,
    ...(isPublicUrl ? { notification_url: `${base}/api/webhook/mp` } : {}),
    statement_descriptor: "PASAPE",
    payer: {
      email,
      first_name: firstName,
      last_name: lastName,
      ...(dni ? { identification: { type: "DNI", number: dni } } : {}),
    },
    additional_info: {
      ...(items.length > 0 ? { items } : {}),
      payer: {
        first_name: firstName,
        last_name: lastName,
        ...(phone ? { phone: { area_code: "51", number: phone } } : {}),
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

  // Idempotency key determinística: hash de orderId + token de tarjeta. Un
  // reintento del MISMO request (mismo token) reusa la key y MP lo dedupea de
  // verdad; un intento nuevo (nuevo token, p.ej. tras un fallo) genera una key
  // distinta y no queda bloqueado por una respuesta cacheada vieja.
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`card:${order.id}:${input.token}`)
    .digest("hex");

  let mpRes: Response;
  try {
    mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    await revertLock();
    return err(`mp_network_error: ${(e as Error).message}`);
  }

  type MpPaymentResponse = {
    id?: number | string;
    status?: string;
    status_detail?: string;
    message?: string;
    error?: string;
  };
  let data: MpPaymentResponse;
  try {
    data = (await mpRes.json()) as MpPaymentResponse;
  } catch {
    await revertLock();
    return err(`mp_invalid_response: status ${mpRes.status}`);
  }

  if (!mpRes.ok) {
    const message = data.message ?? data.error ?? `status ${mpRes.status}`;
    reportMpError(message, {
      stage: "payment",
      method: "card",
      orderId: order.id,
      httpStatus: mpRes.status,
      mpResponse: data,
    });
    await revertLock();
    return err(`mp_payment_failed: ${message}`);
  }

  const paymentId = String(data.id ?? "");
  const status = (data.status ?? "rejected") as string;

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

  if (status === "approved") {
    after(() =>
      dispatchTicketDelivery({}, order.id).catch((e) => {
        console.error("[payWithCard] dispatchTicketDelivery failed:", e);
        Sentry.captureException(e, { tags: { area: "ticket-delivery", orderId: order.id } });
      }),
    );
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
