"use client";

import { useEffect, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { C, FONT_DISPLAY } from "@/components/design";

// Why: el SDK v2 Secure Fields rechazaba containers en runtime ("Container not
// found"). Usamos el CardPayment Brick oficial de sdk-react — es el componente
// específico para tarjeta (no incluye Wallet/Yape), renderiza el form completo
// con PCI iframes manejados por MP, y nos pasa el token via onSubmit.

let mpInit = false;

type Props = {
  orderId: string;
  amount: number;
  initialHolder?: string;
  initialDni?: string;
  initialEmail?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

export function CardForm({ orderId, amount, initialDni, initialEmail, onPaid, onError }: Props) {
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!key) {
      onError?.("missing_mp_public_key");
      return;
    }
    if (!mpInit) {
      initMercadoPago(key, { locale: "es-PE" });
      mpInit = true;
    }
    setReady(true);
  }, [onError]);

  if (!ready) {
    return (
      <div style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: 24 }}>
        Cargando…
      </div>
    );
  }

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
        Paga con tu tarjeta
      </div>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
        Visa, Mastercard, AMEX, Diners — débito o crédito.
      </div>

      <CardPayment
        key={`${initialDni ?? ""}|${initialEmail ?? ""}`}
        initialization={{
          amount,
          payer:
            initialEmail || initialDni
              ? {
                  ...(initialEmail ? { email: initialEmail } : {}),
                  ...(initialDni && initialDni.length === 8
                    ? { identification: { type: "DNI", number: initialDni } }
                    : {}),
                }
              : undefined,
        }}
        customization={{
          paymentMethods: { maxInstallments: 1 },
          visual: {
            hideFormTitle: true,
            hidePaymentButton: false,
            style: {
              theme: "dark",
              customVariables: {
                baseColor: "#7C3AED",
                baseColorFirstVariant: "#A855F7",
                baseColorSecondVariant: "#6D28D9",
                successColor: "#22D17F",
                errorColor: "#FF4D5E",
                warningColor: "#FFCE3B",
                textPrimaryColor: "#FFFFFF",
                textSecondaryColor: "rgba(255,255,255,0.55)",
                inputBackgroundColor: "rgba(255,255,255,0.04)",
                formBackgroundColor: "transparent",
                baseColorTextButton: "#FFFFFF",
                fontSizeExtraSmall: "11px",
                fontSizeSmall: "12px",
                fontSizeMedium: "14px",
                fontSizeLarge: "15px",
                fontWeightNormal: "500",
                fontWeightSemiBold: "700",
                formInputsTextColor: "#FFFFFF",
                formLabelTextColor: "rgba(255,255,255,0.55)",
                formPaddingLeft: "0px",
                formPaddingRight: "0px",
                inputVerticalPadding: "14px",
                inputHorizontalPadding: "14px",
                inputFocusedBoxShadow: "0 0 0 2px rgba(124,58,237,0.45)",
                inputFocusedBorderWidth: "0",
                inputFocusedBorderColor: "#7C3AED",
                borderRadiusSmall: "10px",
                borderRadiusMedium: "12px",
                borderRadiusLarge: "14px",
                borderRadiusFull: "999px",
                buttonTextColor: "#FFFFFF",
              },
            },
          },
        }}
        onSubmit={async (params) => {
          try {
            const res = await fetch("/api/payments/card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                token: params.token,
                paymentMethodId: params.payment_method_id,
                installments: params.installments ?? 1,
                issuerId: params.issuer_id ?? null,
              }),
            });
            const data = (await res.json()) as
              | { ok: true; value: { status: string; message?: string } }
              | { ok: false; error: string };
            if (!data.ok) {
              setLocalError(humanizeCardError(data.error));
              onError?.(data.error);
              return;
            }
            if (data.value.status === "approved" || data.value.status === "in_process") {
              onPaid();
            } else {
              setLocalError(humanizeCardError(data.value.message ?? "rejected"));
              onError?.(data.value.message ?? "rejected");
            }
          } catch (e) {
            const msg = (e as Error).message ?? "card_failed";
            setLocalError(humanizeCardError(msg));
            onError?.(msg);
          }
        }}
        onError={(err) => {
          const msg = typeof err === "string" ? err : (err as { message?: string })?.message ?? "brick_error";
          setLocalError(humanizeCardError(msg));
          onError?.(msg);
        }}
      />

      {localError && (
        <div style={{ fontSize: 12, color: C.red, marginTop: 10, textAlign: "center" }}>
          {localError}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: C.dim, textAlign: "center" }}>
        🔒 Pago seguro · Procesado por Mercado Pago
      </div>
    </div>
  );
}

const humanizeCardError = (raw: string): string => {
  if (raw.includes("cc_rejected_bad_filled_card_number")) return "Número de tarjeta inválido.";
  if (raw.includes("cc_rejected_bad_filled_security_code")) return "CVV inválido.";
  if (raw.includes("cc_rejected_bad_filled_date")) return "Fecha de vencimiento inválida.";
  if (raw.includes("cc_rejected_insufficient_amount")) return "Saldo insuficiente.";
  if (raw.includes("cc_rejected_call_for_authorize")) return "Llamá a tu banco para autorizar.";
  if (raw.includes("cc_rejected_high_risk")) return "Tu banco rechazó el pago por riesgo.";
  if (raw.includes("cc_rejected")) return "Tu banco rechazó el pago.";
  if (raw.includes("rejected")) return "El pago fue rechazado.";
  return raw;
};
