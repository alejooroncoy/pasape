"use client";

import { use } from "react";
import {
  useDecideApplication,
  usePendingApplications,
  useRealtimePromoterApplications,
} from "@/lib/promoters/hooks/usePromoter";
import { EventShell } from "../../_shell/EventShell";

type Props = { params: Promise<{ slug: string }> };

export default function OrgPendingRequestsPage({ params }: Props) {
  const { slug } = use(params);
  const pending = usePendingApplications(slug);
  useRealtimePromoterApplications(slug);
  const decide = useDecideApplication(slug);
  const list = pending.data ?? [];
  const count = list.length;

  return (
    <EventShell slug={slug} active="promoters" hideTabs>
      <div className="mx-auto mt-6 max-w-[560px]">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-4">
            Solicitudes
          </p>
          {count > 0 && (
            <span className="grid min-w-[22px] place-items-center rounded-full bg-cart-accent px-1.5 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em]">
          {count === 0
            ? "Sin solicitudes pendientes."
            : `${count} ${count === 1 ? "persona quiere" : "personas quieren"} ser tus promotores.`}
        </h1>
        <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-cart-ink-3">
          Entraron por tu link. Acepta solo a los que conozcas — al aceptar heredan el esquema de
          comisión del evento.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {list.map((req) => {
            const initial = req.applicantName[0]?.toUpperCase() ?? "?";
            const busy = decide.isPending && decide.variables?.applicationId === req.id;
            return (
              <div key={req.id} className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-cart-accent text-[17px] font-bold text-white">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{req.applicantName}</div>
                    <div className="truncate text-[11.5px] text-cart-ink-3">
                      {req.applicantHandle ?? "sin contacto"}
                    </div>
                  </div>
                </div>
                {req.message && (
                  <div className="mt-3 rounded-lg bg-cart-bg px-3 py-2 text-[11.5px] text-cart-ink-3">
                    {req.message}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide.mutate({ applicationId: req.id, decision: "rejected" })}
                    className="h-10 flex-1 rounded-xl bg-cart-bg text-[13px] font-semibold text-cart-ink-3 transition hover:text-white disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide.mutate({ applicationId: req.id, decision: "approved" })}
                    className="h-10 flex-1 rounded-xl bg-cart-accent text-[13px] font-semibold text-white shadow-[0_8px_20px_-4px_var(--color-cart-accent-glow-strong)] disabled:opacity-50"
                  >
                    {busy ? "…" : "Aceptar"}
                  </button>
                </div>
              </div>
            );
          })}
          {count === 0 && (
            <div className="rounded-2xl border border-dashed border-cart-line px-4 py-8 text-center text-[13px] text-cart-ink-3">
              Aún no hay solicitudes. Comparte tu link para que lleguen.
            </div>
          )}
        </div>
      </div>
    </EventShell>
  );
}
