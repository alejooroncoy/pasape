"use client";

// Why: piloto usa OTP "mock" para recuperar tickets perdidos. El código
// se loguea en consola del servidor (y se devuelve en `devCode` en dev)
// para evitar wirear SMS/email infra antes de validar la UX.

import { useState } from "react";
import { BackBtn, Btn, C, CloseBtn, Field, FONT_DISPLAY, FONT_MONO, OtpRow, Phone, StepDots } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/_shared/api-client";

type StartResp = { identifierKind: "phone" | "email"; devCode?: string };
type VerifyResp = {
  profileId: string | null;
  tickets: Array<{ id: string; event: { title: string } }>;
  orderLinks: Array<{ orderId: string; token: string }>;
};

// Milisegundos de espera antes de llevar al usuario al link de la orden encontrada. El perfil que
// resuelve el OTP es un guest sin sesión — por eso NO vamos a /tickets
// (exige login y mostraría la wallet vacía de otra cuenta). En vez de eso,
// aterrizamos en /order/[id]/[token]: la misma ruta que usa la entrega por
// WhatsApp, que pide login y luego reclama la compra a la cuenta logueada.
const REDIRECT_DELAY_MS = 1200;

export default function TicketRecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResp | null>(null);

  const sendCode = async () => {
    setError(null);
    setPending(true);
    try {
      const data = await api.post<StartResp>("/api/tickets/recover/start", { identifier });
      setDevCode(data.devCode ?? null);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    setError(null);
    setPending(true);
    try {
      const data = await api.post<VerifyResp>("/api/tickets/recover/verify", {
        identifier,
        code,
      });
      setResult(data);
      const firstLink = data.orderLinks[0];
      if (firstLink) {
        // Mostramos el resultado inline para feedback inmediato y luego
        // llevamos a la orden encontrada: ahí el login SÍ reclama la compra
        // (claimOrder) en vez de rebotar a una wallet vacía.
        setTimeout(
          () =>
            router.replace(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `/order/${firstLink.orderId}/${firstLink.token}` as any,
            ),
          REDIRECT_DELAY_MS,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="pasape-canvas">
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
          <StepDots step={step} of={2} />
          <CloseBtn />
        </div>

        {step === 0 ? (
          <div style={{ padding: "28px 22px 0" }}>
            <div
              style={{
                fontSize: 11,
                color: C.purple,
                letterSpacing: "0.1em",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              RECUPERAR ENTRADAS
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                marginBottom: 8,
              }}
            >
              ¿Perdiste tu QR?
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 26, lineHeight: 1.5 }}>
              Ingresá el correo o el celular que usaste para comprar.
              Te mandamos un código de 6 dígitos.
            </div>

            <Field
              label="Email o celular"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="juan@gmail.com o 987 654 321"
            />

            {error && (
              <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>{error}</div>
            )}
          </div>
        ) : (
          <div style={{ padding: "28px 22px 0" }}>
            <div
              style={{
                fontSize: 11,
                color: C.purple,
                letterSpacing: "0.1em",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              PASO 2 DE 2
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                marginBottom: 8,
              }}
            >
              Código de<br />recuperación.
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 26, lineHeight: 1.5 }}>
              Mandamos un código a {identifier}.
            </div>

            <OtpRow value={code} onChange={setCode} />

            {devCode && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  color: C.dim,
                  textAlign: "center",
                }}
              >
                dev code: {devCode}
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  color: C.red,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {result && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 14,
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                  background: "rgba(255,255,255,0.03)",
                  fontSize: 13,
                  color: C.dim,
                }}
              >
                {result.tickets.length === 0
                  ? "No encontramos entradas activas con esos datos."
                  : `Encontramos ${result.tickets.length} entrada(s). Llevándote a tus tickets…`}
              </div>
            )}
          </div>
        )}

        <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
          {step === 0 ? (
            <Btn
              onClick={() => void sendCode()}
              disabled={pending || identifier.length < 4}
            >
              {pending ? "Enviando…" : "Enviar código →"}
            </Btn>
          ) : (
            <Btn onClick={() => void verify()} disabled={pending || code.length !== 6}>
              {pending ? "Verificando…" : "Recuperar mis tickets →"}
            </Btn>
          )}
        </div>
      </Phone>
    </div>
  );
}
