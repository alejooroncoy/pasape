"use client";

import { use, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Btn, C, Field, FONT_DISPLAY, Phone } from "@/components/design";
import { useApplyByLink, useResolveInvite } from "@/lib/promoters/hooks/usePromoter";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import type { CommissionConfig, CommissionType } from "@/server/promoters/domain/OrgPromoter";

// Pitch de comisión según el esquema REAL del evento (heredado). Si el
// organizador aún no definió nada, no inventamos un número: avisamos que está
// por definir (mismo criterio que la vista del promotor).
function commissionPitch(type: CommissionType, pct: number, config: CommissionConfig): string {
  if (type === "percentage" && pct > 0) return `y gana ${pct}% por cada entrada que vendas.`;
  if (type === "tiered" && config && "tiers" in config && config.tiers.length > 0)
    return "y gana en efectivo al llegar a tus metas de venta.";
  if (type === "inkind" && config && "rewards" in config && config.rewards.length > 0)
    return "y gana premios al llegar a tus metas de venta.";
  return "El organizador definirá los hitos y la comisión muy pronto.";
}

const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}`, display: "inline-block" }} />
);

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

  const onApply = async () => {
    if (!resolved.data) return;
    await apply.mutateAsync({ token, message: phone ? `WhatsApp: ${phone}` : null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/apply/${token}/waiting` as any);
  };

  if (resolved.isLoading) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.dim }}>Cargando invitación…</div>
      </Phone>
    );
  }

  if (resolved.error || !resolved.data) {
    return (
      <Phone>
        <div style={{ padding: 28, color: C.red }}>Esta invitación no es válida.</div>
      </Phone>
    );
  }

  return (
    <Phone>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 250, overflow: "hidden" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.45), transparent 60%)" }} />
          <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 60, background: `linear-gradient(to bottom, transparent, ${C.bg})` }} />
        </div>
      </div>

      <div style={{ position: "relative", padding: "230px 22px 140px", zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.purple, fontWeight: 700, marginBottom: 10 }}>
          ★ TE INVITAN A SER PROMOTOR
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1 }}>
          Vende para <span style={{ color: C.purple }}>{resolved.data.orgName}</span>
          <br />
          {commissionPitch(resolved.data.commissionType, resolved.data.commissionPct, resolved.data.commissionConfig)}
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>
          {resolved.data.eventTitle}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            borderRadius: 14,
            background: C.yellowSoft,
            boxShadow: "0 0 0 1px rgba(255,206,59,0.3) inset",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Dot color={C.yellow} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
            El organizador revisa tu solicitud y te avisa por WhatsApp.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Field label="Tu nombre" value={name} onChange={(e) => setNameDraft(e.target.value)} active={name.length > 0} />
          <Field label="WhatsApp" value={phone} onChange={(e) => setPhoneDraft(e.target.value)} active={phone.length > 0} mono />
        </div>

        {apply.error && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>
            {(apply.error as Error).message}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, padding: "0 22px" }}>
        <Btn onClick={onApply} disabled={apply.isPending || !name}>
          {apply.isPending ? "Enviando…" : "Quiero ser promotor"}
        </Btn>
      </div>
    </Phone>
  );
}
