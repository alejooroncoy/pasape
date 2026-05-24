"use client";

import { use } from "react";
import {
  BackBtn,
  Btn,
  C,
  Dot,
  FONT_DISPLAY,
  Phone,
  StepDots,
} from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ reason?: string }>;
};

export default function BuyerPayErrorPage({ params, searchParams }: Props) {
  const { slug } = use(params);
  const sp = searchParams ? use(searchParams) : undefined;
  const router = useRouter();
  const { data } = useEvent(slug);

  const reason =
    sp?.reason ?? `Yape dice "saldo insuficiente"`;

  const remaining = data?.ticketTypes.reduce((sum, tt) => sum + (tt.capacity - tt.sold), 0) ?? null;

  const retry = () =>
    router.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      `/events/${slug}/buy` as any,
    );

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <StepDots step={2} of={3} />
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "20px 22px" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: C.redSoft,
            boxShadow: `0 0 0 1px ${C.red} inset, 0 0 30px rgba(255,77,94,0.3)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28">
            <path
              d="M7 7l14 14M21 7L7 21"
              stroke={C.red}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginTop: 18,
            lineHeight: 1.1,
          }}
        >
          No pudimos
          <br />
          cobrarte
        </div>
        <div style={{ fontSize: 15, color: C.dim, marginTop: 10, lineHeight: 1.5 }}>
          {reason}.
          <br />
          Tu entrada NO ha sido cobrada.
        </div>

        <div
          style={{
            marginTop: 22,
            padding: "14px 16px",
            background: C.bg2,
            borderRadius: 16,
            boxShadow: `0 0 0 1px ${C.line} inset`,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
          }}
        >
          <span style={{ color: C.dim }}>Intentar otra vez</span>
          <span style={{ textAlign: "right" }}>No se descuenta nada hasta que confirmes</span>
        </div>

        {remaining != null && remaining > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              background: C.bg2,
              borderRadius: 16,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Dot color={C.yellow} />
            <div style={{ fontSize: 13, color: C.dim }}>
              Quedan <strong style={{ color: "#fff" }}>{remaining} entradas</strong> — apúrate antes que se agoten
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 390,
          padding: "0 22px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Btn onClick={retry}>Intentar de nuevo</Btn>
        <Btn kind="secondary" onClick={retry}>
          Pagar con tarjeta
        </Btn>
      </div>
    </Phone>
  );
}
