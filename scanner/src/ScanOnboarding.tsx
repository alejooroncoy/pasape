import { useRef, useState } from "react";
import { C, FONT_DISPLAY, FONT_MONO } from "@/components/design/tokens";
import { Logo } from "@/components/brand/Logo";
import { useJoinByCode, useResolveCode } from "@/lib/scanning/hooks/useScannerSession";
import { getPorteroIdentity, setPorteroIdentity } from "@/lib/scanning/deviceId";

// Onboarding del PORTERO — SPA (Capacitor), solo código (sin Google). Flujo en
// DOS pasos, con el código validado ANTES de pedir identidad:
//   1) "code"     → código del evento (6 cajas). "Continuar" lo VALIDA contra el
//                   backend (resolver-código). Si está mal, avisa acá mismo.
//   2) "identity" → confirma a qué evento entra + nombre y DNI (obligatorios: el
//                   portero TIENE que identificarse). Al confirmar, `join` crea
//                   la sesión por token y entramos al escaneo.
// `initialCode` llega del link compartido (`?door=CODE`) y precarga las cajas.

// Alfabeto del código (igual que el backend: sin I, L, O, 0, 1).
const clean = (s: string) =>
  s.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "");
const CODE_LEN = 6;
const DNI_LEN = 8;

type Step = "code" | "identity";

export function ScanOnboarding({
  initialCode,
  onJoined,
}: {
  initialCode?: string;
  onJoined: (eventSlug: string) => void;
}) {
  const resolve = useResolveCode();
  const join = useJoinByCode();

  // Si este device ya se identificó antes (portero recurrente), no se le
  // vuelve a pedir nombre/DNI — se reusa y se salta directo al join.
  const knownIdentity = getPorteroIdentity();

  const fromLink = !!initialCode;
  const [code, setCode] = useState(clean(initialCode ?? "").slice(0, CODE_LEN));
  const [fullName, setFullName] = useState(knownIdentity?.fullName ?? "");
  const [dni, setDni] = useState(knownIdentity?.dni ?? "");
  const [step, setStep] = useState<Step>("code");
  const [eventTitle, setEventTitle] = useState("");

  const ready = code.length === CODE_LEN;
  const nameOk = fullName.trim().length >= 2;
  const dniOk = dni.length === DNI_LEN;
  const canEnter = nameOk && dniOk && !join.isPending;

  const badCode =
    resolve.isError &&
    resolve.error instanceof Error &&
    resolve.error.message === "invalid_code";

  const doJoin = (name: string, doc: string) => {
    join.mutate(
      { code, fullName: name.trim(), dni: doc },
      {
        onSuccess: (res) => {
          setPorteroIdentity({ fullName: name.trim(), dni: doc });
          onJoined(res.eventSlug);
        },
        // Código revocado entre el paso 1 y 2 → volver a corregirlo.
        onError: (err) => {
          if (err instanceof Error && err.message === "invalid_code") {
            setStep("code");
          }
        },
      },
    );
  };

  // Paso 1 → valida el código por detrás. Si ya conocemos su identidad, entra
  // directo (sin pedirle nombre/DNI de nuevo); si no, pasa al paso 2.
  const continueToIdentity = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready || resolve.isPending) return;
    resolve.mutate(code, {
      onSuccess: (res) => {
        setEventTitle(res.eventTitle);
        if (knownIdentity) {
          doJoin(knownIdentity.fullName, knownIdentity.dni);
        } else {
          setStep("identity");
        }
      },
    });
  };

  const submit = () => {
    if (!canEnter) return;
    doJoin(fullName, dni);
  };

  return (
    <div style={shell}>
      <div style={{ width: "100%", maxWidth: 380, margin: "0 auto" }}>
        {/* Marca */}
        <div style={brandRow}>
          <div style={brandMark}>
            <Logo style={{ width: 15, height: 15 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Pasape
            </span>
            <span style={brandTag}>MODO PORTERO</span>
          </div>
        </div>

        {step === "code" ? (
          // ── PASO 1 · Código ─────────────────────────────────────────────────
          <form onSubmit={continueToIdentity}>
            <h1 style={h1}>Entra a validar</h1>
            <p style={sub}>
              {fromLink
                ? "Confirma el código del evento para entrar a la puerta."
                : "Ingresa el código que te pasó el organizador."}
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 30 }}>
              <span style={fieldLabel}>
                Código del evento
                {fromLink && <span style={fieldHint}> · del enlace</span>}
              </span>
              <CodeBoxes value={code} onChange={setCode} autoFocus={!fromLink} />
            </div>

            {badCode && (
              <div style={{ ...errorBox, marginTop: 18 }}>
                Código inválido o vencido. Revísalo con el organizador.
              </div>
            )}
            {resolve.isError && !badCode && (
              <div style={{ ...errorBox, marginTop: 18 }}>
                No pudimos verificar el código. Revisa tu conexión e intenta de nuevo.
              </div>
            )}
            {knownIdentity && join.isError && !badCode && (
              <div style={{ ...errorBox, marginTop: 18 }}>
                No pudimos crear tu sesión. Intenta de nuevo.
              </div>
            )}

            <button
              type="submit"
              disabled={!ready || resolve.isPending || join.isPending}
              style={{ ...btnPrimary, marginTop: 26, opacity: ready ? 1 : 0.4 }}
            >
              {join.isPending ? "Entrando…" : resolve.isPending ? "Verificando…" : "Continuar"}
            </button>

            <div style={offlineNote}>
              <OfflineGlyph />
              <span>Una vez dentro, validas aunque se caiga el internet.</span>
            </div>
          </form>
        ) : (
          // ── PASO 2 · Identidad del portero (obligatoria) ────────────────────
          <div>
            <button type="button" onClick={() => setStep("code")} style={backBtn}>
              <BackGlyph /> Código
            </button>

            {/* Confirmación del evento al que va a entrar */}
            <div style={eventCard}>
              <span style={{ fontSize: 11, color: C.dim, fontWeight: 600 }}>
                Vas a entrar a
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {eventTitle}
              </span>
            </div>

            <h1 style={{ ...h1, marginTop: 20 }}>Identifícate</h1>
            <p style={sub}>
              El organizador registra quién valida en cada puerta. Pon tu nombre y
              DNI para empezar.
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={fieldLabel}>Tu nombre completo</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre del portero"
                  autoFocus
                  style={input}
                />
              </label>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={fieldLabel}>Tu DNI</span>
                <input
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, DNI_LEN))}
                  placeholder="12345678"
                  inputMode="numeric"
                  style={{ ...input, fontFamily: FONT_MONO, letterSpacing: 2 }}
                />
              </label>
            </div>

            {join.isError && (
              <div style={{ ...errorBox, marginTop: 18 }}>
                No pudimos crear tu sesión. Intenta de nuevo.
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canEnter}
              style={{ ...btnPrimary, marginTop: 26, opacity: canEnter || join.isPending ? 1 : 0.4 }}
            >
              {join.isPending ? "Entrando…" : "Entrar a validar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cajas de código segmentadas (OTP-style) ─────────────────────────────────
function CodeBoxes({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const chars = Array.from({ length: CODE_LEN }, (_, i) => value[i] ?? "");
  // Celda activa = la próxima a llenar (o la última si ya está completo). Hace
  // de "cursor" visual.
  const activeIndex = Math.min(value.length, CODE_LEN - 1);

  return (
    // UN solo input real (capa transparente encima) + 6 celdas visuales. Antes
    // eran 6 inputs: al saltar el foco de caja en caja, el teclado se reseteaba
    // a letras tras cada carácter (molesto al mezclar letras y números). Con un
    // único input el foco no salta → el teclado se mantiene. Las celdas SIEMPRE
    // iguales con grid `minmax(0,1fr)` (respeta el ancho del móvil).
    <div style={{ position: "relative" }} onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(clean(e.target.value).slice(0, CODE_LEN))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={CODE_LEN}
        aria-label="Código del evento"
        style={hiddenInput}
      />
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}
        aria-hidden
      >
        {chars.map((ch, i) => (
          <div key={i} style={codeBox(ch !== "", focused && i === activeIndex)}>
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Glyphs ───────────────────────────────────────────────────────────────────
function OfflineGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M8 1.5a4 4 0 0 1 4 4v1.2c1 .4 1.7 1.4 1.7 2.6A2.8 2.8 0 0 1 11 12.1H5a3.2 3.2 0 0 1-.6-6.3"
        stroke={C.green}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.3 8.3 7.6 9.6 10 7" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 3 4.5 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: C.bg,
  color: C.text,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(env(safe-area-inset-top, 0px) + 28px) 24px calc(env(safe-area-inset-bottom, 0px) + 28px)",
  fontFamily: FONT_DISPLAY,
  boxSizing: "border-box",
};

const brandRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  marginBottom: 34,
};

const brandMark: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 9,
  background: C.purple,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: `0 0 0 1px rgba(255,255,255,0.12) inset, 0 5px 16px ${C.purpleEdge}`,
};

const brandTag: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: C.dim,
};

const h1: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.035em",
  lineHeight: 1.08,
  margin: 0,
};

const sub: React.CSSProperties = {
  color: C.dim,
  fontSize: 15,
  lineHeight: 1.5,
  margin: "10px 0 0",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: C.dim,
};

const fieldHint: React.CSSProperties = {
  color: C.purple,
  fontWeight: 600,
};

const hiddenInput: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  border: 0,
  margin: 0,
  padding: 0,
  background: "transparent",
  color: "transparent",
  caretColor: "transparent",
  fontSize: 16, // evita el zoom de iOS al enfocar
  zIndex: 2,
  cursor: "pointer",
};

const codeBox = (filled: boolean, focused: boolean): React.CSSProperties => ({
  width: "100%",
  minWidth: 0,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: FONT_MONO,
  fontSize: 26,
  fontWeight: 700,
  color: filled ? "#fff" : C.text,
  userSelect: "none",
  background: focused ? C.bg3 : C.bg2,
  border: `1.5px solid ${focused ? C.purple : filled ? C.purpleEdge : C.line}`,
  borderRadius: 14,
  boxSizing: "border-box",
  boxShadow: focused
    ? `0 0 0 4px ${C.purpleSoft}`
    : filled
      ? `0 0 0 1px ${C.purpleSoft}`
      : "none",
  transition: "border-color .15s, box-shadow .15s, background .15s",
});

const input: React.CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: "13px 14px",
  color: C.text,
  fontSize: 16,
  fontFamily: FONT_DISPLAY,
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const eventCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "13px 16px",
  borderRadius: 14,
  background: C.purpleSoft,
  border: `1px solid ${C.purpleEdge}`,
};

const backBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "none",
  border: "none",
  color: C.dim,
  fontFamily: FONT_DISPLAY,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  marginBottom: 18,
};

const errorBox: React.CSSProperties = {
  background: C.redSoft,
  border: `1px solid ${C.red}44`,
  borderRadius: 12,
  padding: "11px 14px",
  color: C.red,
  fontSize: 13.5,
  lineHeight: 1.4,
};

const btnPrimary: React.CSSProperties = {
  background: C.purple,
  color: "#fff",
  border: "none",
  borderRadius: 16,
  padding: "16px 16px",
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  fontFamily: FONT_DISPLAY,
  cursor: "pointer",
  width: "100%",
  boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 30px -10px ${C.purpleEdge}`,
  transition: "opacity .15s",
};

const offlineNote: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 22,
  fontSize: 12.5,
  color: C.dim,
};
