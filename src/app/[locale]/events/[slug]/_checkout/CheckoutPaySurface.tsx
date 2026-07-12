"use client";

// Superficie de PAGO reutilizable, sin `useEvent` — renderiza de inmediato
// (restaura la orden desde la sesión sellada + estado, no necesita el fetch del
// evento). La usa el overlay del intercept (@modal/(.)buy) creciendo sobre el
// evento. La ruta completa /buy sigue usando su PayPhase interno (sin cambios),
// así no hay ciclo de imports ni regresión en el hard-nav.
//
// Reusa los MISMOS componentes de pago que /buy (PayPhase + reserva) exportados
// desde buy/page.tsx — cero duplicación de la UI/lógica de cobro.

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import {
  checkoutSessionKey,
  openCheckoutSession,
} from "@/lib/_shared/checkoutSessionStorage";
import {
  clearOrderToken,
  persistOrderToken,
  processingQuery,
  readOrderToken,
} from "@/lib/tickets/orderTokenStorage";
import { PayPhase, ReservationCountdown, ReservationExpiredModal } from "../buy/page";

// Debe coincidir con RESERVATION_MS de buy/page.tsx (y el cron del backend).
const RESERVATION_MS = 30 * 60 * 1000;

type Restored = {
  payMethod?: "yape" | "mp";
  guestEmail?: string;
  guestName?: string;
  guestDni?: string;
  guestPhone?: string;
  orderToken?: string;
  reservedAt?: number;
  totalCents?: number;
};

export function CheckoutPaySurface({
  slug,
  orderId,
  orderToken: tokenProp,
  onPaid,
  onExpiredRetry,
}: {
  slug: string;
  orderId: string;
  orderToken?: string | null;
  /** Default: limpia la sesión y va a /processing. */
  onPaid?: () => void;
  /** Retry desde el modal de reserva vencida. Default: vuelve al evento. */
  onExpiredRetry?: () => void;
}) {
  const router = useRouter();
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;

  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [payMethod, setPayMethod] = useState<"yape" | "mp">("yape");
  const [orderToken, setOrderToken] = useState<string | null>(tokenProp ?? null);
  const [reservedAt, setReservedAt] = useState<number | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestDni, setGuestDni] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const goProcessing = (token: string | null) => {
    try {
      sessionStorage.removeItem(checkoutSessionKey(orderId));
    } catch {}
    router.push(`/events/${slug}/processing?${processingQuery(orderId, token)}` as never);
  };

  // Restaura la orden: sesión sellada → identidad/método/total/reserva, luego
  // verifica estado con el server. Fork acotado del resume de buy/page.tsx: acá
  // "expirado" solo muestra el modal (no re-arma carrito ni toca useEvent).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem(checkoutSessionKey(orderId))
          : null;
      const restored = raw
        ? ((await openCheckoutSession(orderId, raw)) as Restored | null)
        : null;

      const token = restored?.orderToken ?? tokenProp ?? readOrderToken(orderId) ?? null;
      if (token) persistOrderToken(orderId, token);

      let status: string | null = null;
      let orderTotal: number | null = null;
      if (token) {
        try {
          const res = await fetch(
            `/api/tickets/order/${orderId}/status?k=${encodeURIComponent(token)}`,
          );
          if (res.ok) {
            const json = (await res.json()) as {
              data?: { status?: string; totalCents?: number };
            };
            status = json.data?.status ?? null;
            orderTotal = json.data?.totalCents ?? null;
          }
        } catch {}
      }
      if (cancelled) return;

      if (status === "paid") {
        if (onPaid) onPaid();
        else goProcessing(token);
        return;
      }

      const reservedAtMs = restored?.reservedAt ?? null;
      const expiredByTime =
        reservedAtMs != null && Date.now() >= reservedAtMs + RESERVATION_MS;
      const isExpired =
        status === "expired" ||
        status === "failed" ||
        expiredByTime ||
        !token ||
        reservedAtMs == null;

      setPayMethod(restored?.payMethod ?? "yape");
      setGuestName(restored?.guestName ?? "");
      setGuestEmail(restored?.guestEmail ?? "");
      setGuestDni(restored?.guestDni ?? "");
      setGuestPhone(restored?.guestPhone ?? "");
      setOrderToken(token);
      setTotalCents(restored?.totalCents ?? orderTotal ?? 0);
      setReservedAt(reservedAtMs);

      if (isExpired) {
        clearOrderToken(orderId);
        setExpired(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!ready) {
    return (
      <p className="py-10 text-center text-[13px] text-cart-ink-3">Preparando el pago…</p>
    );
  }

  if (expired) {
    return (
      <ReservationExpiredModal
        onRetry={onExpiredRetry ?? (() => router.push(`/events/${slug}` as never))}
        onCancel={() => router.push(`/events/${slug}` as never)}
      />
    );
  }

  const emailOk = /.+@.+\..+/.test(guestEmail.trim());
  const u = me.data?.user;

  return (
    <>
      {reservedAt != null && <ReservationCountdown reservedAt={reservedAt} />}
      <PayPhase
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        orderId={orderId}
        orderToken={orderToken}
        slug={slug}
        totalCents={totalCents}
        isLogged={isLogged}
        userPhone={u?.phone ?? ""}
        userName={u?.fullName ?? ""}
        userEmail={u?.email ?? ""}
        guestName={guestName}
        guestPhone={guestPhone}
        guestEmail={guestEmail}
        setGuestEmail={setGuestEmail}
        guestDni={guestDni}
        emailOk={emailOk}
        onPaid={onPaid ?? (() => goProcessing(orderToken))}
        onExpired={() => setExpired(true)}
      />
    </>
  );
}
