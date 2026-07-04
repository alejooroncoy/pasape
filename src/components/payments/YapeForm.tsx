"use client";

import { useRef, useState } from "react";
import { C, FONT_DISPLAY } from "@/components/design";
import { useMpSdk } from "@/lib/payments/hooks/useMpSdk";

type Props = {
  orderId: string;
  amount: number;
  initialPhone?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

export function YapeForm({ orderId, amount, initialPhone = "", onPaid, onError }: Props) {
  const mp = useMpSdk(onError);
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, "").slice(0, 9));
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otpCode = otp.join("");
  const phoneDigits = phone.replace(/\D/g, "");
  const canSubmit = !submitting && phoneDigits.length === 9 && otpCode.length === 6 && !!mp;

  const handleOtpChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length < 2) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    text.split("").forEach((d, i) => (next[i] = d));
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const submit = async () => {
    setLocalError(null);
    if (!mp) {
      setLocalError("MP SDK no cargado");
      return;
    }
    setSubmitting(true);
    try {
      const tokenResp = await mp.yape({ otp: otpCode, phoneNumber: phoneDigits }).create();
      const res = await fetch("/api/payments/yape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token: tokenResp.id,
          phoneNumber: phoneDigits,
          // Device fingerprint que el SDK v2 crea al cargar (antifraude +
          // ítem "SDK de frontend" del checklist cuando la muestra es Yape).
          deviceId: typeof window !== "undefined" ? window.MP_DEVICE_SESSION_ID ?? null : null,
        }),
      });
      // El backend usa el helper json() → respuesta `{data: ...}` en éxito o
      // `{error: ...}` en error. NO es el shape antiguo `{ok, value/error}`.
      const body = (await res.json()) as {
        data?: { status: string; paymentId: string; message?: string };
        error?: string;
      };
      if (!res.ok || body.error) {
        const errMsg = body.error ?? `HTTP ${res.status}`;
        setLocalError(humanizeYapeError(errMsg));
        onError?.(errMsg);
        return;
      }
      const value = body.data;
      if (!value) {
        setLocalError(humanizeYapeError("empty_response"));
        onError?.("empty_response");
        return;
      }
      if (value.status === "approved" || value.status === "in_process") {
        onPaid();
      } else {
        setLocalError(humanizeYapeError(value.message ?? "rejected"));
        onError?.(value.message ?? "rejected");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "yape_failed";
      setLocalError(humanizeYapeError(msg));
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 18,
        padding: 18,
        boxShadow: `0 0 0 1px ${C.line} inset`,
      }}
    >
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        Pagá con Yape en segundos
      </div>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
        Activá <b>“Compras por internet”</b> en tu app Yape y copiá el código de aprobación.
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, letterSpacing: "0.04em" }}>
          CELULAR ASOCIADO A YAPE
        </div>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="987 654 321"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
          style={{
            width: "100%",
            height: 46,
            background: "rgba(255,255,255,0.04)",
            border: 0,
            borderRadius: 12,
            padding: "0 14px",
            color: "#fff",
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 15,
            letterSpacing: "0.04em",
            outline: "none",
            boxShadow: `0 0 0 1px ${C.line} inset`,
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, letterSpacing: "0.04em" }}>
          CÓDIGO DE APROBACIÓN
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                otpRefs.current[i] = el;
              }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              onPaste={i === 0 ? handleOtpPaste : undefined}
              style={{
                width: 42,
                height: 50,
                background: "rgba(255,255,255,0.04)",
                border: 0,
                borderRadius: 10,
                textAlign: "center",
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                outline: "none",
                boxShadow: `0 0 0 1px ${d ? "rgba(124,58,237,0.45)" : C.line} inset`,
              }}
            />
          ))}
        </div>
      </div>

      {localError && (
        <div style={{ fontSize: 12, color: C.red, marginBottom: 10, textAlign: "center" }}>
          {localError}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        style={{
          width: "100%",
          height: 50,
          borderRadius: 14,
          border: 0,
          background: canSubmit
            ? "linear-gradient(180deg, #A855F7, #7C3AED)"
            : "rgba(124,58,237,0.35)",
          color: "#fff",
          fontFamily: FONT_DISPLAY,
          fontSize: 15,
          fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          boxShadow: "0 12px 32px -8px rgba(168,85,247,0.75)",
        }}
      >
        {submitting ? "Confirmando con Yape…" : `Pagar S/ ${amount.toFixed(2)} con Yape`}
      </button>

      <div style={{ marginTop: 8, fontSize: 10, color: C.dim, textAlign: "center" }}>
        Procesado por Mercado Pago
      </div>
    </div>
  );
}

const humanizeYapeError = (raw: string): string => {
  if (raw.includes("invalid_otp") || raw.includes("invalid_code"))
    return "Código de aprobación inválido. Generá uno nuevo en tu app Yape.";
  if (raw.includes("insufficient")) return "Saldo Yape insuficiente.";
  if (raw.includes("limit") || raw.includes("daily"))
    return "Superaste tu límite diario de Yape. Probá con menos monto o usá otro método.";
  if (raw.includes("rejected")) return "Yape rechazó el pago.";
  if (raw.includes("network")) return "Falla de red. Reintentá.";
  return raw;
};
