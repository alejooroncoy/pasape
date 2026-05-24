"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
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
  const { data: eventData } = useEvent(slug);
  const tickets = useMyTickets();
  const [startedAt] = useState(() => Date.now());
  const [paid, setPaid] = useState(false);

  // Poll the order status endpoint. When `paid`, mostramos animación de éxito
  // por ~1.6s y después redirect a /tickets.
  useEffect(() => {
    if (!orderId || paid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const qs = guestEmail ? `?email=${encodeURIComponent(guestEmail)}` : "";
        const res = await api.get<{ status: string; paidAt: string | null }>(
          `/api/tickets/order/${orderId}/status${qs}`,
        );
        if (cancelled) return;
        if (res.status === "paid") {
          setPaid(true);
          await tickets.refetch();
          setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.replace("/tickets" as any);
          }, 1600);
        } else if (res.status === "failed" || res.status === "expired") {
          router.replace(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            `/events/${slug}/pay-error?reason=${res.status}` as any,
          );
        }
      } catch {
        // keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId, guestEmail, router, slug, tickets, paid]);

  // Fallback path when no orderId — preserve old behavior of polling tickets.
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
        `/tickets/${match.id}` as any,
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
    const min = eventData.ticketTypes[0]?.priceCents;
    return {
      title: eventData.event.title,
      price: min != null ? formatMoney(min) : null,
    };
  }, [eventData]);

  return (
    <Phone>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
        @keyframes pasape-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,209,127,0.55), 0 0 60px rgba(34,209,127,0.55); }
          50% { box-shadow: 0 0 0 22px rgba(34,209,127,0), 0 0 80px rgba(34,209,127,0.65); }
        }
      `}</style>
      <div
        style={{
          flex: 1,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "100dvh",
        }}
      >
        {paid ? (
          <>
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 999,
                background: "linear-gradient(180deg, #22D17F, #16A35F)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pasape-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1), pasape-pulse 1.6s ease-out 420ms",
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
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                marginTop: 32,
                animation: "pasape-fade-in 420ms ease-out 360ms both",
              }}
            >
              ¡Pago aprobado!
            </div>
            <div
              style={{
                fontSize: 14,
                color: C.dim,
                marginTop: 8,
                lineHeight: 1.5,
                animation: "pasape-fade-in 420ms ease-out 540ms both",
              }}
            >
              Llevándote a tu QR…
            </div>
          </>
        ) : (
          <>
            <div style={{ position: "relative", width: 140, height: 140 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: `conic-gradient(from 0deg, transparent, ${C.purple})`,
                  animation: "spin 1.4s linear infinite",
                  WebkitMask:
                    "radial-gradient(closest-side, transparent calc(50% - 4px), #000 calc(50% - 3px))",
                  mask: "radial-gradient(closest-side, transparent calc(50% - 4px), #000 calc(50% - 3px))",
                  filter: `drop-shadow(0 0 12px ${C.purple})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 20,
                  borderRadius: 999,
                  background: C.bg2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/yape.png"
                  alt="Yape"
                  width={64}
                  height={64}
                  style={{ borderRadius: 12 }}
                />
              </div>
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginTop: 30,
              }}
            >
              Procesando tu pago...
            </div>
            <div style={{ fontSize: 14, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
              No cierres esta ventana.
              <br />
              Tu QR llega en segundos.
            </div>
            {summary && (
              <div
                style={{
                  marginTop: 28,
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  fontSize: 12,
                  color: C.dim,
                  fontFamily: FONT_MONO,
                }}
              >
                {summary.price ? `${summary.price} · ` : ""}
                {summary.title}
              </div>
            )}
          </>
        )}
      </div>
    </Phone>
  );
}
