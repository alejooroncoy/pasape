import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { verifyOrderLink } from "@/server/notifications/domain/OrderLinkToken";

export type OrderPaymentAccessInput = {
  orderId: string;
  buyerId: string | null;
  guestEmail: string | null;
  orderToken?: string | null;
};

/** Prueba de posesión antes de cobrar o bloquear una orden (card/yape). */
export async function assertOrderPaymentAccess(
  order: OrderPaymentAccessInput,
): Promise<Result<{ profileId: string | null }>> {
  const auth = await getAuthContext();
  const authEmail = auth.ok ? auth.value.email?.toLowerCase() ?? null : null;

  const isOwner = auth.ok && !!order.buyerId && auth.value.profileId === order.buyerId;
  const isGuest =
    !!order.guestEmail &&
    !!authEmail &&
    order.guestEmail.toLowerCase() === authEmail;
  const hasToken =
    !!order.orderToken && verifyOrderLink(order.orderId, order.orderToken);

  if (isOwner || isGuest || hasToken) {
    return ok({ profileId: auth.ok ? auth.value.profileId : null });
  }

  return err("forbidden");
}
