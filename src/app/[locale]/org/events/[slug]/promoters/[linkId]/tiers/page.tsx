"use client";

import { use, useMemo } from "react";
import { EventShell } from "../../../_shell/EventShell";
import { Link } from "@/i18n/navigation";
import {
  useEventPromoters,
  useUpdateAssignmentCommission,
} from "@/lib/promoters/hooks/useEventPromoters";
import { MilestonesEditor } from "@/components/promoters/MilestonesEditor";

type Params = Promise<{ slug: string; linkId: string; locale: string }>;

// Página de negociación por-link: edita el override de hitos (commission_config_override)
// con el mismo editor (Square/Upwork) que el esquema del evento y la marca.
export default function OrgPromoterTiersPage({ params }: { params: Params }) {
  const { slug, linkId } = use(params);
  const assignments = useEventPromoters(slug);
  const updateCommission = useUpdateAssignmentCommission(slug);

  const promoter = useMemo(
    () => (assignments.data ?? []).find((a) => a.promoterLinkId === linkId) ?? null,
    [assignments.data, linkId],
  );

  return (
    <EventShell slug={slug} active="panel">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-cart-ink-3">
              <Link
                href={`/org/events/${slug}/team` as never}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-cart-ink-3 transition hover:bg-cart-line-2 hover:text-cart-ink"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M10 3L5 7l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {promoter?.name ?? "Promotor"}
              </Link>
              <span className="text-cart-ink-4">›</span>
              <span>Comisiones</span>
            </div>
            <h1 className="mt-2 font-sans text-[26px] font-semibold tracking-[-0.025em] lg:text-[30px]">
              Hitos y premios
            </h1>
            <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-cart-ink-3">
              Negociá escalones individuales con {promoter?.name?.split(" ")[0] ?? "este promotor"}.
              Se desbloquean automáticamente cuando alcance las ventas pactadas.
            </p>
          </div>
        </header>

        <MilestonesEditor
          split
          config={promoter?.ownCommissionConfig ?? undefined}
          onSave={(cfg) =>
            updateCommission.mutate({
              linkId,
              commissionConfig: cfg.milestones.length > 0 ? cfg : null,
            })
          }
          saving={updateCommission.isPending}
        />
      </div>
    </EventShell>
  );
}
