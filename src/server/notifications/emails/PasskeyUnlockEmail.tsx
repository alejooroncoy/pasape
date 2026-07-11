// Template del código de "desbloqueo de dispositivo" para login con passkey —
// mismo sistema y paleta que RecoveryOtpEmail, copy distinto (no es
// recuperación de entradas, es la primera vez que este dispositivo entra).

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export type PasskeyUnlockEmailProps = {
  code: string;
  ttlMinutes: number;
  appOrigin: string; // ej: https://pasape.lat
};

const DARK_MODE_CSS = `
  @media (prefers-color-scheme: dark) {
    .p-bg { background:#0f0f16 !important; }
    .p-card { background:#16161f !important; border-color:#26232f !important; }
    .p-wordmark { color:#8e8ea1 !important; }
    .p-ink { color:#ffffff !important; }
    .p-muted { color:#c7c4d2 !important; }
    .p-subtle { color:#8e8ea1 !important; }
    .p-code { background:#1e1830 !important; border-color:#3a3550 !important; color:#ffffff !important; }
    .p-hr { border-color:#26232f !important; }
    .logo-light { display:none !important; }
    .logo-dark { display:inline-block !important; }
  }
`;

export function PasskeyUnlockEmail({ code, ttlMinutes, appOrigin }: PasskeyUnlockEmailProps) {
  const origin = (appOrigin || "https://pasape.lat").replace(/\/$/, "");
  const logoLight = `${origin}/icons/logo-icon-96.png`;
  const logoDark = `${origin}/icons/logo-icon-dark-96.png`;
  const spacedCode = code.split("").join(" ");

  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_CSS }} />
      </Head>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="p-bg mx-auto my-auto bg-[#f3f1f8] px-2 font-sans">
          <Container className="p-card mx-auto my-[40px] max-w-[465px] rounded-[16px] border border-[#eae6f2] border-solid bg-white p-[32px]">
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
              Tu código para <strong>entrar</strong>
            </Heading>

            <Text className="p-muted mx-0 mt-[4px] mb-[28px] text-center text-[14px] text-[#6b6478] leading-[22px]">
              Úsalo para desbloquear este dispositivo. Solo tienes que hacerlo una vez.
            </Text>

            <Section
              className="p-code rounded-[12px] border border-[#eae6f2] border-solid bg-[#faf9fc] py-[20px] text-center"
            >
              <Text className="p-ink m-0 font-mono font-semibold text-[32px] text-[#241f2e] tracking-[0.3em]">
                {spacedCode}
              </Text>
            </Section>

            <Text className="p-subtle m-0 mt-[16px] text-center text-[#7a7488] text-[13px] leading-[20px]">
              Vence en {ttlMinutes} minutos.
            </Text>

            <Hr className="p-hr mx-0 mt-[28px] mb-[20px] w-full border border-[#eae6f2] border-solid" />

            <Text className="p-subtle m-0 text-[#9a93a8] text-[12px] leading-[20px]">
              Si no pediste este código, ignora este correo — tu cuenta sigue segura.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

PasskeyUnlockEmail.PreviewProps = {
  code: "482913",
  ttlMinutes: 10,
  appOrigin: "https://pasape.lat",
} satisfies PasskeyUnlockEmailProps;

export default PasskeyUnlockEmail;
