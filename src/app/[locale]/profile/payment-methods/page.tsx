"use client";

import { BackBtn, C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

const maskPhone = (phone: string | null) => {
  if (!phone) return "+51 ··· ··· ···";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const last3 = digits.slice(-3);
  const cc = digits.startsWith("51") ? "+51" : `+${digits.slice(0, digits.length - 9 || 2)}`;
  return `${cc} ··· ··· ${last3}`;
};

const CardRow = ({ brand, last, type }: { brand: "Visa" | "Mastercard"; last: string; type: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      marginBottom: 8,
      background: "rgba(255,255,255,0.04)",
      borderRadius: 14,
      boxShadow: `0 0 0 1px ${C.line} inset`,
    }}
  >
    <div
      style={{
        width: 42,
        height: 30,
        borderRadius: 6,
        background:
          brand === "Visa"
            ? "#1A1F71"
            : "linear-gradient(90deg, #EB001B 0%, #EB001B 45%, #F79E1B 55%, #F79E1B 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 9,
        color: "#fff",
        letterSpacing: "0.04em",
      }}
    >
      {brand === "Visa" ? "VISA" : ""}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>·· ·· ·· {last}</div>
      <div style={{ fontSize: 11, color: C.dim }}>
        {brand} · {type}
      </div>
    </div>
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="3" cy="9" r="1.4" fill="rgba(255,255,255,0.4)" />
      <circle cx="9" cy="9" r="1.4" fill="rgba(255,255,255,0.4)" />
      <circle cx="15" cy="9" r="1.4" fill="rgba(255,255,255,0.4)" />
    </svg>
  </div>
);

export default function BuyerPaymentMethodsPage() {
  const { data } = useCurrentUser();
  const phone = data?.user?.phone ?? null;

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>MÉTODOS DE PAGO</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "14px 22px" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Pagás con un toque.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>
          Nunca guardamos tu CVV ni clave Yape.
        </div>

        <div
          style={{
            marginTop: 22,
            padding: 18,
            borderRadius: 20,
            overflow: "hidden",
            position: "relative",
            background: "linear-gradient(135deg, #5C2D91 0%, #3E1B62 100%)",
            boxShadow: `0 0 0 1.5px ${C.purple} inset, 0 20px 40px -10px rgba(124,58,237,0.4)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 120,
              height: 120,
              borderRadius: 999,
              background: "radial-gradient(closest-side, rgba(255,255,255,0.18), transparent 70%)",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                Yape
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>preferido</div>
            </div>
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(34,209,127,0.2)",
                color: C.green,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              ● ACTIVO
            </div>
          </div>
          <div
            style={{
              marginTop: 22,
              fontFamily: FONT_MONO,
              fontSize: 18,
              letterSpacing: "0.04em",
              position: "relative",
            }}
          >
            {maskPhone(phone)}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          TARJETAS
        </div>
        <CardRow brand="Visa" last="1244" type="débito" />
        <CardRow brand="Mastercard" last="8830" type="crédito" />

        <button
          type="button"
          disabled
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: 0,
            background: "transparent",
            boxShadow: `0 0 0 1.5px ${C.purple} inset`,
            color: C.purple,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 8,
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          + Agregar método
        </button>
      </div>
    </Phone>
  );
}
