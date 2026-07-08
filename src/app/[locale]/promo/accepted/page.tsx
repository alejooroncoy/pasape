"use client";

import { useState } from "react";
import { Btn, C } from "@/components/design";
import {
  PromoBody,
  PromoConfetti,
  PromoEyebrow,
  PromoFeedback,
  PromoLinkChip,
  PromoStatusContent,
  PromoStatusIcon,
  PromoStatusLayout,
  PromoTitle,
} from "@/components/promoters/PromoInviteUI";
import { PromoInviteShell } from "@/components/promoters/PromoInviteShell";
import { useMyPromoterLinks } from "@/lib/promoters/hooks/usePromoter";
import { useRouter } from "@/i18n/navigation";

export default function PromoAcceptedCelebratePage() {
  const links = useMyPromoterLinks();
  const first = links.data?.[0];
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin.replace(/^https?:\/\//, "");
  const shareUrl = first ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${first.code}` : "";

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (links.isLoading) {
    return (
      <PromoInviteShell>
        <PromoFeedback variant="loading" eyebrow="◆ UN MOMENTO" title="Preparando tu link de venta…" />
      </PromoInviteShell>
    );
  }

  return (
    <PromoInviteShell>
      <PromoConfetti />
      <PromoStatusLayout
        closeHref="/promo"
        footer={
          <div style={{ paddingBottom: 16 }}>
            <Btn onClick={() => router.push("/promo" as never)}>Ver mi panel de promotor →</Btn>
          </div>
        }
      >
        <PromoStatusContent>
          <PromoStatusIcon variant="success" />
          <PromoEyebrow>◆ ESTÁS DENTRO</PromoEyebrow>
          <PromoTitle>¡Te aprobaron!</PromoTitle>
          {first ? (
            <PromoBody>
              Ya eres promotor oficial de <strong style={{ color: "#fff" }}>{first.eventTitle}</strong>.
            </PromoBody>
          ) : (
            <PromoBody>Tu cuenta de promotor ya está activa.</PromoBody>
          )}

          {first && (
            <>
              <PromoLinkChip prefix={`${origin}/r/`} code={first.code} />
              <button
                type="button"
                onClick={() => void onCopy()}
                style={{
                  marginTop: 12,
                  background: "transparent",
                  border: 0,
                  color: copied ? C.green : C.dim,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Link copiado" : "Copiar link de venta"}
              </button>
            </>
          )}
        </PromoStatusContent>
      </PromoStatusLayout>
    </PromoInviteShell>
  );
}
