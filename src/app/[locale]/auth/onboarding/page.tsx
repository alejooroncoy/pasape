"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackBtn, Btn, C, CloseBtn, FONT_DISPLAY, Field, Phone } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useDniLookup } from "@/lib/identity/hooks/useDniLookup";
import { useOnboarding } from "@/lib/identity/hooks/useOnboarding";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const searchParams = useSearchParams();
  const isOrganizerIntent = searchParams.get("intent") === "organizer";
  const { data: me } = useCurrentUser();
  const router = useRouter();
  const [fullName, setFullName] = useState(me?.user?.fullName ?? "");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState(me?.user?.phone ?? "");
  const [email, setEmail] = useState(me?.user?.email ?? "");
  const [role, setRole] = useState<"buyer" | "organizer" | "promoter">(
    isOrganizerIntent ? "organizer" : "buyer",
  );
  const onboarding = useOnboarding();
  const { lookup: dniLookup } = useDniLookup();
  // Si el usuario editó el nombre a mano, no lo sobreescribimos con el lookup.
  const nameTouchedRef = useRef(false);

  // Debounce 600ms — cuando dni alcanza 8 dígitos, pedimos a Decolecta y
  // autocompletamos si el usuario no tocó nombre todavía. Si falla, silencio.
  useEffect(() => {
    if (dni.length !== 8) return;
    const t = setTimeout(async () => {
      const res = await dniLookup(dni);
      if (res && !nameTouchedRef.current) setFullName(res.fullName);
    }, 600);
    return () => clearTimeout(t);
  }, [dni, dniLookup]);

  const hasGoogle = !!me?.user?.email;

  const submit = async () => {
    const result = await onboarding.mutateAsync({
      fullName,
      email: email || null,
      phone: phone || null,
      dni: dni || null,
      initialRole: role,
    });
    router.replace(role === "organizer" && result.orgSlug ? "/org" : "/");
  };

  return (
    <div className="pasape-canvas">
      <Phone>
        <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BackBtn />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: C.green,
                boxShadow: "0 0 8px rgba(34,209,127,0.7)",
              }}
            />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 600, letterSpacing: "0.04em" }}>
              {hasGoogle ? "GOOGLE OK" : "NÚMERO OK"}
            </span>
          </div>
          <CloseBtn />
        </div>

        <div style={{ padding: "20px 22px 0" }}>
          <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
            ÚLTIMO PASO
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              marginBottom: 6,
            }}
          >
            Una sola<br />cosa más.
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 22, lineHeight: 1.5 }}>
            Para que tu entrada sea nominal.
          </div>

          <Field
            label="Nombre"
            value={fullName}
            onChange={(e) => {
              nameTouchedRef.current = true;
              setFullName(e.target.value);
            }}
            placeholder="Juan Pérez García"
            active={fullName.length > 0}
          />
          <Field
            label="DNI"
            mono
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="71234567"
            active={dni.length > 0}
          />
          {hasGoogle ? (
            <Field
              label="Celular"
              mono
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="987 654 321"
            />
          ) : (
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@gmail.com"
            />
          )}

          <div style={{ marginTop: 8, fontSize: 11, color: C.dimmer, lineHeight: 1.6 }}>
            🔒 Solo para tu QR · no se comparte con nadie
          </div>

          {!isOrganizerIntent && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, color: C.dimmer, letterSpacing: "0.06em", marginBottom: 6 }}>
                CÓMO VAS A USAR PASAPE
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["buyer", "promoter", "organizer"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 12,
                      border: 0,
                      background: role === r ? C.purple : "rgba(255,255,255,0.05)",
                      color: role === r ? "#fff" : C.dim,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {r === "buyer" ? "Comprar" : r === "promoter" ? "Promotor" : "Organizador"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
          {onboarding.error && (
            <div style={{ marginBottom: 10, fontSize: 12, color: C.red }}>{(onboarding.error as Error).message}</div>
          )}
          <Btn onClick={() => void submit()} disabled={onboarding.isPending || !fullName}>
            {onboarding.isPending ? "Guardando…" : "Listo →"}
          </Btn>
        </div>
      </Phone>
    </div>
  );
}
