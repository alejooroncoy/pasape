"use client";

import { useState } from "react";
import { C, FONT_DISPLAY, FONT_MONO } from "@/components/design";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useJoinByCode } from "@/lib/scanning/hooks/useScannerSession";

// Onboarding del portero: login Google → nombre/DNI → código de evento.
// Al canjear el código se crea la sesión con binding 24h y el gate deja pasar.
//
// `initialCode` llega del link compartido (`/scan?door=CODE`): el portero no
// teclea nada, solo confirma quién es y entra. Sin él, ingresa el código a mano.

export function ScanOnboarding({ initialCode }: { initialCode?: string }) {
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;
  const redirectTo =
    typeof window !== "undefined" ? window.location.href : undefined;
  const { signIn, pending: signInPending } = useGoogleSignIn({ redirectTo });
  const join = useJoinByCode();

  const fromLink = !!initialCode;
  const [code, setCode] = useState(initialCode ?? "");
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    join.mutate(
      {
        code: code.trim(),
        fullName: fullName.trim() || me.data?.user.fullName || null,
        dni: dni.trim() || null,
      },
      {
        // Canjeado el código → modo escaneo del evento que resolvió el código.
        onSuccess: (res) => {
          window.location.href = `/scan?event=${encodeURIComponent(res.eventSlug)}`;
        },
      },
    );
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        color: C.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Modo Puerta
        </div>
        <div style={{ color: C.dim, fontSize: 14, marginBottom: 28 }}>
          Valida entradas de este evento. Tu acceso dura 24 horas en este
          dispositivo.
        </div>

        {!isLogged ? (
          <button
            onClick={() => void signIn()}
            disabled={signInPending}
            style={btnPrimary}
          >
            {signInPending ? "Conectando…" : "Iniciar sesión con Google"}
          </button>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            {fromLink ? (
              <Field label="Código del evento">
                <div
                  style={{
                    ...input,
                    fontFamily: FONT_MONO,
                    letterSpacing: 3,
                    fontWeight: 700,
                    fontSize: 20,
                    color: C.purple,
                    textAlign: "center",
                  }}
                >
                  {code}
                </div>
              </Field>
            ) : (
              <Field label="Código del evento">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej. K7P2QX"
                  autoCapitalize="characters"
                  style={{ ...input, fontFamily: FONT_MONO, letterSpacing: 1 }}
                />
              </Field>
            )}
            <Field label="Tu nombre (opcional)">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={me.data?.user.fullName ?? "Nombre del portero"}
                style={input}
              />
            </Field>
            <Field label="DNI — últimos 2 dígitos (opcional)">
              <input
                value={dni}
                onChange={(e) =>
                  setDni(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                placeholder="42"
                inputMode="numeric"
                style={{ ...input, fontFamily: FONT_MONO }}
              />
            </Field>

            {join.isError && (
              <div style={{ color: C.red, fontSize: 13 }}>
                {join.error instanceof Error &&
                join.error.message === "invalid_code"
                  ? "Código inválido o vencido."
                  : "No pudimos validar el código. Intenta de nuevo."}
              </div>
            )}

            <button
              type="submit"
              disabled={!code.trim() || join.isPending}
              style={{ ...btnPrimary, opacity: !code.trim() ? 0.5 : 1 }}
            >
              {join.isPending ? "Validando…" : "Entrar a la puerta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: "12px 14px",
  color: C.text,
  fontSize: 16,
  fontFamily: FONT_DISPLAY,
  outline: "none",
  width: "100%",
};

const btnPrimary: React.CSSProperties = {
  background: C.purple,
  color: C.text,
  border: "none",
  borderRadius: 12,
  padding: "14px 16px",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: FONT_DISPLAY,
  cursor: "pointer",
  width: "100%",
};
