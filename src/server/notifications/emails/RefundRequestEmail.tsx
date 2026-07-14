// Aviso interno a Pasape cuando un comprador solicita reembolso desde "Mis
// entradas" — ver RequestRefund.ts. El reembolso NO se procesa automático:
// este correo es el único disparador, el equipo lo resuelve a mano (Yape/Plin
// o el mecanismo de MP que corresponda) y marca refunds.status = 'processed'
// en Supabase. Mismo sistema react-email + Tailwind que el resto de correos.

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export type RefundRequestEmailProps = {
  eventTitle: string;
  amount: string; // ya formateado, ej. "S/ 45.00"
  reason: string;
  buyerName: string | null;
  buyerEmail: string | null;
  orderId: string;
};

export function RefundRequestEmail({
  eventTitle,
  amount,
  reason,
  buyerName,
  buyerEmail,
  orderId,
}: RefundRequestEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Solicitud de reembolso: "${eventTitle}" — ${amount}`}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#0A0A0F] font-sans">
          <Container className="mx-auto my-[24px] w-[640px] max-w-full rounded-[16px] bg-[#140C28] p-[28px]">
            <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8aa0]">
              Solicitud de reembolso
            </Text>
            <Heading className="m-0 mt-[6px] text-[22px] font-bold text-white">
              {eventTitle}
            </Heading>
            <Text className="mt-[4px] mb-[18px] text-[14px] text-white/70">
              {buyerName ?? "Un comprador"} pidió reembolso de{" "}
              <span className="font-semibold text-white">{amount}</span>. No se procesa
              automático — resuélvelo a mano y marca{" "}
              <code>refunds.status → &apos;processed&apos;</code> en Supabase cuando esté hecho.
            </Text>
            <Section className="mt-[8px] rounded-[10px] border-t border-white/10 pt-[16px]">
              <Text className="m-0 mb-[4px] text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a8aa0]">
                Motivo
              </Text>
              <Text className="m-0 mb-[16px] text-[14px] leading-[1.5] text-white/85">
                {reason}
              </Text>
              <Text className="m-0 text-[13px] text-white/60">
                Comprador: {buyerName ?? "(sin nombre)"}
                {buyerEmail ? ` · ${buyerEmail}` : ""}
              </Text>
              <Text className="m-0 text-[13px] text-white/60">Orden: {orderId}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default RefundRequestEmail;
