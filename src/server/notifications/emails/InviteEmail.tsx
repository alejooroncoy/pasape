// Adaptación del template oficial de Vercel para react-email
// (apps/demo/emails/Community/notifications/vercel-invite-user.tsx) —
// reemplazado branding, copy en español, scope-aware. Light theme.

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

export type InviteEmailProps = {
  inviterName: string | null;
  scopeLabel: string; // Nombre de la marca, razón social o portafolio del organizador
  roleLabel: string;  // "Administrador" | "Editor" | "Solo lectura" | "Puerta"
  inviteUrl: string;
  expiresAt: string;  // ISO
  appOrigin: string;  // ej: https://pasape.lat o http://localhost:3001
};

const formatExpiry = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "long",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export function InviteEmail({
  inviterName,
  scopeLabel,
  roleLabel,
  inviteUrl,
  expiresAt,
  appOrigin,
}: InviteEmailProps) {
  const inviter = inviterName?.trim() || "Tu invitador";
  const previewText = `${inviter} te invitó a ${scopeLabel} en Pasape`;
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
              Únete a <strong>{scopeLabel}</strong> en <strong>Pasape</strong>
            </Heading>

            <Text className="text-[14px] text-black leading-[24px]">
              Hola,
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              <strong>{inviter}</strong> te invitó a sumarte a{" "}
              <strong>{scopeLabel}</strong> como{" "}
              <strong>{roleLabel}</strong> en <strong>Pasape</strong>.
            </Text>

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded-full bg-[#7C3AED] px-6 py-3 text-center font-semibold text-[14px] text-white no-underline"
                href={inviteUrl}
              >
                Aceptar invitación
              </Button>
            </Section>

            <Text className="text-[14px] text-black leading-[24px]">
              O copia y pega esta URL en tu navegador:{" "}
              <Link href={inviteUrl} className="text-[#7C3AED] no-underline">
                {inviteUrl}
              </Link>
            </Text>

            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />

            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Esta invitación caduca el{" "}
              <span className="text-black">{formatExpiry(expiresAt)}</span>. Si no esperabas
              este correo, ignóralo — no haremos nada hasta que abras el link. Si te
              preocupa la seguridad de tu cuenta, respóndenos a este correo y nos ponemos
              en contacto.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Sample props para `pnpm email:dev`.
InviteEmail.PreviewProps = {
  inviterName: "Mari",
  scopeLabel: "Furtivo",
  roleLabel: "Administrador",
  inviteUrl: "https://pasape.lat/es/invites/abc123def456",
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  appOrigin: "https://pasape.lat",
} satisfies InviteEmailProps;

export default InviteEmail;
