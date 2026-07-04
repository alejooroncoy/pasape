// Template de entrega de entrada — mismo sistema (react-email + Tailwind) que
// InviteEmail. Base clara y elegante (renderiza consistente en todos los
// clientes) con adaptación a modo oscuro vía `prefers-color-scheme` para los
// clientes que lo soportan (Apple Mail, iOS): cambia paleta y hace swap del
// logo (trazo morado sobre claro → trazo blanco sobre oscuro).
//
// Gmail/Outlook ignoran prefers-color-scheme, así que ven la base clara — que
// es exactamente lo que queremos: consistente y premium.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export type TicketDeliveryEmailProps = {
  holderName: string;
  eventTitle: string;
  eventStartsAt: string; // ISO
  eventVenue: string | null;
  ticketUrl: string;
  walletSignupUrl: string;
  appOrigin: string; // ej: https://pasape.lat
};

const formatStartsAt = (iso: string): string => {
  try {
    const s = new Intl.DateTimeFormat("es-PE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
    // Intl devuelve "sábado, 11 de julio…" en minúscula; en el correo va con mayúscula inicial.
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
};

// CSS que sobrevive al <head> (react-email no lo inlina): adaptación a modo
// oscuro para clientes que soportan prefers-color-scheme. Los `!important`
// pisan los estilos inline de la base clara.
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
    .p-link { color:#b87cff !important; }
    .p-hr { border-color:#26232f !important; }
    .logo-light { display:none !important; }
    .logo-dark { display:inline-block !important; }
  }
`;

export function TicketDeliveryEmail({
  holderName,
  eventTitle,
  eventStartsAt,
  eventVenue,
  ticketUrl,
  walletSignupUrl,
  appOrigin,
}: TicketDeliveryEmailProps) {
  const previewText = `Tu entrada para ${eventTitle} ya está lista`;
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
          <Preview>{previewText}</Preview>
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
              Tu entrada está <strong>lista</strong>
            </Heading>

            <Text className="p-muted mx-0 mt-[4px] mb-[28px] text-center text-[14px] text-[#6b6478] leading-[22px]">
              Hola <strong className="p-ink text-[#241f2e]">{holderName}</strong>, ya
              puedes acceder a tu entrada para el evento.
            </Text>

            {/* Stub del ticket: borde superior punteado que evoca la línea de corte. */}
            <Section
              className="p-event rounded-[12px] bg-[#faf9fc] px-[18px] py-[16px]"
              style={{ borderTop: "2px dashed #e4def0" }}
            >
              <Text className="p-event-title m-0 font-semibold text-[15px] text-[#241f2e] leading-[22px]">
                {eventTitle}
              </Text>
              <Text className="p-subtle m-0 mt-[6px] text-[#7a7488] text-[13px] leading-[20px]">
                {formatStartsAt(eventStartsAt)}
              </Text>
              {eventVenue ? (
                <Text className="p-subtle m-0 mt-[2px] text-[#7a7488] text-[13px] leading-[20px]">
                  {eventVenue}
                </Text>
              ) : null}
            </Section>

            <Section className="mt-[28px] mb-[16px] text-center">
              <Button
                className="rounded-full bg-[#7C3AED] px-8 py-[14px] text-center font-semibold text-[14px] text-white no-underline"
                href={ticketUrl}
              >
                Ver mi entrada
              </Button>
            </Section>

            <Text className="m-0 text-center text-[13px] leading-[22px]">
              <Link href={walletSignupUrl} className="p-link text-[#7C3AED] no-underline">
                Guardar mis entradas en Pasape
              </Link>
            </Text>

            <Hr className="p-hr mx-0 mt-[28px] mb-[20px] w-full border border-[#eae6f2] border-solid" />

            <Text className="p-subtle m-0 text-[#9a93a8] text-[12px] leading-[20px]">
              Muestra el QR directamente desde la página de tu entrada. No le tomes
              captura de pantalla — el QR cambia cada pocos segundos y una captura no
              sirve en la puerta.
            </Text>
            <Text className="p-subtle m-0 mt-[10px] text-[#9a93a8] text-[12px] leading-[20px]">
              ¿No abre el botón? Copia este enlace:{" "}
              <Link href={ticketUrl} className="p-link text-[#7C3AED] no-underline">
                {ticketUrl}
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Sample props para `pnpm email:dev`.
TicketDeliveryEmail.PreviewProps = {
  holderName: "María",
  eventTitle: "Evento Demo Pasape",
  eventStartsAt: "2026-07-12T03:00:00.000Z",
  eventVenue: "Barranco, Lima",
  ticketUrl: "https://pasape.lat/es/order/abc123/tok456",
  walletSignupUrl: "https://pasape.lat/es/login?next=/es/tickets",
  appOrigin: "https://pasape.lat",
} satisfies TicketDeliveryEmailProps;

export default TicketDeliveryEmail;
