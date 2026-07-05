// Aviso de estado de pago: "en revisión" (in_process de MP) o "rechazado".
// Base clara y sobria (renderiza consistente en todos los clientes). Mismo
// sistema react-email + Tailwind que el resto de correos.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export type PaymentReviewKind = "in_review" | "rejected";

export type PaymentReviewEmailProps = {
  kind: PaymentReviewKind;
  holderName: string;
  eventTitle: string;
  eventStartsAt: string; // ISO
  retryUrl: string;
  appOrigin: string; // ej: https://pasape.lat
};

const formatStartsAt = (iso: string): string => {
  try {
    const s = new Intl.DateTimeFormat("es-PE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
};

const COPY: Record<
  PaymentReviewKind,
  { preview: string; heading: string; body: string; cta: string; note: string }
> = {
  in_review: {
    preview: "Tu pago está en revisión — así aseguras tu entrada",
    heading: "Tu pago está en revisión",
    body: "Tu banco todavía no confirmó el pago (a veces tarda hasta un par de días). Ya guardamos tu lugar. Apenas lo apruebe, te llega tu QR y aparece en Mis entradas.",
    cta: "Pagar con otra tarjeta o Yape",
    note: "¿Prefieres esperar? Perfecto. Si quieres asegurar tu entrada ya, respóndenos este correo con una captura donde se vea el monto preautorizado en tu tarjeta y lo tenemos en cuenta el día del evento.",
  },
  rejected: {
    preview: "Tu pago no se confirmó — vuelve a intentarlo",
    heading: "No pudimos confirmar tu pago",
    body: "Tu banco rechazó el pago, así que tu entrada quedó en pausa. No te cobramos nada. Puedes volver a intentarlo con otra tarjeta o con Yape en un toque.",
    cta: "Volver a intentar",
    note: "Si crees que es un error, respóndenos este correo y lo revisamos contigo.",
  },
};

export function PaymentReviewEmail({
  kind,
  holderName,
  eventTitle,
  eventStartsAt,
  retryUrl,
  appOrigin,
}: PaymentReviewEmailProps) {
  const c = COPY[kind];
  const accent = kind === "rejected" ? "#e11d48" : "#d97706";
  return (
    <Html lang="es">
      <Head />
      <Preview>{c.preview}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#f4f2f8] font-sans">
          <Container className="mx-auto my-[24px] w-[440px] max-w-full rounded-[18px] bg-white p-[32px]">
            <Img
              src={`${appOrigin}/icons/logo-mark.svg`}
              width="40"
              height="40"
              alt="Pasape"
              className="mb-[20px]"
            />
            <Heading className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#141019]">
              {c.heading}
            </Heading>
            <Text className="mt-[6px] mb-[18px] text-[13px] font-semibold" style={{ color: accent }}>
              {eventTitle} · {formatStartsAt(eventStartsAt)}
            </Text>
            <Text className="m-0 text-[14.5px] leading-[1.55] text-[#4a4458]">
              Hola {holderName}, {c.body}
            </Text>
            <Section className="mt-[24px]">
              <Button
                href={retryUrl}
                className="rounded-full bg-[#7c3aed] px-[22px] py-[13px] text-[14px] font-semibold text-white"
              >
                {c.cta}
              </Button>
            </Section>
            <Text className="mt-[22px] mb-0 text-[12.5px] leading-[1.5] text-[#8a819c]">
              {c.note}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default PaymentReviewEmail;
