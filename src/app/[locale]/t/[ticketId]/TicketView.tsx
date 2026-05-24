"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { C, FONT_DISPLAY, GoogleBtn, Phone, QrSquare } from "@/components/design";
import { useRotatingQr } from "@/lib/tickets/hooks/useRotatingQr";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

type Props = {
  ticketId: string;
  k: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  ticketTypeName: string;
  event: {
    title: string;
    starts_at: string;
    venue: string | null;
    timezone: string;
  } | null;
};

// Compacto: "Sáb 23 may · 22:00". Mantiene esencial (día semana abreviado +
// fecha corta + hora) sin la verbosidad del "sábado, 23 de mayo de 2026...".
const formatDate = (iso: string, tz: string): string => {
  try {
    const d = new Date(iso);
    const dayPart = new Intl.DateTimeFormat("es-PE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    }).format(d);
    const timePart = new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d);
    // Capitalizar primera letra del día (es-PE devuelve "sáb" minúscula).
    const pretty = dayPart.replace(/^./, (c) => c.toUpperCase()).replace(/\.$/, "");
    return `${pretty} · ${timePart}`;
  } catch {
    return iso;
  }
};

export const TicketView = ({
  ticketId,
  k,
  status,
  holderName,
  holderEmail,
  ticketTypeName,
  event,
}: Props) => {
  const rotatingUrl =
    status === "active"
      ? `/api/t/${ticketId}/rotating?k=${encodeURIComponent(k)}`
      : null;
  const { payload, secondsLeft, loading, error } = useRotatingQr(rotatingUrl);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signIn, pending: signInPending, error: signInError } = useGoogleSignIn();
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;

  // Cuando el usuario completa el login y volvemos a esta página, ocultamos
  // el drawer automáticamente.
  useEffect(() => {
    if (isLogged) setDrawerOpen(false);
  }, [isLogged]);

  return (
    <Phone>
      <div style={{ padding: "22px 22px 40px" }}>
        <div
          style={{
            borderRadius: 28,
            padding: 22,
            background: "linear-gradient(180deg, rgba(124,58,237,0.25), rgba(20,12,40,0.5))",
            boxShadow:
              "0 0 0 1px rgba(124,58,237,0.45) inset, 0 30px 60px -20px rgba(124,58,237,0.55)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.6)",
              marginBottom: 6,
            }}
          >
            MUESTRA EN PUERTA
          </div>

          {event && (
            <>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {event.title}
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
                {formatDate(event.starts_at, event.timezone)}
                {event.venue ? ` · ${event.venue}` : ""}
              </div>
            </>
          )}

          <div
            style={{
              marginTop: 16,
              padding: 20,
              background: "#fff",
              borderRadius: 22,
              display: "flex",
              justifyContent: "center",
              position: "relative",
              minHeight: 260,
              alignItems: "center",
            }}
          >
            {status === "active" && payload && <QrSquare code={payload} size={220} />}
            {status === "active" && !payload && loading && (
              <div style={{ color: "#888", fontSize: 13 }}>Generando QR…</div>
            )}
            {status === "active" && error && (
              <div style={{ color: "#c00", fontSize: 13, textAlign: "center", padding: 12 }}>
                No pudimos generar el QR. Recarga.
              </div>
            )}
            {status !== "active" && (
              <div style={{ color: "#888", fontSize: 14, fontWeight: 600 }}>
                Esta entrada ya no está activa.
              </div>
            )}

            {status === "active" && payload && <CountdownRing seconds={secondsLeft} />}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", color: C.dim }}>
                {(holderName ?? "TITULAR").toUpperCase()}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{ticketTypeName}</div>
            </div>
            {status === "used" && (
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(255,77,94,0.18)",
                  color: C.red,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                }}
              >
                YA USADA
              </div>
            )}
          </div>
        </div>

        {status === "active" && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(124,58,237,0.18)",
              boxShadow: "0 0 0 1px rgba(124,58,237,0.45) inset",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
            }}
          >
            <ShieldIcon />
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontWeight: 600 }}>Tu QR cambia cada 10 segundos</div>
              <div style={{ fontSize: 11, color: C.dim }}>
                Las capturas no sirven en puerta — solo tu pantalla en vivo
              </div>
            </div>
          </div>
        )}

        {status === "active" && !isLogged && (
          <div
            style={{
              marginTop: 22,
              padding: "16px 18px",
              borderRadius: 18,
              background: C.bg2,
              boxShadow: `0 0 0 1px ${C.line} inset`,
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
              ¿Quieres tener tus entradas a la mano?
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>
              Crea tu cuenta gratis y todas tus entradas se guardan automáticamente. Entras con tu
              celular — sin contraseña, sin apps.
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "13px 18px",
                borderRadius: 999,
                background: "#7C3AED",
                color: "#fff",
                textAlign: "center",
                fontWeight: 700,
                fontSize: 14,
                border: 0,
                cursor: "pointer",
                boxShadow: "0 12px 32px -8px rgba(124,58,237,0.65)",
              }}
            >
              Crear mi cuenta
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <SignInDrawer
            onClose={() => setDrawerOpen(false)}
            onGoogle={() => void signIn()}
            pending={signInPending}
            error={signInError}
          />
        )}
      </AnimatePresence>
    </Phone>
  );
};

const SignInDrawer = ({
  onClose,
  onGoogle,
  pending,
  error,
}: {
  onClose: () => void;
  onGoogle: () => void;
  pending: boolean;
  error: string | null;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 50,
    }}
  >
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
      onClick={(e) => e.stopPropagation()}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 800) onClose();
      }}
      style={{
        width: "100%",
        maxWidth: 420,
        background: C.bg2,
        borderRadius: "26px 26px 0 0",
        padding: "14px 22px 36px",
        boxShadow: "0 -1px 0 rgba(255,255,255,0.07) inset, 0 -30px 60px -10px rgba(0,0,0,0.7)",
        touchAction: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.25, ease: "easeOut" }}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 6,
        }}
      >
        Crea tu cuenta
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.25, ease: "easeOut" }}
        style={{ fontSize: 13, color: C.dim, marginBottom: 20, lineHeight: 1.5 }}
      >
        Un toque y todas tus entradas quedan guardadas.
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
      >
        <GoogleBtn onClick={onGoogle} disabled={pending} />
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ fontSize: 12, color: C.red, marginTop: 12, textAlign: "center", overflow: "hidden" }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28, duration: 0.25 }}
        style={{ fontSize: 11, color: C.dimmer, marginTop: 14, textAlign: "center" }}
      >
        Sin contraseña · sin apps
      </motion.div>
    </motion.div>
  </motion.div>
);

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path
      d="M11 2L3 5v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"
      fill="rgba(124,58,237,0.18)"
      stroke="#7C3AED"
      strokeWidth="1.4"
    />
    <path
      d="M7.5 11l2.5 2.5L14.5 9"
      stroke="#7C3AED"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CountdownRing = ({ seconds }: { seconds: number }) => {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (10 - seconds) / 10));
  const offset = circumference * progress;
  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        right: -10,
        width: 48,
        height: 48,
        borderRadius: 999,
        background: C.bg,
        boxShadow: `0 0 0 2px ${C.bg2}, 0 8px 20px rgba(0,0,0,0.4)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={C.purple}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${C.purple})`,
            transition: "stroke-dashoffset 1s linear",
          }}
        />
      </svg>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 14,
          color: C.purple,
          letterSpacing: "-0.02em",
        }}
      >
        {seconds}s
      </div>
    </div>
  );
};
