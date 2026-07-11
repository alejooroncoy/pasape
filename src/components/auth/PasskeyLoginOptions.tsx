"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GoogleBtn } from "@/components/design";
import { OtpRow } from "@/components/design/OtpRow";
import { C, FONT_DISPLAY } from "@/components/design/tokens";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { currentUserKey } from "@/lib/identity/hooks/useCurrentUser";
import { api } from "@/lib/_shared/api-client";
import { setOauthReturn } from "@/components/auth/PostLoginRedirect";
import { clientEvents } from "@/lib/analytics/clientEvents";

// Componente compartido de "opciones de login" (Google / código+huella) — usado
// tanto en SignInDrawer (source "generic") como en order/[orderId]/[token]
// (source "order"). La única diferencia real entre ambos: en "order" ya
// sabemos el correo (orders.guest_email, nunca expuesto al cliente) así que el
// código se manda solo; en "generic" hay que pedirle el correo antes.

const PASSKEY_HINT_COOKIE = "pasape-passkey-hint";

const hasPasskeyHint = (): boolean =>
  typeof document !== "undefined" &&
  document.cookie.split("; ").some((c) => c.startsWith(`${PASSKEY_HINT_COOKIE}=`));

const setPasskeyHint = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${PASSKEY_HINT_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
};

const passkeySupported = (): boolean =>
  typeof window !== "undefined" && !!window.PublicKeyCredential;

type Props = {
  source: "order" | "generic";
  orderId?: string;
  token?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  // Se dispara justo antes de mostrar "¿guardar tu huella?" — el contenedor
  // (SignInDrawer) lo usa para no cerrarse solo por detectar sesión nueva,
  // ya que ese auto-close es para el flujo de Google (que sí navega fuera).
  onOfferingPasskey?: () => void;
};

type Step =
  | "start"
  | "email"
  | "otp"
  | "offer-passkey"
  | "passkey-auth";

export function PasskeyLoginOptions({
  source,
  orderId,
  token,
  redirectTo,
  onSuccess,
  onOfferingPasskey,
}: Props) {
  const qc = useQueryClient();
  const google = useGoogleSignIn({ redirectTo });
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUsePasskey = passkeySupported();
  const showPasskeyFirst = canUsePasskey && hasPasskeyHint();

  const afterLoginSuccess = () => {
    qc.invalidateQueries({ queryKey: currentUserKey });
  };

  const startCode = async (emailForOrder?: string) => {
    setBusy(true);
    setError(null);
    try {
      const body =
        source === "order"
          ? { source: "order" as const, orderId, token }
          : { source: "generic" as const, email: emailForOrder ?? email };
      const res = await api.post<{ emailHint: string }>("/api/auth/passkey-code/start", body);
      setEmailHint(res.emailHint);
      setStep("otp");
    } catch {
      setError("No pudimos enviar el código. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const body =
        source === "order"
          ? { source: "order" as const, orderId, token, code }
          : { source: "generic" as const, email, code };
      await api.post("/api/auth/passkey-code/verify", body);
      afterLoginSuccess();
      if (canUsePasskey) {
        onOfferingPasskey?.();
        setStep("offer-passkey");
      } else {
        setStep("start");
        onSuccess?.();
      }
    } catch {
      setError("Código inválido o vencido. Revisa e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const registerPasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const options = await api.post("/api/auth/webauthn/register/options");
      const attResp = await startRegistration({ optionsJSON: options as never });
      await api.post("/api/auth/webauthn/register/verify", attResp);
      setPasskeyHint();
      onSuccess?.();
    } catch {
      // Cancelar/fallar el registro no debe bloquear: ya está logueado por código.
      onSuccess?.();
    } finally {
      setBusy(false);
    }
  };

  const authenticateWithPasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { options, attemptId } = await api.post<{ options: unknown; attemptId: string }>(
        "/api/auth/webauthn/authenticate/options",
      );
      const authResp = await startAuthentication({ optionsJSON: options as never });
      await api.post("/api/auth/webauthn/authenticate/verify", { attemptId, response: authResp });
      clientEvents.signInStarted({ provider: "passkey" });
      afterLoginSuccess();
      onSuccess?.();
    } catch {
      setError("No pudimos entrar con tu huella. Usa Google o el código de tu correo.");
      setStep("start");
    } finally {
      setBusy(false);
    }
  };

  const labelStyle = {
    fontFamily: FONT_DISPLAY,
    fontSize: 13.5,
    fontWeight: 600,
    color: C.dim,
  } as const;

  if (step === "offer-passkey") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ ...labelStyle, color: C.text, fontSize: 16, marginBottom: 6 }}>
          ¿Entrar más rápido la próxima vez?
        </p>
        <p style={{ ...labelStyle, marginBottom: 18 }}>
          Guarda tu huella en este dispositivo — no vuelvas a pedir un código.
        </p>
        <button
          type="button"
          onClick={registerPasskey}
          disabled={busy}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: 0,
            background: C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {busy ? "Guardando…" : "Usar mi huella"}
        </button>
        <button
          type="button"
          onClick={() => onSuccess?.()}
          disabled={busy}
          style={{ marginTop: 10, ...labelStyle, background: "none", border: 0, cursor: "pointer" }}
        >
          Ahora no
        </button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ ...labelStyle, color: C.text, fontSize: 15, marginBottom: 4 }}>
          Te enviamos un código a {emailHint}
        </p>
        <p style={{ ...labelStyle, marginBottom: 16 }}>Pégalo aquí para desbloquear este dispositivo.</p>
        <OtpRow value={code} onChange={setCode} />
        {error && <p style={{ color: C.red, fontSize: 12.5, marginTop: 12 }}>{error}</p>}
        <button
          type="button"
          onClick={verifyCode}
          disabled={busy || code.length !== 6}
          style={{
            marginTop: 18,
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: 0,
            background: C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            opacity: code.length !== 6 ? 0.5 : 1,
          }}
        >
          {busy ? "Verificando…" : "Verificar código"}
        </button>
        <p style={{ marginTop: 12, fontSize: 11, color: C.dimmer }}>
          Esto solo pasa una vez — las próximas veces entras con tu huella.
        </p>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ ...labelStyle, color: C.text, fontSize: 15, marginBottom: 12 }}>
          ¿Cuál es tu correo?
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          autoFocus
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: `1px solid ${C.line2}`,
            background: C.bg2,
            color: C.text,
            padding: "0 16px",
            fontSize: 15,
            textAlign: "center",
          }}
        />
        {error && <p style={{ color: C.red, fontSize: 12.5, marginTop: 12 }}>{error}</p>}
        <button
          type="button"
          onClick={() => startCode()}
          disabled={busy || !email.includes("@")}
          style={{
            marginTop: 14,
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: 0,
            background: C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            opacity: !email.includes("@") ? 0.5 : 1,
          }}
        >
          {busy ? "Enviando…" : "Enviar código"}
        </button>
      </div>
    );
  }

  // step === "start"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {showPasskeyFirst && (
        <button
          type="button"
          onClick={authenticateWithPasskey}
          disabled={busy}
          style={{
            height: 60,
            borderRadius: 18,
            border: 0,
            background: C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {busy ? "Verificando huella…" : "Entrar con tu huella"}
        </button>
      )}

      <GoogleBtn
        onClick={() => {
          clientEvents.signInStarted({ provider: "google" });
          setOauthReturn(redirectTo ?? window.location.pathname + window.location.search);
          google.signIn();
        }}
        disabled={google.pending}
        label={google.pending ? "Abriendo Google…" : "Continuar con Google"}
      />
      {google.error && <p style={{ color: C.red, fontSize: 12, textAlign: "center" }}>No se pudo abrir Google. Reintenta.</p>}

      <button
        type="button"
        onClick={() => (source === "order" ? startCode() : setStep("email"))}
        disabled={busy}
        style={{ ...labelStyle, background: "none", border: 0, cursor: "pointer", padding: 6 }}
      >
        {busy ? "Enviando código…" : "Usar código de tu correo"}
      </button>
      {error && <p style={{ color: C.red, fontSize: 12.5, textAlign: "center" }}>{error}</p>}
    </div>
  );
}
