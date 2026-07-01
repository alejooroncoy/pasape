import { Money } from "@/lib/_shared/money";
import "server-only";
import { Preference } from "mercadopago";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import {
  appBaseUrl,
  isPublicBaseUrl,
  mpClient,
} from "../infrastructure/MercadoPagoClient";
import { reportMpError } from "../infrastructure/reportMpError";

export type CreatePreferenceInput = {
  orderId: string;
  eventSlug: string;
  eventTitle: string;
  payerEmail?: string | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    currency?: string;
  }>;
  // Optional: org access token for marketplace mode (currently ignored, see
  // MercadoPagoClient docstring).
  sellerAccessToken?: string | null;
};

export type CreatePreferenceOutput = {
  preferenceId: string;
  initPoint: string;
};

export const createPreference = async (
  input: CreatePreferenceInput,
): Promise<Result<CreatePreferenceOutput>> => {
  const base = appBaseUrl();
  const currency = input.items[0]?.currency ?? "PEN";

  // MP rechaza back_urls/notification_url no públicas cuando auto_return está
  // activo. En dev sin túnel los omitimos (ver isPublicBaseUrl).
  const isPublicUrl = isPublicBaseUrl(base);

  try {
    const config = mpClient({ sellerAccessToken: input.sellerAccessToken ?? null });
    const pref = new Preference(config);

    const created = await pref.create({
      body: {
        external_reference: input.orderId,
        // MP también rechaza notification_url no pública (IP de LAN / http).
        // En dev sin túnel la omitimos para no romper la creación; el webhook
        // solo aplica con URL pública (prod o túnel https).
        ...(isPublicUrl
          ? { notification_url: `${base}/api/webhook/mp` }
          : {}),
        statement_descriptor: "PASAPE",
        items: input.items.map((it) => ({
          id: it.id,
          title: it.title,
          quantity: it.quantity,
          unit_price: Money.toSoles(it.unitPriceCents),
          currency_id: it.currency ?? currency,
        })),
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        ...(isPublicUrl
          ? {
              back_urls: {
                success: `${base}/events/${input.eventSlug}/processing?order=${input.orderId}`,
                failure: `${base}/events/${input.eventSlug}/pay-error?order=${input.orderId}`,
                pending: `${base}/events/${input.eventSlug}/processing?order=${input.orderId}`,
              },
              auto_return: "approved" as const,
            }
          : {}),
        metadata: { event_slug: input.eventSlug, event_title: input.eventTitle },
      },
    });

    const id = created.id;
    if (!id) return err("mp_preference_no_id");

    // Persist on the order so the FE/webhook can match later.
    await supabaseAdmin()
      .from("orders")
      .update({ mp_preference_id: id })
      .eq("id", input.orderId);

    return ok({
      preferenceId: id,
      initPoint: created.init_point ?? created.sandbox_init_point ?? "",
    });
  } catch (e) {
    const message = (e as Error).message;
    reportMpError(message, { stage: "preference", orderId: input.orderId });
    return err(`mp_create_preference_failed: ${message}`);
  }
};
