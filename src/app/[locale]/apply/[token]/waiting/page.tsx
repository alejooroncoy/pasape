"use client";

import { use, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { C, CloseBtn, FONT_BODY, FONT_DISPLAY, Phone } from "@/components/design";
import { useResolveInvite, useApplicationStatus } from "@/lib/promoters/hooks/usePromoter";

const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}`, display: "inline-block" }} />
);

type Props = { params: Promise<{ token: string }> };

export default function PromoAppliedWaitingPage({ params }: Props) {
  const { token } = use(params);
  const resolved = useResolveInvite(token);
  const status = useApplicationStatus(resolved.data?.eventSlug ?? "");
  const router = useRouter();

  useEffect(() => {
    if (status.data?.status === "approved") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace("/promo/accepted" as any);
    }
  }, [status.data?.status, router]);

  return (
    <Phone>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 50% at 50% 30%, rgba(255,206,59,0.18), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", padding: 22, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <CloseBtn href="/" />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 36,
              background: "linear-gradient(135deg, #FFCE3B, #FF9B3B)",
              boxShadow: "0 30px 60px -10px rgba(255,206,59,0.5), 0 0 0 6px rgba(255,206,59,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "#1a1200",
                  animation: "pulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 11, letterSpacing: "0.18em", color: C.yellow, fontWeight: 700, marginTop: 26 }}>
            ◆ EN ESPERA
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95, marginTop: 10 }}>
            Tu solicitud<br />ya está en revisión.
          </div>
          <div style={{ fontSize: 14, color: C.dim, marginTop: 14, lineHeight: 1.5, maxWidth: 280 }}>
            En cuanto te aprueben, te llega un mensaje al WhatsApp con tu link único de venta.
          </div>

          <div
            style={{
              marginTop: 26,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: C.dim,
            }}
          >
            <Dot color={C.yellow} /> Suele responder en 1-2 horas
          </div>
        </div>

        <button
          type="button"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => router.push("/" as any)}
          style={{
            background: "transparent",
            border: 0,
            color: C.dim,
            fontFamily: FONT_BODY,
            fontSize: 13,
            paddingBottom: 16,
            cursor: "pointer",
          }}
        >
          Volver a inicio
        </button>
      </div>
    </Phone>
  );
}
