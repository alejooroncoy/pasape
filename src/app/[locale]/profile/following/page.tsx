"use client";

import { BackBtn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useFollowing } from "@/lib/identity/hooks/useFollowing";
import type { FollowedOrg } from "@/server/identity/application/ListFollows";

const palette: Array<[string, string]> = [
  ["#4B1F9A", "#FF4D5E"],
  ["#22D17F", "#7C3AED"],
  ["#FFCE3B", "#FF4D5E"],
  ["#7C3AED", "#22D17F"],
  ["#FF4D5E", "#7C3AED"],
];

const colorsFor = (slug: string, fallback: string | null): [string, string] => {
  if (fallback) return [fallback, "#7C3AED"];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

const FollowRow = ({ org }: { org: FollowedOrg }) => {
  const [c1, c2] = colorsFor(org.slug, org.brandColor);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        marginBottom: 8,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 14,
        boxShadow: `0 0 0 1px ${C.line} inset`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${c1}, ${c2})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "-0.02em",
          color: "#fff",
        }}
      >
        {org.name[0]?.toUpperCase() ?? "·"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>{org.name}</div>
        <div style={{ fontSize: 11, color: C.dim }}>@{org.slug}</div>
      </div>
      <button
        type="button"
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: 0,
          background: "rgba(255,255,255,0.06)",
          color: C.dim,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
      >
        SIGUIENDO
      </button>
    </div>
  );
};

export default function BuyerFollowingPage() {
  const { data, isLoading, error } = useFollowing();
  const items = data ?? [];

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>SIGUES</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "14px 22px" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Tus crews favoritas.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>
          Te avisamos cuando lancen algo nuevo.
        </div>

        {isLoading && <div style={{ marginTop: 22, color: C.dim }}>Cargando…</div>}
        {error && <div style={{ marginTop: 22, color: C.red }}>{(error as Error).message}</div>}

        {!isLoading && !error && items.length === 0 && (
          <div
            style={{
              marginTop: 22,
              padding: 22,
              borderRadius: 14,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              background: "rgba(255,255,255,0.02)",
              color: C.dim,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Aún no sigues a ningún organizador.
          </div>
        )}

        {items.length > 0 && (
          <div style={{ marginTop: 22 }}>
            {items.map((org) => (
              <FollowRow key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </Phone>
  );
}
