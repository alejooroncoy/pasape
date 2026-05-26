import "server-only";
import { randomUUID } from "node:crypto";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { appBaseUrl } from "../infrastructure/MercadoPagoClient";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";

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
};

type ProfileRow = { id: string; email: string | null; full_name: string | null };
type EventRow = { id: string; title: string };

export const payWithCard = async (
  input: PayWithCardInput,
): Promise<Result<PayWithCardOutput>> => {
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
  if (order.status === "paid") return ok({ status: "approved", paymentId: "already_paid" });
  if (order.status !== "pending") return err(`order_status_invalid:${order.status}`);

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

  // MP rechaza notification_url cuando apunta a localhost. En dev sin túnel
  // público lo omitimos — el polling de status sigue funcionando vía
  // /api/tickets/order/[id]/status.
  const isPublicUrl = !/localhost|127\.0\.0\.1/.test(base);
  const body: Record<string, unknown> = {
    transaction_amount: Math.round(order.total_cents) / 100,
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
  };
  if (input.issuerId) body.issuer_id = input.issuerId;

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
    status?: string;
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
    return err(
      `mp_payment_failed: ${data.message ?? data.error ?? `status ${mpRes.status}`}`,
    );
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
  await db.from("orders").update(patch).eq("id", order.id);

  if (status === "approved") {
    dispatchTicketDelivery({}, order.id).catch((e) => {
      console.error("[payWithCard] dispatchTicketDelivery failed:", e);
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
