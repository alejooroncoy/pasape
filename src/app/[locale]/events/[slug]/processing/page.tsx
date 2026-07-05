"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { api } from "@/lib/_shared/api-client";
import { formatMoney } from "@/lib/_shared/format";

type Props = { params: Promise<{ slug: string }> };

export default function BuyerProcessingPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

function Inner({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("order");
  const guestEmail = search.get("email");
  const payMethod = search.get("method") ?? "yape";
  const { data: eventData } = useEvent(slug);
  const { data: ticketData, refetch: refetchTickets } = useMyTickets();
  const { loggedIn } = useSessionReady();
  const [startedAt] = useState(() => Date.now());
  const [paid, setPaid] = useState(false);
  // Último status visto en el polling. Si al agotar el tiempo sigue 'pending', el
  // pago quedó en revisión (in_process) — no es un error, va a la pantalla amable.
  const lastStatus = useRef<string | null>(null);
  // Delay entre confirmar `paid` y navegar a la orden — le da tiempo al usuario
  // de ver el check de éxito antes de saltar (LOW-10/LOW-20).
  const SUCCESS_NAV_DELAY_MS = 1600;
  const successNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId || paid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const qs = guestEmail ? `?email=${encodeURIComponent(guestEmail)}` : "";
        const res = await api.get<{
          status: string;
          paidAt: string | null;
          ticketUrl: string | null;
          orderUrl: string | null;
        }>(`/api/tickets/order/${orderId}/status${qs}`);
        if (cancelled) return;
        lastStatus.current = res.status;
        if (res.status === "paid") {
          setPaid(true);
          await refetchTickets();
          successNavTimer.current = setTimeout(() => {
            // /order es el único punto de decisión post-pago: reclama la orden
            // (o confirma que ya es tuya — claimOrder es idempotente para el
            // dueño) con el conteo REAL de entradas, y recién ahí bifurca a
            // /done o /tickets/[id]. No se decide acá con datos adivinados.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.replace((res.orderUrl ?? "/tickets") as any);
          }, SUCCESS_NAV_DELAY_MS);
        } else if (res.status === "failed" || res.status === "expired") {
          router.replace(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            `/events/${slug}/pay-error?reason=${res.status}` as any,
          );
        }
      } catch {}
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId, guestEmail, router, slug, refetchTickets, paid, search]);

  // Cleanup del salto a /order SOLO al desmontar de verdad (no en cada re-run
  // del efecto de arriba, que se dispara también cuando `paid` cambia a true
  // — justo cuando este timer recién se armó; cancelarlo ahí rompería la
  // navegación de éxito). LOW-10/LOW-20.
  useEffect(() => {
    return () => {
      if (successNavTimer.current) clearTimeout(successNavTimer.current);
    };
  }, []);

  useEffect(() => {
    if (orderId) return;
    const id = setInterval(() => void refetchTickets(), 1500);
    return () => clearInterval(id);
  }, [orderId, refetchTickets]);

  useEffect(() => {
    if (orderId) return;
    if (!ticketData) return;
    const match = ticketData
      .filter((t) => t.event.slug === slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (match && new Date(match.createdAt).getTime() >= startedAt - 60_000) {
      router.replace(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `/tickets` as any,
      );
    }
  }, [orderId, ticketData, slug, router, startedAt]);

  const PROCESSING_TIMEOUT_MS = 60_000;

  useEffect(() => {
    // Si el pago ya se confirmó (paid=true), NO armar el timeout duro: un
    // pago aprobado en el último instante nunca debe poder disparar
    // pay-error, así este efecto se re-arme por el cambio de `paid`
    // (LOW-10/LOW-20).
    if (paid) return;
    const t = setTimeout(() => {
      if (lastStatus.current === "paid") return;
      // Si el pago sigue en revisión (pending/in_process) a los 60s, no es un
      // error: MP puede tardar. Vamos a la pantalla amable de "en revisión".
      const reason = lastStatus.current === "pending" ? "?reason=in_review" : "";
      router.replace(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `/events/${slug}/pay-error${reason}` as any,
      );
    }, PROCESSING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [router, slug, paid]);

  const summary = useMemo(() => {
    if (!eventData) return null;
    const totalStr = search.get("total");
    const totalCents = totalStr ? parseInt(totalStr, 10) : eventData.ticketTypes[0]?.priceCents;
    return {
      title: eventData.event.title,
      price: totalCents === 0 ? "Gratis" : totalCents != null ? formatMoney(totalCents) : null,
    };
  }, [eventData, search]);

  return (
    <div className="grid min-h-dvh place-items-center bg-cart-bg px-6 text-center text-white">
      <style>{`
        @keyframes pasape-spin { to { transform: rotate(360deg); } }
        @keyframes pasape-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pasape-check {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes pasape-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pasape-pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,209,127,0.55), 0 0 60px rgba(34,209,127,0.55); }
          50% { box-shadow: 0 0 0 22px rgba(34,209,127,0), 0 0 80px rgba(34,209,127,0.65); }
        }
      `}</style>

      {paid ? (
        <div className="flex max-w-[420px] flex-col items-center">
          <div
            className="grid size-[140px] place-items-center rounded-full"
            style={{
              background: "linear-gradient(180deg, #22D17F, #16A35F)",
              animation:
                "pasape-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1), pasape-pulse-green 1.6s ease-out 420ms",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path
                d="M16 33l11 11 21-25"
                stroke="#fff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="60"
                style={{
                  animation: "pasape-check 520ms ease-out 240ms forwards",
                  strokeDashoffset: 60,
                }}
              />
            </svg>
          </div>
          <h1
            className="mt-8 text-[28px] font-bold tracking-[-0.02em]"
            style={{ animation: "pasape-fade-in 420ms ease-out 360ms both" }}
          >
            {summary?.price === "Gratis" ? "¡Entrada confirmada!" : "¡Pago aprobado!"}
          </h1>
          <p
            className="mt-2 text-[14px] text-cart-ink-2"
            style={{ animation: "pasape-fade-in 420ms ease-out 540ms both" }}
          >
            {loggedIn ? "Llevándote a tu QR…" : "Ya casi. Entra con tu cuenta para guardarlas…"}
          </p>
        </div>
      ) : (
        <div className="flex max-w-[420px] flex-col items-center">
          <div className="relative size-[140px]">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent, var(--color-cart-accent))",
                animation: "pasape-spin 1.4s linear infinite",
                WebkitMask:
                  "radial-gradient(closest-side, transparent calc(50% - 4px), #000 calc(50% - 3px))",
                mask: "radial-gradient(closest-side, transparent calc(50% - 4px), #000 calc(50% - 3px))",
                filter: "drop-shadow(0 0 12px var(--color-cart-accent-glow))",
              }}
            />
            <div className="absolute inset-[20px] grid place-items-center rounded-full border border-cart-line bg-cart-bg-elev">
              {summary?.price === "Gratis" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/icons/logo-mark.svg"
                  alt="Pasape"
                  width={48}
                  height={48}
                />
              ) : payMethod === "mp" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/brand/mercadopago.svg"
                  alt="Mercado Pago"
                  width={48}
                  height={48}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/brand/yape.png"
                  alt="Yape"
                  width={64}
                  height={64}
                  className="rounded-xl"
                />
              )}
            </div>
          </div>
          <h1 className="mt-8 text-[22px] font-bold tracking-[-0.02em]">
            {summary?.price === "Gratis" ? "Confirmando entrada…" : "Procesando tu pago…"}
          </h1>
          <p className="mt-2 text-[14px] leading-[1.5] text-cart-ink-2">
            No cierres esta ventana.
            <br />
            Tu QR llega en segundos.
          </p>
          {summary && (
            <div className="mt-7 rounded-full bg-cart-bg-elev px-4 py-2 font-mono text-[12px] text-cart-ink-3">
              {summary.price ? `${summary.price} · ` : ""}
              {summary.title}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
