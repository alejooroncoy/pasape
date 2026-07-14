// Aviso interno a Pasape cuando un organizador cancela un evento publicado —
// ver NotifyEventCancelled.ts. La cancelación en sí no dispara ningún
// reembolso automático (solo notifica a los compradores in-app) — este
// correo es la señal para que el equipo ejecute el plan de reembolso a mano.

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

export type EventCancelledEmailProps = {
  eventTitle: string;
  orgName: string;
  paidOrdersCount: number;
  totalAmount: string; // ya formateado, ej. "S/ 1,230.00"
};

export function EventCancelledEmail({
  eventTitle,
  orgName,
  paidOrdersCount,
  totalAmount,
}: EventCancelledEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Evento cancelado: "${eventTitle}" — ${paidOrdersCount} órdenes pagadas`}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#0A0A0F] font-sans">
          <Container className="mx-auto my-[24px] w-[640px] max-w-full rounded-[16px] bg-[#140C28] p-[28px]">
            <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#f43f5e]">
              Evento cancelado
            </Text>
            <Heading className="m-0 mt-[6px] text-[22px] font-bold text-white">
              {eventTitle}
            </Heading>
            <Text className="mt-[4px] mb-[18px] text-[14px] text-white/70">
              {orgName} canceló este evento. A los compradores ya les llegó un aviso in-app, pero
              ningún reembolso se dispara solo — hay que ejecutar el plan de reembolso a mano.
            </Text>
            <Section className="mt-[8px] rounded-[10px] border-t border-white/10 pt-[16px]">
              <Text className="m-0 text-[13px] text-white/60">
                Órdenes pagadas afectadas:{" "}
                <span className="font-semibold text-white">{paidOrdersCount}</span>
              </Text>
              <Text className="m-0 text-[13px] text-white/60">
                Monto total en juego:{" "}
                <span className="font-semibold text-white">{totalAmount}</span>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EventCancelledEmail;
