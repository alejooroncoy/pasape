// Aviso interno a Pasape cuando un evento cae en pending_review por primera
// vez — ver NotifyPendingReview.ts / AGENTS.md / [[review-eventos-pending]].
// Mismo sistema react-email + Tailwind que el resto de correos (ver
// EventReviewResultEmail, PaymentReviewEmail).

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export type EventPendingReviewEmailProps = {
  eventTitle: string;
  orgName: string;
  panelUrl: string;
  /** Prompt operativo listo para pegar en Claude Code — ver buildPrompt en NotifyPendingReview.ts. */
  prompt: string;
};

export function EventPendingReviewEmail({
  eventTitle,
  orgName,
  panelUrl,
  prompt,
}: EventPendingReviewEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Evento pendiente de revisión: "${eventTitle}"`}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#0A0A0F] font-sans">
          <Container className="mx-auto my-[24px] w-[640px] max-w-full rounded-[16px] bg-[#140C28] p-[28px]">
            <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8aa0]">
              Evento pendiente de revisión
            </Text>
            <Heading className="m-0 mt-[6px] text-[22px] font-bold text-white">
              {eventTitle}
            </Heading>
            <Text className="mt-[4px] mb-[18px] text-[14px] text-white/70">
              {orgName} envió este evento a revisión. No es público hasta que alguien lo apruebe
              manualmente (<code>events.status</code> → <code>published</code>) en Supabase.
            </Text>
            <Text className="m-0 text-[13px] text-white/60">
              Panel del organizador:{" "}
              <Link href={panelUrl} className="text-[#B87CFF]">
                {panelUrl}
              </Link>
            </Text>
            <Section className="mt-[20px] rounded-[10px] border-t border-white/10 pt-[16px]">
              <Text className="m-0 mb-[8px] text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a8aa0]">
                Prompt para copiar en Claude Code
              </Text>
              <Text
                className="m-0 whitespace-pre-wrap rounded-[10px] bg-[#0A0A0F] p-[14px] text-[12.5px] leading-[1.5] text-[#e4e4f0]"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                {prompt}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EventPendingReviewEmail;
