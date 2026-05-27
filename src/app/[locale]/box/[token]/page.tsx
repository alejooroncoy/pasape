"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Btn, C, Field, FONT_DISPLAY, PhoneField } from "@/components/design";
import { useBoxByToken, useJoinBox } from "@/lib/boxes/hooks/useBoxes";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useDniLookup } from "@/lib/identity/hooks/useDniLookup";
import { formatDate } from "@/lib/_shared/format";

type Props = { params: Promise<{ token: string }> };

export default function FriendJoinBoxPage({ params }: Props) {
  const { token } = use(params);
  const box = useBoxByToken(token);
  const join = useJoinBox();
  const me = useCurrentUser();
  const router = useRouter();

  const [dni, setDni] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const nameTouchedRef = useRef(false);
  const { lookup: dniLookup, pending: dniPending } = useDniLookup();
  const [dniHint, setDniHint] = useState<"idle" | "not_found">("idle");

  const name = nameDraft ?? me.data?.user?.fullName ?? "";

  useEffect(() => {
    if (dni.length !== 8) {
      setDniHint("idle");
      return;
    }
    const t = setTimeout(async () => {
      const res = await dniLookup(dni);
      if (!res) {
        setDniHint("not_found");
        return;
      }
      setDniHint("idle");
      if (!nameTouchedRef.current) setNameDraft(res.fullName);
    }, 600);
    return () => clearTimeout(t);
  }, [dni, dniLookup]);

  if (box.isLoading) {
    return <Shell><Centered><div style={{ color: C.dim }}>Cargando…</div></Centered></Shell>;
  }
  if (box.error || !box.data) {
    return (
      <Shell>
        <Centered>
          <div style={{ color: C.red }}>Este link de BOX no es válido o expiró.</div>
        </Centered>
      </Shell>
    );
  }

  const b = box.data;
  const filled = b.members.length;
  const remaining = b.capacity - filled;
  const alreadyIn = me.data?.user && b.members.some((m) => m.profileId === me.data?.user?.id);
  const myMember = me.data?.user
    ? b.members.find((m) => m.profileId === me.data?.user?.id)
    : null;

  const dniOk = /^\d{8}$/.test(dni);
  const phoneOk = phone.length >= 9;
  const canSubmit = dniOk && !!name && phoneOk && !join.isPending && remaining > 0;

  const onJoin = async () => {
    const result = await join.mutateAsync({
      token,
      holderName: name,
      holderDni: dni,
      holderPhone: `+51${phone}`,
    });
    // Siempre usamos el link público `/t/[id]?k=...`. Funciona tanto para el
    // host logueado como para el invitado guest, y evita el caso borde de
    // `/tickets/[id]` rebotando 401 cuando la sesión del browser no coincide
    // con el current_holder del ticket recién emitido.
    if (result.joinedTicket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/t/${result.joinedTicket.id}?k=${result.joinedTicket.k}` as any);
    }
  };

  const HeroBlock = (
    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", aspectRatio: "4/5", boxShadow: `0 0 0 1px ${C.line} inset` }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.5), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 16, right: 16, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", fontSize: 12, letterSpacing: "0.1em", fontWeight: 700 }}>
        {b.boxNumber ?? "BOX"} · {filled}/{b.capacity}
      </div>
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.yellow, fontWeight: 700 }}>★ TE INVITARON</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6 }}>
          {b.ownerName} te suma a su BOX en{" "}
          <span style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>{b.event.title}</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
          {formatDate(b.event.startsAt, b.event.timezone)} · {b.event.venue ?? ""}
        </div>
      </div>
    </div>
  );

  const FormBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
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
        <>
          <Field
            label="DNI"
            value={dni}
            onChange={(e) => {
              setDni(e.target.value.replace(/\D/g, "").slice(0, 8));
              nameTouchedRef.current = false;
            }}
            active={dni.length > 0}
            mono
            inputMode="numeric"
            placeholder="8 dígitos"
            hint={
              dniPending
                ? "Buscando en RENIEC…"
                : dniHint === "not_found"
                  ? "No encontramos ese DNI. Podés escribir tu nombre manualmente."
                  : dni.length === 0
                    ? "Lo usamos para emitir tu QR a tu nombre."
                    : undefined
            }
          />
          <Field
            label="Tu nombre"
            value={name}
            onChange={(e) => {
              nameTouchedRef.current = true;
              setNameDraft(e.target.value);
            }}
            active={name.length > 0}
            placeholder={dni.length === 8 ? "Cargando…" : "Como aparece en tu DNI"}
          />
          <div>
            <div style={{ fontSize: 11, color: C.dimmer, letterSpacing: "0.06em", marginBottom: 6 }}>
              WHATSAPP
            </div>
            <PhoneField value={phone} onChange={setPhone} />
            <div style={{ fontSize: 11, color: C.dimmer, marginTop: 6 }}>
              Te mandamos tu QR por acá.
            </div>
          </div>
        </>
      )}

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: C.greenSoft,
          boxShadow: "0 0 0 1px rgba(34,209,127,0.3) inset",
          fontSize: 12,
          color: "rgba(255,255,255,0.9)",
          lineHeight: 1.4,
        }}
      >
        {alreadyIn ? "Ya estás dentro del BOX" : `No pagas nada · ${b.ownerName} ya pagó el BOX`}
      </div>

      {join.error && (
        <div style={{ fontSize: 12, color: C.red }}>{friendlyJoinError((join.error as Error).message)}</div>
      )}

      <div style={{ marginTop: 4 }}>
        {alreadyIn && myMember?.ticketId ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Btn onClick={() => router.push(`/tickets/${myMember.ticketId}` as any)}>Ver mi QR →</Btn>
        ) : (
          <Btn onClick={onJoin} disabled={!canSubmit}>
            {join.isPending ? "Sumándote…" : remaining <= 0 ? "BOX completo" : "Sumarme y recibir mi QR"}
          </Btn>
        )}
      </div>
    </div>
  );

  return (
    <Shell>
      <Centered>
        <div className="join-grid">
          <div className="join-hero">{HeroBlock}</div>
          <div className="join-form">{FormBlock}</div>
        </div>
      </Centered>
      <style jsx>{`
        .join-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          padding: 16px 18px 32px;
        }
        @media (min-width: 900px) {
          .join-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 48px;
            max-width: 980px;
            padding: 24px 32px 32px;
            align-items: center;
          }
        }
      `}</style>
    </Shell>
  );
}

function friendlyJoinError(code: string): string {
  switch (code) {
    case "dni_already_in_box":
      return "Ese DNI ya fue usado en este BOX. Usá tu DNI real.";
    case "box_full":
      return "El BOX ya está completo.";
    case "invalid_token":
      return "Este link de BOX no es válido o expiró.";
    case "phone_required":
      return "Necesitamos tu WhatsApp para enviarte el QR.";
    case "profile_create_failed":
      return "No pudimos crear tu perfil. Revisá el teléfono e intentá de nuevo.";
    default:
      return code;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", display: "flex", flexDirection: "column" }}>
      <BrandHeader />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
      {children}
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-3.5">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]"
        >
          <span className="grid size-8 place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/logo-icon-min.svg"
              alt="Pasape"
              className="size-full object-contain drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]"
            />
          </span>
          <span>Pasape</span>
        </a>
        <span className="text-[12.5px] font-medium text-cart-ink-3">Invitación al BOX</span>
        <span className="size-8" />
      </div>
    </header>
  );
}
