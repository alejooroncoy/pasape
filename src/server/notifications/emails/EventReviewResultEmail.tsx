// Resultado de la revisión manual de Pasape sobre un evento (pending_review ->
// published = aprobado, o -> draft con motivo = rechazado). Mismo diseño que
// TicketDeliveryEmail: base clara premium, logo PNG con swap claro/oscuro vía
// prefers-color-scheme (los clientes de correo bloquean SVG — por eso el logo
// no se veía con logo-mark.svg), cabecera centrada y botón de marca.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
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
  { preview: string; heading: React.ReactNode; body: string; cta: string; footer: string }
> = {
  approved: {
    preview: "Tu evento ya está publicado en Pasape",
    heading: (
      <>
        Tu evento fue <strong>aprobado</strong> 🎉
      </>
    ),
    body: "ya está publicado en la cartelera y cualquiera puede verlo y comprar entradas.",
    cta: "Ver mi evento",
    footer: "Comparte el link con tus promotores desde el panel del evento.",
  },
  rejected: {
    preview: "Tu evento necesita un ajuste antes de publicarse",
    heading: (
      <>
        Tu evento necesita un <strong>ajuste</strong>
      </>
    ),
    body: "antes de publicarlo encontramos algo que corregir. Edítalo y vuelve a enviarlo a revisión — no perdiste nada de lo que ya armaste.",
    cta: "Corregir mi evento",
    footer: "Si crees que es un error, responde este correo y lo vemos contigo.",
  },
};

// CSS que sobrevive al <head> (react-email no lo inlina): adaptación a modo
// oscuro para clientes que soportan prefers-color-scheme. Los `!important`
// pisan los estilos inline de la base clara. (Mismo esquema que
// TicketDeliveryEmail.)
const DARK_MODE_CSS = `
  @media (prefers-color-scheme: dark) {
    .p-bg { background:#0f0f16 !important; }
    .p-card { background:#16161f !important; border-color:#26232f !important; }
    .p-wordmark { color:#8e8ea1 !important; }
    .p-ink { color:#ffffff !important; }
    .p-muted { color:#c7c4d2 !important; }
    .p-subtle { color:#8e8ea1 !important; }
    .p-event { background:#1e1830 !important; border-top-color:#3a3550 !important; }
    .p-event-title { color:#ffffff !important; }
    .p-reason { background:#2b2113 !important; }
    .p-reason-label { color:#e0a34d !important; }
    .p-reason-text { color:#e8d5b5 !important; }
    .p-hr { border-color:#26232f !important; }
    .logo-light { display:none !important; }
    .logo-dark { display:inline-block !important; }
  }
`;

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
  const ctaUrl = decision === "approved" ? eventUrl : editUrl;
  // Fallback para renders sin props (ej: `email export`), donde no llega appOrigin.
  const origin = (appOrigin || "https://pasape.lat").replace(/\/$/, "");
  const logoLight = `${origin}/icons/logo-icon-96.png`; // trazo morado — para fondo claro
  const logoDark = `${origin}/icons/logo-icon-dark-96.png`; // trazo blanco — para fondo oscuro

  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_CSS }} />
      </Head>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        {/* Neutro sesgado al morado de marca — no un gris cualquiera. */}
        <Body className="p-bg mx-auto my-auto bg-[#f3f1f8] px-2 font-sans">
          <Preview>{c.preview}</Preview>
          <Container className="p-card mx-auto my-[40px] max-w-[465px] rounded-[16px] border border-[#eae6f2] border-solid bg-white p-[32px]">
            {/* Cabecera de marca: logo + wordmark, como el encabezado de un ticket. */}
            <Section className="text-center">
              <Img
                src={logoLight}
                width="48"
                height="48"
                alt="Pasape"
                className="logo-light mx-auto my-0 inline-block"
              />
              <Img
                src={logoDark}
                width="48"
                height="48"
                alt="Pasape"
                className="logo-dark mx-auto my-0"
                style={{ display: "none" }}
              />
              <Text className="p-wordmark m-0 mt-[8px] text-center font-semibold text-[11px] text-[#9a93a8] uppercase tracking-[0.22em]">
                Pasape
              </Text>
            </Section>

            <Heading className="p-ink mx-0 mt-[28px] mb-[8px] p-0 text-center font-normal text-[24px] text-[#241f2e]">
              {c.heading}
            </Heading>

            <Text className="p-muted mx-0 mt-[4px] mb-[28px] text-center text-[14px] text-[#6b6478] leading-[22px]">
              Hola <strong className="p-ink text-[#241f2e]">{organizerName}</strong>, {c.body}
            </Text>

            {/* Stub del evento: borde superior punteado que evoca la línea de corte. */}
            <Section
              className="p-event rounded-[12px] bg-[#faf9fc] px-[18px] py-[16px]"
              style={{ borderTop: "2px dashed #e4def0" }}
            >
              <Text className="p-event-title m-0 font-semibold text-[15px] text-[#241f2e] leading-[22px]">
                {eventTitle}
              </Text>
              <Text className="p-subtle m-0 mt-[6px] text-[#7a7488] text-[13px] leading-[20px]">
                {decision === "approved" ? "Publicado en Pasape" : "Pendiente de ajustes"}
              </Text>
            </Section>

            {decision === "rejected" && reason && (
              <Section className="p-reason mt-[12px] rounded-[12px] bg-[#fdf3e7] px-[18px] py-[14px]">
                <Text className="p-reason-label m-0 font-semibold text-[11px] text-[#a5691a] uppercase tracking-[0.08em]">
                  Lo que hay que corregir
                </Text>
                <Text className="p-reason-text m-0 mt-[4px] text-[#6b4a12] text-[13.5px] leading-[20px]">
                  {reason}
                </Text>
              </Section>
            )}

            <Section className="mt-[28px] mb-[8px] text-center">
              <Button
                className="rounded-full bg-[#7C3AED] px-8 py-[14px] text-center font-semibold text-[14px] text-white no-underline"
                href={ctaUrl}
              >
                {c.cta}
              </Button>
            </Section>

            <Hr className="p-hr mx-0 mt-[24px] mb-[20px] w-full border border-[#eae6f2] border-solid" />

            <Text className="p-subtle m-0 text-center text-[#9a93a8] text-[12px] leading-[20px]">
              {c.footer}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Sample props para `pnpm email:dev`.
EventReviewResultEmail.PreviewProps = {
  decision: "approved",
  organizerName: "Alejo",
  eventTitle: "Evento Demo Pasape",
  reason: null,
  eventUrl: "https://pasape.lat/es/events/evento-demo",
  editUrl: "https://pasape.lat/es/org/events/evento-demo",
  appOrigin: "https://pasape.lat",
} satisfies EventReviewResultEmailProps;

export default EventReviewResultEmail;
