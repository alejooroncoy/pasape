"use client";

import { use } from "react";
import { BackBtn, C, FONT_DISPLAY, FONT_MONO, Phone, ProfileMenu, QrSquare, TopBar } from "@/components/design";
import { useBoxForTicket, useRealtimeBox } from "@/lib/boxes/hooks/useBoxes";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

type Props = { params: Promise<{ id: string }> };

const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}`, display: "inline-block" }} />
);

export default function BuyerMyBoxPage({ params }: Props) {
  const { id } = use(params);
  const box = useBoxForTicket(id);
  useRealtimeBox(box.data?.inviteToken);
  const me = useCurrentUser();

  if (box.isLoading) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.dim }}>Cargando BOX…</div>
      </Phone>
    );
  }
  if (!box.data) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.dim }}>Aún no tienes BOX para este ticket.</div>
      </Phone>
    );
  }
  const b = box.data;
  const myMember = me.data?.user ? b.members.find((m) => m.profileId === me.data?.user?.id) : null;
  const others = b.members.filter((m) => m.profileId !== myMember?.profileId);
  const initial = (me.data?.user?.fullName ?? "·")[0]?.toUpperCase() ?? "·";

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ width: 38 }} />
        <ProfileMenu initials={initial} color="#FF4D5E" />
      </div>
      <TopBar hello="Tu BOX" title={b.event.title} />
      <div style={{ padding: "0 22px 32px" }}>
        <div
          style={{
            borderRadius: 24,
            padding: 20,
            background: "linear-gradient(180deg, rgba(255,206,59,0.16), rgba(20,12,40,0.5))",
            boxShadow: "0 0 0 1px rgba(255,206,59,0.4) inset, 0 30px 60px -20px rgba(255,206,59,0.25)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 999,
                background: C.yellow,
                color: "#1a1200",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              TU QR · {b.ticketTypeName.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
              #{b.id.slice(0, 6).toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 110, height: 110, background: "#fff", borderRadius: 16, padding: 6, flexShrink: 0 }}>
              <QrSquare code={myMember?.ticketId ?? id} size={94} />
            </div>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {me.data?.user?.fullName ?? "—"}
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Cabeza del BOX</div>
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: C.purpleSoft,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.purple,
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Dot color={C.purple} /> ROTA C/ 10s
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.08em", fontWeight: 600 }}>
            TU CREW ({others.length}/{b.capacity - 1})
          </div>
        </div>
        {others.map((m) => (
          <div
            key={m.profileId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              background: C.bg2,
              borderRadius: 14,
              boxShadow: `0 0 0 1px ${C.line} inset`,
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", padding: 4 }}>
              <QrSquare code={m.ticketId ?? m.profileId} size={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
                #{(m.ticketId ?? m.profileId).slice(0, 6).toUpperCase()}
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                padding: "4px 8px",
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: "0.04em",
                background: C.greenSoft,
                color: C.green,
              }}
            >
              LISTO
            </div>
          </div>
        ))}
        {others.length === 0 && (
          <div style={{ padding: 16, color: C.dim }}>Aún no se sumó nadie. Compartí el link.</div>
        )}
      </div>
    </Phone>
  );
}
