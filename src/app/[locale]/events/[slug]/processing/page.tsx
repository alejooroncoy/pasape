"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
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
  const tickets = useMyTickets();
  const [startedAt] = useState(() => Date.now());
  const [paid, setPaid] = useState(false);

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
        }>(`/api/tickets/order/${orderId}/status${qs}`);
        if (cancelled) return;
        if (res.status === "paid") {
          setPaid(true);
          await tickets.refetch();
          setTimeout(() => {
            // Para guests usamos ticketUrl firmado (no requiere sesión).
            // Para logueados va a /tickets (su wallet).
            const dest = res.ticketUrl ?? "/tickets";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.replace(dest as any);
          }, 1600);
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
  }, [orderId, guestEmail, router, slug, tickets, paid]);

  useEffect(() => {
    if (orderId) return;
    const id = setInterval(() => void tickets.refetch(), 1500);
    return () => clearInterval(id);
  }, [orderId, tickets]);

  useEffect(() => {
    if (orderId) return;
    if (!tickets.data) return;
    const match = tickets.data
      .filter((t) => t.event.slug === slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (match && new Date(match.createdAt).getTime() >= startedAt - 60_000) {
      router.replace(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `/tickets` as any,
      );
    }
  }, [orderId, tickets.data, slug, router, startedAt]);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `/events/${slug}/pay-error` as any,
      );
    }, 60_000);
    return () => clearTimeout(t);
  }, [router, slug]);

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
            ¡Pago aprobado!
          </h1>
          <p
            className="mt-2 text-[14px] text-cart-ink-2"
            style={{ animation: "pasape-fade-in 420ms ease-out 540ms both" }}
          >
            Llevándote a tu QR…
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
              {payMethod === "mp" ? (
                <svg width="32" height="32" viewBox="0 0 22 22" fill="none" className="text-white">
                  <rect x="2" y="4" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="2" y="7.5" width="18" height="2.5" fill="currentColor" />
                  <rect x="5" y="13" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
                </svg>
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
