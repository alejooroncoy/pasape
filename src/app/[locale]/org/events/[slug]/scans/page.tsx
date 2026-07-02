"use client";

import { use } from "react";
import { useEventScans } from "@/lib/events/hooks/useEventScans";
import { EventShell } from "../_shell/EventShell";
import { EmptyRow, ScanRow } from "../page";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventScansPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const accesos = useEventScans(slug);
  const scans = accesos.data ?? [];

  return (
    <EventShell
      slug={slug}
      active="panel"
      backOverride={{ href: `/org/events/${slug}`, label: "Volver" }}
      hideTabs
    >
      <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
        <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Historial de accesos</h1>
          <span className="text-[11.5px] text-cart-ink-4">últimos {scans.length || 50}</span>
        </header>

        {scans.length ? (
          <ul className="divide-y divide-cart-line">
            {scans.map((s) => (
              <ScanRow
                key={s.id}
                when={s.scannedAt}
                result={s.result}
                ticketTypeKind={s.ticketTypeKind}
                ticketTypeName={s.ticketTypeName}
                boxLabel={s.boxLabel}
                unitNoun={s.unitNoun}
              />
            ))}
          </ul>
        ) : (
          <EmptyRow label="Aún no hay accesos registrados." />
        )}
      </section>
    </EventShell>
  );
}
