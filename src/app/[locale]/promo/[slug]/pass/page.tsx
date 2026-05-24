"use client";

import { use } from "react";
import { BackBtn, C, FONT_DISPLAY, Phone, QrSquare } from "@/components/design";
import { usePromoterHome } from "@/lib/promoters/hooks/usePromoter";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { formatDate } from "@/lib/_shared/format";

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14">
    <path d="M2 7.5L5.5 11 12 3" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

type Props = { params: Promise<{ slug: string }> };

export default function PromoPassPage({ params }: Props) {
  const { slug } = use(params);
  const home = usePromoterHome(slug);
  const me = useCurrentUser();

  const fullName = me.data?.user?.fullName ?? "Promotor";
  const [first, ...rest] = fullName.split(" ");
  const last = rest.join(" ");

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>TU PASE</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "8px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            flex: 1,
            marginTop: 6,
            borderRadius: 28,
            padding: 24,
            background: "linear-gradient(180deg, rgba(124,58,237,0.32), rgba(20,12,40,0.6))",
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset, 0 30px 60px -20px rgba(124,58,237,0.55)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(100% 60% at 50% 0%, rgba(160,120,255,0.4), transparent 60%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "rgba(255,255,255,0.7)" }}>
              PROMOTOR{home.data ? ` · ${formatDate(home.data.link.eventStartsAt, "America/Lima").toUpperCase()}` : ""}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 8 }}>
              {first}
              {last && <><br />{last}</>}
            </div>
            <div style={{ marginTop: 14, fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600 }}>
              {home.data?.link.eventTitle ?? "—"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {home.data?.link.eventVenue ?? ""}
            </div>

            <div
              style={{
                marginTop: 22,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: C.greenSoft,
                boxShadow: "0 0 0 1px rgba(34,209,127,0.4) inset",
              }}
            >
              <Check />
              <span style={{ fontWeight: 600, fontSize: 14, color: C.green }}>Promotor confirmado</span>
            </div>

            <div style={{ marginTop: 28, padding: 20, borderRadius: 22, background: "rgba(255,255,255,0.96)", display: "flex", justifyContent: "center" }}>
              <QrSquare code={home.data?.link.code ?? slug} size={180} />
            </div>
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              Muéstralo en puerta para entrar gratis
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}
