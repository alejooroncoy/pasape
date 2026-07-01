import { Money } from "@/lib/_shared/money";
import "server-only";
import { randomUUID } from "node:crypto";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl, isPublicBaseUrl } from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";

// Why: Yape no se renderiza en el Payment Brick, así que usamos el endpoint
// REST directo de MP (`POST /v1/payments`) con `payment_method_id: "yape"` y
// el token generado por la SDK v2 con `mp.yape({otp, phoneNumber}).create()`.
// Es el mismo flujo que tarjeta, solo cambia el método y el token.

export type PayWithYapeInput = {
  orderId: string;
  token: string; // yape token generado por SDK v2 en el frontend
  phoneNumber: string; // 9 dígitos PE, viene del form
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
      ...(dni
        ? { identification: { type: "DNI", number: dni } }
        : {}),
    },
    additional_info: {
      payer: {
        phone: input.phoneNumber
          ? { area_code: "51", number: input.phoneNumber }
          : undefined,
      },
    },
  };

  let mpRes: Response;
  try {
    mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return err(`mp_network_error: ${(e as Error).message}`);
  }

  type MpPaymentResponse = {
    id?: number | string;
    status?: "approved" | "in_process" | "rejected" | "pending" | "cancelled";
    status_detail?: string;
    message?: string;
    error?: string;
  };
  let data: MpPaymentResponse;
  try {
    data = (await mpRes.json()) as MpPaymentResponse;
  } catch {
    return err(`mp_invalid_response: status ${mpRes.status}`);
  }

  if (!mpRes.ok) {
    const message = data.message ?? data.error ?? `status ${mpRes.status}`;
    reportMpError(message, {
      stage: "payment",
      method: "yape",
      orderId: order.id,
      httpStatus: mpRes.status,
      mpResponse: data,
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
  await db.from("orders").update(patch).eq("id", order.id);

  // Si quedó aprobado, dispara el envío del QR. El webhook también lo
  // intentará — DispatchTicketDelivery es idempotente vía notification_dispatches.
  if (status === "approved") {
    dispatchTicketDelivery({}, order.id).catch((e) => {
      console.error("[payWithYape] dispatchTicketDelivery failed:", e);
    });
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
