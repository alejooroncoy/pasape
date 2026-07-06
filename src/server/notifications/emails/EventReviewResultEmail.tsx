// Resultado de la revisión manual de Pasape sobre un evento (pending_review ->
// published = aprobado, o -> draft con motivo = rechazado). Mismo sistema
// react-email + Tailwind que el resto de correos (ver PaymentReviewEmail).

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

export type EventReviewDecision = "approved" | "rejected";

export type EventReviewResultEmailProps = {
  decision: EventReviewDecision;
  organizerName: string;
  eventTitle: string;
  /** Solo aplica a "rejected" — el motivo que escribió Pasape. */
  reason: string | null;
  eventUrl: string;
  editUrl: string;
  appOrigin: string; // ej: https://pasape.lat
};

const COPY: Record<
  EventReviewDecision,
  { preview: string; heading: string; body: string; cta: string }
> = {
  approved: {
    preview: "Tu evento ya está publicado en Pasape",
    heading: "Tu evento fue aprobado 🎉",
    body: "Ya está publicado en la cartelera y cualquiera puede verlo y comprar entradas.",
    cta: "Ver mi evento",
  },
  rejected: {
    preview: "Tu evento necesita un ajuste antes de publicarse",
    heading: "Tu evento necesita un ajuste",
    body: "Antes de publicarlo, encontramos algo que corregir. Edítalo y vuelve a enviarlo a revisión — no perdiste nada de lo que ya armaste.",
    cta: "Corregir mi evento",
  },
};

export function EventReviewResultEmail({
  decision,
  organizerName,
  eventTitle,
  reason,
  eventUrl,
  editUrl,
  appOrigin,
}: EventReviewResultEmailProps) {
  const c = COPY[decision];
  const accent = decision === "approved" ? "#22a866" : "#e08a1f";
  const ctaUrl = decision === "approved" ? eventUrl : editUrl;
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
              {eventTitle}
            </Text>
            <Text className="m-0 text-[14.5px] leading-[1.55] text-[#4a4458]">
              Hola {organizerName}, {c.body}
            </Text>
            {decision === "rejected" && reason && (
              <Section className="mt-[16px] rounded-[12px] bg-[#fdf3e7] px-[16px] py-[13px]">
                <Text className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a5691a]">
                  Lo que hay que corregir
                </Text>
                <Text className="mt-[4px] mb-0 text-[13.5px] leading-[1.5] text-[#6b4a12]">
                  {reason}
                </Text>
              </Section>
            )}
            <Section className="mt-[24px]">
              <Button
                href={ctaUrl}
                className="rounded-full px-[22px] py-[13px] text-[14px] font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                {c.cta}
              </Button>
            </Section>
            <Text className="mt-[22px] mb-0 text-[12.5px] leading-[1.5] text-[#8a819c]">
              {decision === "approved"
                ? "Comparte el link con tus promotores desde el panel del evento."
                : "Si crees que es un error, responde este correo y lo vemos contigo."}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EventReviewResultEmail;
