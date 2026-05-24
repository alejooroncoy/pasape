"use client";

import { use } from "react";
import { Btn, C, CloseBtn, FONT_DISPLAY, Phone } from "@/components/design";
import { useEventIncentives } from "@/lib/promoters/incentives/hooks/useIncentives";

type Props = { params: Promise<{ slug: string; id: string }> };

export default function PromoIncentiveUnlockedPage({ params }: Props) {
  const { slug, id } = use(params);
  const incentives = useEventIncentives(slug);
  const inc = incentives.data?.find((i) => i.id === id);

  return (
    <Phone>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 50% at 50% 30%, rgba(124,58,237,0.45), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(50% 40% at 50% 70%, rgba(124,58,237,0.25), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[
          ["12%", "18%", C.purple, 0],
          ["82%", "22%", C.yellow, 0.2],
          ["20%", "78%", C.green, 0.5],
          ["86%", "70%", C.red, 0.3],
          ["50%", "12%", "#fff", 0.7],
          ["72%", "86%", C.purple, 0.4],
          ["28%", "40%", C.yellow, 0.6],
          ["76%", "46%", "#fff", 0.1],
        ].map(([l, t, c, d], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: l as string,
              top: t as string,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: c as string,
              boxShadow: `0 0 12px ${c}`,
              animation: "pulse 1.6s ease-in-out infinite",
              animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>

      <div style={{ padding: "6px 22px 0", display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
        <CloseBtn href={`/promo/${slug}/incentives`} />
      </div>

      <div style={{ position: "relative", padding: "20px 22px", flex: 1, display: "flex", flexDirection: "column", zIndex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", alignItems: "center" }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 36,
              background: "linear-gradient(135deg, #B084FF, #7C3AED 60%, #4B1F9A)",
              boxShadow: "0 30px 70px -10px rgba(124,58,237,0.8), 0 0 0 6px rgba(124,58,237,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
            }}
          >
            🍾
          </div>

          <div style={{ fontSize: 12, letterSpacing: "0.18em", color: C.purple, fontWeight: 700, marginTop: 26 }}>
            ◆ ¡DESBLOQUEADO!
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95, marginTop: 10 }}>
            Ganaste tu<br />
            <span style={{ color: C.purple }}>{inc?.reward ?? "premio"}</span> 🎉
          </div>
          <div style={{ fontSize: 14, color: C.dim, marginTop: 12, lineHeight: 1.5, maxWidth: 280 }}>
            Vendiste {inc?.goalValue ?? 0} entradas. Recógela donde el organizador esta noche en puerta.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 16 }}>
          <Btn onClick={() => history.back()}>Ver mi siguiente meta →</Btn>
          <Btn kind="secondary">Compartir mi logro</Btn>
        </div>
      </div>
    </Phone>
  );
}
