"use client";

import { C, FONT_DISPLAY, FONT_MONO, LiveDot, Phone, ProfileMenu, TopBar } from "@/components/design";
import { useMyPromoterLinks, usePromoterHome } from "@/lib/promoters/hooks/usePromoter";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useState } from "react";

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="6" y="6" width="11" height="11" rx="2.5" stroke={C.purple} strokeWidth="1.6" />
    <path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H6" stroke={C.purple} strokeWidth="1.6" />
  </svg>
);

const WspIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path
      d="M9 1.5C4.86 1.5 1.5 4.86 1.5 9c0 1.43.4 2.77 1.1 3.9L1.5 16.5l3.74-1.05A7.4 7.4 0 0 0 9 16.5c4.14 0 7.5-3.36 7.5-7.5S13.14 1.5 9 1.5Zm0 13.5c-1.18 0-2.3-.31-3.27-.86l-.23-.13-2.22.62.63-2.17-.15-.24A6 6 0 1 1 15 9a6 6 0 0 1-6 6Z"
      fill="#0A0A0F"
    />
  </svg>
);

const buildShareUrl = (code: string) =>
  typeof window === "undefined" ? `/r/${code}` : `${window.location.origin}/r/${code}`;

export default function PromoHomePage() {
  const me = useCurrentUser();
  const links = useMyPromoterLinks();
  const first = links.data?.[0];
  const home = usePromoterHome(first?.eventSlug ?? "");
  const [copied, setCopied] = useState(false);

  const firstName = me.data?.user?.fullName?.split(" ")[0] ?? "Promotor";
  const initial = (firstName[0] ?? "·").toUpperCase();

  if (links.isLoading) {
    return (
      <Phone>
        <TopBar hello="Hola" title="Tu noche" />
        <div style={{ padding: 28, color: C.dim }}>Cargando…</div>
      </Phone>
    );
  }

  if (!first) {
    return (
      <Phone>
        <TopBar hello={`Hola, ${firstName}`} title="Tu noche" right={<ProfileMenu initials={initial} color="#1F8A5B" />} />
        <div style={{ padding: "0 22px" }}>
          <div
            style={{
              padding: "20px 18px",
              borderRadius: 22,
              background: C.bg2,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              color: C.dim,
              lineHeight: 1.5,
            }}
          >
            Aún no eres promotor de ningún evento. Pídele a un organizador que te apruebe.
          </div>
        </div>
      </Phone>
    );
  }

  const url = buildShareUrl(first.code);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const onWhatsApp = () => {
    const msg = encodeURIComponent(`Sumate a ${first.eventTitle}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const sold = home.data?.soldCount ?? 0;
  const goal = 100;
  const pct = Math.min(100, Math.round((sold / goal) * 100));
  const recent = home.data?.recent.slice(0, 3) ?? [];

  return (
    <Phone>
      <TopBar
        hello={`Hola, ${firstName}`}
        title="Tu noche"
        right={<ProfileMenu initials={initial} color="#1F8A5B" />}
      />
      <div style={{ padding: "0 22px" }}>
        <div
          style={{
            borderRadius: 24,
            padding: 18,
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(124,58,237,0.22), rgba(20,12,40,0.4))",
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset, 0 30px 60px -30px rgba(124,58,237,0.55)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, letterSpacing: "0.06em", color: C.dim }}>
              TU LINK · {first.eventTitle.toUpperCase()}
            </span>
            <LiveDot />
          </div>
          <button
            type="button"
            onClick={onCopy}
            style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 16,
              padding: "16px 16px",
              fontFamily: FONT_MONO,
              fontSize: 15,
              fontWeight: 600,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              color: "#fff",
              border: 0,
              cursor: "pointer",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {copied ? "¡copiado!" : url.replace(/^https?:\/\//, "")}
            </span>
            <CopyIcon />
          </button>
          <button
            type="button"
            onClick={onWhatsApp}
            style={{
              marginTop: 12,
              height: 54,
              width: "100%",
              border: 0,
              borderRadius: 16,
              background: "#fff",
              color: "#0A0A0F",
              fontFamily: FONT_DISPLAY,
              fontSize: 15,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 12px 28px -8px rgba(255,255,255,0.2)",
              cursor: "pointer",
            }}
          >
            <WspIcon /> Compartir por WhatsApp
          </button>
        </div>

        <div style={{ marginTop: 16, padding: "20px 18px", borderRadius: 22, background: C.bg2, boxShadow: `0 0 0 1px ${C.line} inset` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.9 }}>
              {sold}
            </div>
            <div style={{ fontSize: 13, color: C.dim }}>vendidas con tu link</div>
          </div>
          <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg, #7C3AED, #B084FF)",
                boxShadow: "0 0 14px rgba(124,58,237,0.6)",
              }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: C.dim }}>
            Comisión {first.commissionPct}% por entrada vendida
          </div>

          {recent.map((r) => (
            <div
              key={r.createdAt}
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 12,
                background: C.greenSoft,
                boxShadow: "0 0 0 1px rgba(34,209,127,0.3) inset",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: C.green,
                  boxShadow: `0 0 10px ${C.green}`,
                }}
              />
              <span style={{ fontSize: 13 }}>
                <strong>{r.firstName}</strong> compró
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
                {new Date(r.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}
