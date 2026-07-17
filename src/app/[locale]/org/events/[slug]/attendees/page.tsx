"use client";

import { use, useMemo, useRef, useState } from "react";
import { usePendingApprovals, useDecideRegistration } from "@/lib/events/hooks/useAttendeeApprovals";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { EventShell } from "../_shell/EventShell";
import type { PendingApproval } from "@/server/tickets/ports/TicketRepository";
import type { CustomField } from "@/lib/events/customFields";

type Params = Promise<{ slug: string; locale: string }>;

export default function AttendeesPage({ params }: { params: Params }) {
  const { slug } = use(params);
  return (
    <EventShell slug={slug} active="attendees">
      <AttendeesContent slug={slug} />
    </EventShell>
  );
}

function AttendeesContent({ slug }: { slug: string }) {
  const pending = usePendingApprovals(slug);
  const decide = useDecideRegistration(slug);
  const event = useEvent(slug);
  const list = pending.data ?? [];
  const customFields = event.data?.event.customFields ?? [];
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Asistentes</h2>
          <p className="mt-1 max-w-[620px] text-[12.5px] text-cart-ink-3">
            Inscripciones que esperan tu decisión. El cupo del evento solo
            cuenta a los ya aprobados.
          </p>
        </div>
        {list.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-[12px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(217,119,6,0.5)]">
            {list.length} por revisar
          </span>
        )}
      </div>

      {notice && (
        <p className="mt-4 rounded-xl bg-emerald-500/15 px-3 py-2 text-[13px] font-medium text-emerald-400">
          {notice}
        </p>
      )}

      {list.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3">
          {list.map((req) => (
            <PendingCard
              key={req.orderId}
              request={req}
              customFields={customFields}
              busy={decide.isPending && decide.variables?.orderId === req.orderId}
              onDecide={(decision) =>
                decide.mutate(
                  { orderId: req.orderId, decision },
                  {
                    onSuccess: () =>
                      flash(
                        decision === "approved"
                          ? `${req.guestName ?? "Inscripción"} aprobada`
                          : `${req.guestName ?? "Inscripción"} rechazada`,
                      ),
                  },
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-cart-line px-5 py-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-3 text-[14px] font-medium">Sin inscripciones pendientes</p>
          <p className="mx-auto mt-1 max-w-[340px] text-[12.5px] text-cart-ink-4">
            Cuando alguien se inscriba a una entrada con aprobación, aparece
            aquí para que la revises.
          </p>
        </div>
      )}
    </>
  );
}

// Las respuestas llegan keyed por field.id (uuid) — ilegible sin resolver
// contra event.customFields, igual que hace ExportEventReport para el Excel.
const formatAnswer = (v: string | string[] | boolean | undefined): string => {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return v;
};

function avatarColor(seed: string) {
  const palette = ["#7C3AED", "#DB2777", "#2563EB", "#059669", "#D97706", "#DC2626"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function PendingCard({
  request,
  customFields,
  busy,
  onDecide,
}: {
  request: PendingApproval;
  customFields: CustomField[];
  busy: boolean;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  const name = request.guestName ?? "Sin nombre";
  const contact = request.guestEmail || request.guestPhone || "Sin contacto";
  const sent = new Date(request.createdAt).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  });
  // Orden estable: el mismo en que el organizador armó el formulario, no el
  // orden de inserción en el objeto de respuestas.
  const answers = useMemo(
    () =>
      customFields
        .map((f) => ({ label: f.label, value: formatAnswer(request.customFieldAnswers?.[f.id]) }))
        .filter((a) => a.value !== "—"),
    [customFields, request.customFieldAnswers],
  );
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-4 lg:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Identidad + respuestas: usa el ancho disponible en desktop en vez de */}
        {/* apilar todo en una sola columna angosta. */}
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white"
            style={{ background: avatarColor(name) }}
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{name}</span>
              <span className="rounded-full bg-cart-bg-elev-2 px-2 py-0.5 text-[10.5px] font-medium text-cart-ink-3">
                {request.ticketTypeName}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[12px] text-cart-ink-4">
              {contact} · inscrito el {sent}
            </div>

            {answers.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {answers.map((a) => (
                  <div key={a.label} className="min-w-0 rounded-lg bg-cart-bg-elev-2 px-3 py-2">
                    <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-cart-ink-4">
                      {a.label}
                    </div>
                    <div className="mt-0.5 break-words text-[12.5px] font-medium text-cart-ink">
                      {a.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Acciones: siempre visibles, sin scrollear ni entrar a un detalle. */}
        <div className="flex shrink-0 gap-2 lg:pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("rejected")}
            className="flex-1 rounded-full bg-cart-bg-elev-2 px-4 py-2 text-[12.5px] font-medium text-cart-ink-2 transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50 lg:flex-none"
          >
            ✗ Rechazar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("approved")}
            className="flex-1 rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50 lg:flex-none"
          >
            {busy ? "…" : "✓ Aprobar"}
          </button>
        </div>
      </div>
    </div>
  );
}
