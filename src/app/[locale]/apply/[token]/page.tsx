"use client";

import { use, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Btn, C, Field, FONT_DISPLAY, PhoneField } from "@/components/design";
import {
  PromoCallout,
  PromoFeedback,
  PromoGhostLink,
  PromoHeroBanner,
} from "@/components/promoters/PromoInviteUI";
import { PromoInviteFooter, PromoInviteShell } from "@/components/promoters/PromoInviteShell";
import { useApplyByLink, useResolveInvite } from "@/lib/promoters/hooks/usePromoter";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";

function commissionPitch(pct: number, config: CommissionConfig): string {
  const hasMetas = !!config && config.milestones.length > 0;
  if (pct > 0 && hasMetas) return `y gana ${pct}% por venta y premios al llegar a tus metas.`;
  if (pct > 0) return `y gana ${pct}% por cada entrada que vendas.`;
  if (hasMetas) return "y gana premios al llegar a tus metas de venta.";
  return "El organizador definirá la comisión muy pronto.";
}

type Props = { params: Promise<{ token: string }> };

export default function PromoApplyByLinkPage({ params }: Props) {
  const { token } = use(params);
  const resolved = useResolveInvite(token);
  const apply = useApplyByLink();
  const me = useCurrentUser();
  const router = useRouter();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const name = nameDraft ?? me.data?.user?.fullName ?? "";
  const phone = phoneDraft ?? me.data?.user?.phone ?? "";

  const goHome = () => router.push("/" as never);

  const onApply = async () => {
    if (!resolved.data) return;
    await apply.mutateAsync({
      token,
      message: phone ? `WhatsApp: ${phone}` : null,
      fullName: name.trim() || null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/apply/${token}/waiting` as any);
  };

  if (resolved.isLoading) {
    return (
      <PromoInviteShell>
        <PromoFeedback
          variant="loading"
          eyebrow="◆ CARGANDO"
          title="Preparando tu invitación…"
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
          body="Pídele al organizador un link nuevo o revisa que lo hayas copiado completo."
          footer={<PromoGhostLink onClick={goHome}>Volver a inicio</PromoGhostLink>}
        />
      </PromoInviteShell>
    );
  }

  const data = resolved.data;

  return (
    <PromoInviteShell>
      <PromoHeroBanner />

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="flex-1 px-[22px] pb-4 pt-[230px]">
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.purple, fontWeight: 700, marginBottom: 10 }}>
            ★ TE INVITAN A SER PROMOTOR
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            Vende para <span style={{ color: C.purple }}>{data.orgName}</span>
            <br />
            {commissionPitch(data.commissionPct, data.commissionConfig)}
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>{data.eventTitle}</div>

          <PromoCallout>El organizador revisa tu solicitud y te avisa por WhatsApp.</PromoCallout>

          <div style={{ marginTop: 18 }}>
            <Field
              label="Tu nombre"
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              active={name.length > 0}
            />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dimmer, letterSpacing: "0.06em", marginBottom: 6 }}>
                WHATSAPP
              </div>
              <PhoneField value={phone} onChange={(v) => setPhoneDraft(v)} />
              <div style={{ fontSize: 11, color: C.dimmer, marginTop: 6 }}>Por aquí te avisan si te aprueban.</div>
            </div>
          </div>

          {apply.error && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 12,
                background: C.redSoft,
                boxShadow: `0 0 0 1px rgba(255,77,94,0.25) inset`,
                fontSize: 12,
                color: C.red,
              }}
            >
              {(apply.error as Error).message}
            </div>
          )}
        </div>

        <PromoInviteFooter>
          <Btn onClick={onApply} disabled={apply.isPending || !name.trim()}>
            {apply.isPending ? "Enviando…" : "Quiero ser promotor"}
          </Btn>
        </PromoInviteFooter>
      </div>
    </PromoInviteShell>
  );
}
