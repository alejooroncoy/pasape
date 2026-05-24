"use client";

import { use, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Btn, C, Field, FONT_DISPLAY, Phone } from "@/components/design";
import { useBoxByToken, useJoinBox } from "@/lib/boxes/hooks/useBoxes";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { formatDate } from "@/lib/_shared/format";

type Props = { params: Promise<{ token: string }> };

export default function FriendJoinBoxPage({ params }: Props) {
  const { token } = use(params);
  const box = useBoxByToken(token);
  const join = useJoinBox();
  const me = useCurrentUser();
  const router = useRouter();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const name = nameDraft ?? me.data?.user?.fullName ?? "";

  if (box.isLoading) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.dim }}>Cargando…</div>
      </Phone>
    );
  }
  if (box.error || !box.data) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.red }}>Este link de BOX no es válido o expiró.</div>
      </Phone>
    );
  }

  const b = box.data;
  const filled = b.members.length;
  const remaining = b.capacity - filled;
  const alreadyIn = me.data?.user && b.members.some((m) => m.profileId === me.data?.user?.id);
  const myMember = me.data?.user
    ? b.members.find((m) => m.profileId === me.data?.user?.id)
    : null;

  const onJoin = async () => {
    const result = await join.mutateAsync({
      token,
      holderName: name,
      holderDni: dni || null,
    });
    const myT = result.members.find((m) => m.profileId === me.data?.user?.id)?.ticketId;
    if (myT) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/tickets/${myT}` as any);
    }
  };

  return (
    <Phone>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, overflow: "hidden" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.5), transparent 60%)" }} />
          <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 50, background: `linear-gradient(to bottom, transparent, ${C.bg})` }} />
          <div style={{ position: "absolute", top: 16, right: 22, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", fontSize: 12, letterSpacing: "0.1em", fontWeight: 700 }}>
            {b.boxNumber ?? "BOX"} · {filled}/{b.capacity}
          </div>
        </div>
      </div>

      <div style={{ position: "relative", padding: "200px 22px 140px", zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.yellow, fontWeight: 700 }}>★ TE INVITARON</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 6 }}>
          {b.ownerName} te suma a su BOX en
          <br />
          <span style={{ color: C.purple }}>{b.event.title}</span>
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>
          {formatDate(b.event.startsAt, b.event.timezone)} · {b.event.venue ?? ""}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 14,
            background: C.bg2,
            boxShadow: `0 0 0 1px ${C.line} inset`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex" }}>
            {b.members.slice(0, 3).map((m, i) => (
              <div
                key={m.profileId}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: ["#7C3AED", "#1F8A5B", "#FF4D5E"][i % 3],
                  marginLeft: i === 0 ? 0 : -8,
                  boxShadow: `0 0 0 2px ${C.bg2}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 11,
                  color: "#fff",
                }}
              >
                {(m.name[0] ?? "?").toUpperCase()}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1 }}>
            <strong>{b.members.map((m) => m.name.split(" ")[0]).slice(0, 3).join(", ")}</strong> ya están.
            {remaining > 0 && (
              <>
                {" "}Quedan <strong style={{ color: C.yellow }}>{remaining} {remaining === 1 ? "lugar" : "lugares"}</strong>.
              </>
            )}
          </div>
        </div>

        {!alreadyIn && (
          <div style={{ marginTop: 18 }}>
            <Field label="Tu nombre" value={name} onChange={(e) => setNameDraft(e.target.value)} active={name.length > 0} />
            <Field label="DNI" value={dni} onChange={(e) => setDni(e.target.value)} active={dni.length > 0} mono />
          </div>
        )}

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: C.greenSoft,
            boxShadow: "0 0 0 1px rgba(34,209,127,0.3) inset",
            fontSize: 12,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
            marginTop: 8,
          }}
        >
          {alreadyIn ? "Ya estás dentro del BOX" : `No pagas nada · ${b.ownerName} ya pagó el BOX`}
        </div>

        {join.error && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>
            {(join.error as Error).message}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, padding: "0 22px" }}>
        {alreadyIn && myMember?.ticketId ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Btn onClick={() => router.push(`/tickets/${myMember.ticketId}` as any)}>Ver mi QR →</Btn>
        ) : (
          <Btn onClick={onJoin} disabled={join.isPending || !name || remaining <= 0}>
            {join.isPending ? "Sumándote…" : remaining <= 0 ? "BOX completo" : "Sumarme y recibir mi QR"}
          </Btn>
        )}
      </div>
    </Phone>
  );
}
