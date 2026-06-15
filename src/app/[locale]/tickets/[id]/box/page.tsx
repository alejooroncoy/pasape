"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BackBtn, C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useBoxForTicket, useCreateBox, useRealtimeBox } from "@/lib/boxes/hooks/useBoxes";

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
      fill="#062315"
    />
  </svg>
);

const Seat = ({ name, you, empty }: { name?: string; you?: boolean; empty?: boolean }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        background: empty ? "transparent" : you ? C.purple : "rgba(255,255,255,0.08)",
        boxShadow: empty ? "0 0 0 1.5px rgba(255,255,255,0.15) inset" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 16,
        color: empty ? C.dimmer : "#fff",
        position: "relative",
      }}
    >
      {empty ? "+" : (name?.[0] || "?").toUpperCase()}
      {you && (
        <div
          style={{
            position: "absolute",
            bottom: -3,
            right: -3,
            fontSize: 8,
            padding: "1px 4px",
            borderRadius: 999,
            background: "#fff",
            color: "#000",
            fontWeight: 700,
          }}
        >
          TÚ
        </div>
      )}
    </div>
    <div style={{ fontSize: 10, color: empty ? C.dimmer : C.dim, fontWeight: 500, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {empty ? "libre" : name}
    </div>
  </div>
);

type Props = { params: Promise<{ id: string }> };

export default function BuyerBoxInvitePage({ params }: Props) {
  const { id } = use(params);
  const boxQuery = useBoxForTicket(id);
  useRealtimeBox(boxQuery.data?.inviteToken);
  const create = useCreateBox();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (boxQuery.data === null && !create.isPending && !create.data) {
      create.mutate({ ticketId: id, capacity: 6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxQuery.data, id]);

  const box = boxQuery.data ?? create.data;
  if (!box) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.dim }}>Preparando tu BOX…</div>
      </Phone>
    );
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/box/${box.inviteToken}`;
  const filled = box.members.length;
  const remaining = box.capacity - filled;
  const me = box.members[0];

  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const onWhatsApp = () => {
    const msg = encodeURIComponent(`Sumate a mi BOX en ${box.event.title}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 13, color: "#fff", letterSpacing: "0.06em", fontWeight: 700 }}>
          {box.boxNumber ?? "TU BOX"} <span style={{ color: C.dim, fontWeight: 500 }}>· {filled}/{box.capacity}</span>
        </div>
        <Link href={`/tickets/${id}/box/members`} style={{ fontSize: 11, color: C.purple, fontWeight: 700 }}>
          VER QRS →
        </Link>
      </div>
      <div style={{ padding: "14px 22px 32px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Compartí el link.
          <br />
          Cada uno se suma solo.
        </div>

        <div
          style={{
            marginTop: 22,
            padding: 18,
            borderRadius: 22,
            background: "linear-gradient(180deg, rgba(255,206,59,0.18), rgba(20,12,40,0.4))",
            boxShadow: "0 0 0 1.5px rgba(255,206,59,0.4) inset, 0 20px 60px -20px rgba(255,206,59,0.3)",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.yellow, fontWeight: 700, marginBottom: 12 }}>
            ◆ LINK DE TU BOX
          </div>
          <button
            type="button"
            onClick={onCopy}
            style={{
              background: "rgba(0,0,0,0.45)",
              borderRadius: 14,
              padding: "14px 16px",
              fontFamily: FONT_MONO,
              fontSize: 14,
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
              marginTop: 10,
              height: 50,
              width: "100%",
              border: 0,
              borderRadius: 14,
              background: "#25D366",
              color: "#062315",
              fontFamily: FONT_DISPLAY,
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <WspIcon /> Mandar al grupo de WhatsApp
          </button>
        </div>

        <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.06em" }}>YA SE SUMARON</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 2 }}>
              {filled} <span style={{ color: C.dim, fontSize: 16, fontWeight: 500 }}>/ {box.capacity}</span>
            </div>
          </div>
          {remaining > 0 && (
            <div
              style={{
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 999,
                background: C.yellowSoft,
                color: C.yellow,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {remaining} {remaining === 1 ? "LUGAR LIBRE" : "LUGARES LIBRES"}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
          }}
        >
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
            {box.members.map((m) => (
              <Seat key={m.profileId} name={m.name} you={m.profileId === me?.profileId} />
            ))}
            {Array.from({ length: remaining }).map((_, i) => (
              <Seat key={`empty-${i}`} empty />
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 12,
            background: C.purpleSoft,
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
            fontSize: 12,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
          }}
        >
          Cada uno entra al link, pone su nombre y DNI, y recibe su propio QR.
        </div>
      </div>
    </Phone>
  );
}
