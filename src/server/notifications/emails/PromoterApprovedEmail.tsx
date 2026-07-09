// Correo que le llega al promotor cuando el organizador aprueba su solicitud.
// Cierra el flujo de /apply → en revisión → aprobado: sin esto, un postulante
// que cerró la pestaña nunca se enteraba (el realtime solo funciona con la
// pantalla abierta). Light theme, mismo branding que InviteEmail.

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

export type PromoterApprovedEmailProps = {
  promoterName: string | null;
  orgName: string;
  eventTitle: string;
  panelUrl: string; // .../es/promo
  shareUrl: string; // .../r/{code}
  appOrigin: string; // ej: https://pasape.lat
};

export function PromoterApprovedEmail({
  promoterName,
  orgName,
  eventTitle,
  panelUrl,
  shareUrl,
  appOrigin,
}: PromoterApprovedEmailProps) {
  const name = promoterName?.trim() || "Promotor";
  const previewText = `${orgName} te aprobó como promotor de ${eventTitle}`;
  const logoUrl = `${appOrigin.replace(/\/$/, "")}/icons/logo-icon-min-72.png`;

  return (
    <Html lang="es">
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Section className="mt-[32px]">
              <Img
                src={logoUrl}
                width="40"
                height="40"
                alt="Pasape"
                className="mx-auto my-0"
              />
            </Section>

            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              ¡Te aprobaron! Ya eres promotor de <strong>{orgName}</strong>
            </Heading>

            <Text className="text-[14px] text-black leading-[24px]">Hola {name},</Text>
            <Text className="text-[14px] text-black leading-[24px]">
              <strong>{orgName}</strong> aprobó tu solicitud para{" "}
              <strong>{eventTitle}</strong>. Ya puedes empezar a vender y ganar tu comisión.
            </Text>

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded-full bg-[#7C3AED] px-6 py-3 text-center font-semibold text-[14px] text-white no-underline"
                href={panelUrl}
              >
                Abrir mi panel de promotor
              </Button>
            </Section>

            <Text className="text-[14px] text-black leading-[24px]">
              Este es tu link de venta — compártelo para que compren con tu código:{" "}
              <Link href={shareUrl} className="text-[#7C3AED] no-underline">
                {shareUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>

            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />

            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Desde tu panel puedes copiar tu link, ver cuántas entradas vendiste y seguir
              tus metas. Si no esperabas este correo, ignóralo.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Sample props para `pnpm email:dev`.
PromoterApprovedEmail.PreviewProps = {
  promoterName: "Alejo",
  orgName: "Furtivo",
  eventTitle: "Noche de Verano",
  panelUrl: "https://pasape.lat/es/promo",
  shareUrl: "https://pasape.lat/r/alejandro-ec04",
  appOrigin: "https://pasape.lat",
} satisfies PromoterApprovedEmailProps;

export default PromoterApprovedEmail;
