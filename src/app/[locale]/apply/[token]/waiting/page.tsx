"use client";

import { use, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { C } from "@/components/design";
import {
  PromoBody,
  PromoEyebrow,
  PromoFeedback,
  PromoGhostLink,
  PromoPill,
  PromoStatusContent,
  PromoStatusIcon,
  PromoStatusLayout,
  PromoTitle,
} from "@/components/promoters/PromoInviteUI";
import { PromoInviteShell } from "@/components/promoters/PromoInviteShell";
import { useResolveInvite, useApplicationStatus, useRealtimePromoterApplications } from "@/lib/promoters/hooks/usePromoter";

type Props = { params: Promise<{ token: string }> };

export default function PromoAppliedWaitingPage({ params }: Props) {
  const { token } = use(params);
  const resolved = useResolveInvite(token);
  const status = useApplicationStatus(resolved.data?.eventSlug ?? "");
  useRealtimePromoterApplications(resolved.data?.eventSlug ?? "");
  const router = useRouter();

  useEffect(() => {
    if (status.data?.status === "approved") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace("/promo/accepted" as any);
    }
  }, [status.data?.status, router]);

  const goHome = () => router.push("/" as never);

  if (resolved.isLoading) {
    return (
      <PromoInviteShell>
        <PromoFeedback
          variant="loading"
          eyebrow="◆ EN ESPERA"
          title="Verificando tu solicitud…"
          footer={<PromoGhostLink onClick={goHome}>Volver a inicio</PromoGhostLink>}
        />
      </PromoInviteShell>
    );
  }

  if (resolved.error || !resolved.data) {
    return (
      <PromoInviteShell>
        <PromoFeedback
          variant="error"
          eyebrow="◆ LINK INVÁLIDO"
          title="Esta invitación no es válida."
          body="Si ya enviaste tu postulación, espera el WhatsApp del organizador."
          footer={<PromoGhostLink onClick={goHome}>Volver a inicio</PromoGhostLink>}
        />
      </PromoInviteShell>
    );
  }

  const isClosedOut = status.data?.status === "rejected" || status.data?.status === "cancelled";

  return (
    <PromoInviteShell>
      <PromoStatusLayout
        glow={isClosedOut ? "neutral" : "yellow"}
        footer={<PromoGhostLink onClick={goHome}>Volver a inicio</PromoGhostLink>}
      >
        <PromoStatusContent>
          <PromoStatusIcon variant={isClosedOut ? "rejected" : "waiting"} />

          {isClosedOut ? (
            <>
              <PromoEyebrow color={C.dim}>◆ SOLICITUD CERRADA</PromoEyebrow>
              <PromoTitle>
                El organizador no
                <br />
                aprobó tu solicitud esta vez.
              </PromoTitle>
              <PromoBody>
                No te va a llegar el link de venta para este evento. Puedes postular a otro evento cuando quieras.
              </PromoBody>
            </>
          ) : (
            <>
              <PromoEyebrow color={C.yellow}>◆ EN ESPERA</PromoEyebrow>
              <PromoTitle>
                Tu solicitud
                <br />
                ya está en revisión.
              </PromoTitle>
              <PromoBody>
                En cuanto te aprueben, vas a poder vender desde el panel de promotor con tu link único.
              </PromoBody>
              <PromoPill>Suele responder en 1-2 horas</PromoPill>
            </>
          )}
        </PromoStatusContent>
      </PromoStatusLayout>
    </PromoInviteShell>
  );
}
