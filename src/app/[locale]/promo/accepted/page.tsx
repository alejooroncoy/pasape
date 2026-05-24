"use client";

import { Btn, C, CloseBtn, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useMyPromoterLinks } from "@/lib/promoters/hooks/usePromoter";
import { useRouter } from "@/i18n/navigation";

export default function PromoAcceptedCelebratePage() {
  const links = useMyPromoterLinks();
  const first = links.data?.[0];
  const router = useRouter();
  const origin = typeof window === "undefined" ? "" : window.location.origin.replace(/^https?:\/\//, "");

  return (
    <Phone>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 50% at 50% 30%, rgba(124,58,237,0.45), transparent 70%)", pointerEvents: "none" }} />
      {[
        ["12%", "18%", C.purple, 0],
        ["82%", "22%", C.green, 0.2],
        ["18%", "72%", C.yellow, 0.5],
        ["82%", "68%", C.red, 0.3],
        ["50%", "12%", "#fff", 0.6],
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

      <div style={{ position: "relative", padding: 22, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <CloseBtn href="/promo" />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 32,
              background: "linear-gradient(135deg, #B084FF, #7C3AED 60%, #4B1F9A)",
              boxShadow: "0 30px 60px -10px rgba(124,58,237,0.7), 0 0 0 6px rgba(124,58,237,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48">
              <path d="M10 24l10 10L38 14" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <div style={{ fontSize: 11, letterSpacing: "0.18em", color: C.purple, fontWeight: 700, marginTop: 26 }}>
            ◆ ESTÁS DENTRO
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95, marginTop: 10 }}>
            ¡Te aprobaron!
          </div>
          {first && (
            <div style={{ fontSize: 14, color: C.dim, marginTop: 14, lineHeight: 1.5, maxWidth: 280 }}>
              Ya eres promotor oficial de <strong style={{ color: "#fff" }}>{first.eventTitle}</strong>.
            </div>
          )}

          {first && (
            <div
              style={{
                marginTop: 22,
                padding: "14px 18px",
                borderRadius: 16,
                background: "rgba(0,0,0,0.4)",
                boxShadow: `0 0 0 1px ${C.line} inset`,
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {origin}/r/<span style={{ color: C.purple }}>{first.code}</span>
            </div>
          )}
        </div>

        <div style={{ paddingBottom: 16 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Btn onClick={() => router.push("/promo" as any)}>Ver mi panel de promotor →</Btn>
        </div>
      </div>
    </Phone>
  );
}
