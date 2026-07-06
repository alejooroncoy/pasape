import { PostHog } from "posthog-node";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

let client: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

// distinctId para eventos server-side de rutas autenticadas (organizador,
// promotor): el profileId de la sesión, igual al que posthog-js usa
// client-side tras `PostHogIdentify` — así el mismo usuario no se parte en
// dos identidades entre eventos de cliente y de servidor.
export async function getAuthDistinctId(): Promise<string> {
  const auth = await getAuthContext();
  return auth.ok ? auth.value.profileId : "anonymous";
}

// distinctId para eventos de pago/orden: usamos el buyer_id de la orden (real
// si está logueado, placeholder desechable si es guest — ver comentario en
// SupabaseTicketRepository sobre profiles de guest). Mantiene ligados
// order_created → payment_*_initiated → payment_completed de la MISMA orden,
// aunque el guest no tenga identidad persistente entre compras distintas.
export async function getOrderBuyerId(orderId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("orders")
    .select("buyer_id")
    .eq("id", orderId)
    .maybeSingle<{ buyer_id: string | null }>();
  return data?.buyer_id ?? null;
}
