"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { getEventBackTarget, type EventBackTarget } from "@/lib/_shared/eventBackTarget";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { eventStatusLabel } from "@/lib/events/eventStatusDisplay";
import type { EventStatus } from "@/server/events/domain/Event";
import { ShareEventDialog } from "@/components/ui/ShareEventDialog";
import { EventComposer } from "@/app/[locale]/org/events/_components/EventComposer";
import { usePanelPromotersVisible } from "@/lib/events/hooks/usePanelPromotersVisible";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import {
  getComposerModePreference,
  setComposerModePreference,
  type ComposerMode,
} from "@/lib/events/composerModePreference";
import { QuickEditForm } from "./QuickEditForm";
import type { Promo, TicketType } from "@/server/events/domain/Event";

export type EventTab = "panel" | "team" | "promoters" | "attendees" | "courtesies" | "settings";

const TABS: Array<{ key: EventTab; label: string; href: (slug: string) => string; icon: ReactNode }> = [
  {
    key: "panel",
    label: "Panel",
    href: (s) => `/org/events/${s}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 16V8m4 8V4m4 12v-6m4 6v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "team",
    label: "Equipo",
    href: (s) => `/org/events/${s}/team`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path
          d="M14 8a4 4 0 11-8 0 4 4 0 018 0zM3 17.5c.4-2.6 3-4.5 7-4.5s6.6 1.9 7 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "promoters",
    label: "Promotores",
    href: (s) => `/org/events/${s}/promoters`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 16c.4-2.3 2.2-3.8 4.5-3.8s4.1 1.5 4.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M13.5 8.5l1.6 1.6L18 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "attendees",
    label: "Asistentes",
    href: (s) => `/org/events/${s}/attendees`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "courtesies",
    label: "Cortesías",
    href: (s) => `/org/events/${s}/courtesies`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="8" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 11h14M10 8v9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 8C10 8 8.5 4.5 6.5 4.5A1.75 1.75 0 006.5 8H10zm0 0c0 0 1.5-3.5 3.5-3.5A1.75 1.75 0 0113.5 8H10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Ajustes",
    href: (s) => `/org/events/${s}/settings`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function EventShell({
  slug,
  active,
  children,
  backOverride,
  hideTabs = false,
}: {
  slug: string;
  active: EventTab;
  children: ReactNode;
  /** Fuerza el destino del botón "atrás", en vez del origen recordado (home vs lista de eventos). */
  backOverride?: EventBackTarget;
  /** Oculta el subnav de tabs y la barra inferior — para pantallas de detalle (drill-down) que no son una sección propia. */
  hideTabs?: boolean;
}) {
  const event = useEvent(slug);
  const ev = event.data?.event;
  const ticketTypes = event.data?.ticketTypes ?? [];
  const promos = event.data?.promos ?? [];
  const router = useRouter();
  const { visible: promotersVisible } = usePanelPromotersVisible();
  const hasApprovalTicketTypes = ticketTypes.some((tt) => tt.requiresApproval);
  const visibleTabs = TABS.filter(
    (t) =>
      (t.key !== "promoters" || promotersVisible) &&
      (t.key !== "attendees" || hasApprovalTicketTypes),
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // El edit rápido solo aplica a eventos con un único tipo de entrada general
  // (lo que produce quick-create) — un box o varios tipos de entrada no caben
  // en ese formulario reducido, así que ahí siempre se fuerza el completo.
  const { data: me } = useCurrentUser();
  const organizerType = me?.user?.organizerType ?? null;
  const canQuickEdit = ticketTypes.length === 1 && ticketTypes[0].kind === "general";
  const [editMode, setEditMode] = useState<ComposerMode>("full");
  useEffect(() => {
    setEditMode(canQuickEdit ? getComposerModePreference(organizerType) : "full");
  }, [canQuickEdit, organizerType]);
  // Origen real (home vs eventos). Default en SSR; se ajusta al montar.
  const [back, setBack] = useState<EventBackTarget>(
    backOverride ?? { href: "/org/events", label: "Eventos" },
  );
  useEffect(() => setBack(backOverride ?? getEventBackTarget()), [backOverride]);

  const dateLabel = ev
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: ev.timezone,
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(ev.startsAt))
        .replace(/\./g, "")
    : "—";

  const status = ev?.status ?? "draft";
  const isLive = status === "published";
  const isOver = status === "closed" || status === "cancelled";

  return (
    <>
      <div className={`mx-auto w-full max-w-[1180px] ${hideTabs ? "pb-12" : "pb-32 lg:pb-12"}`}>
        {/* ============ Top: breadcrumb + acciones (desktop) ============ */}
        <div className="mb-4 flex items-center justify-between lg:mb-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <button
              type="button"
              onClick={() => router.push(back.href as never)}
              className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-cart-ink-3 transition hover:bg-cart-line-2 hover:text-cart-ink lg:inline-flex"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M10 3L5 7l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {back.label}
            </button>
            <span className="hidden text-cart-ink-4 lg:inline">›</span>
            <button
              type="button"
              onClick={() => router.push(back.href as never)}
              aria-label="Atrás"
              className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink lg:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 3L5 7l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="truncate text-cart-ink-2 lg:text-cart-ink-2">{ev?.title ?? "Cargando…"}</span>
          </div>

          {/* Editar evento mobile */}
          {ev && !isOver && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Editar evento"
              className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink lg:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 12l2-.5L11 4.5l-1.5-1.5L2.5 10 2 12z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Acciones rápidas desktop */}
          {ev && (
            <div className="hidden items-center gap-2 lg:flex">
              {!isOver && ev.status === "published" && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_-8px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M11 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6 7a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM11 9.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM5.3 7.7l3.4 1.6M8.7 5.3L5.3 6.9"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Compartir
                </button>
              )}
              {!isOver && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 12l2-.5L11 4.5l-1.5-1.5L2.5 10 2 12z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Editar evento
                </button>
              )}
              {!isOver && (
                <button
                  type="button"
                  data-tour="download"
                  onClick={() => { window.location.href = `/api/events/${slug}/export`; }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v8m0 0l-3-3m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Descargar Excel
                </button>
              )}
            </div>
          )}
        </div>

        {/* ============ Hero del evento ============ */}
        <header className="mb-6 lg:mb-8">
          <div className="flex items-start gap-4">
            <EventThumb title={ev?.title ?? ""} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusPill status={status} live={isLive} finished={isOver} />
                <span className="truncate text-[11.5px] font-medium uppercase tracking-[0.14em] text-cart-ink-3">
                  {dateLabel}
                </span>
              </div>
              <h1 className="mt-1.5 truncate font-sans text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] lg:text-[34px]">
                {ev?.title ?? "Cargando…"}
              </h1>
              {ev?.venue && (
                <p className="mt-0.5 truncate text-[13px] text-cart-ink-3">{ev.venue}</p>
              )}
            </div>
          </div>
        </header>

        {/* ============ Sub-nav (desktop horizontal) ============ */}
        {!hideTabs && (
          <nav className="mb-7 hidden gap-1 border-b border-cart-line lg:flex">
            {visibleTabs.filter((t) => !isOver || t.key !== "settings").map((t) => {
              const on = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.href(slug) as never}
                  className={
                    "relative inline-flex items-center gap-2 px-4 py-3 text-[13.5px] font-medium transition " +
                    (on ? "text-cart-ink" : "text-cart-ink-3 hover:text-cart-ink")
                  }
                >
                  <span className={on ? "text-cart-accent" : "text-cart-ink-3"}>{t.icon}</span>
                  {t.label}
                  {on && (
                    <motion.span
                      layoutId="event-tab-underline"
                      className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-cart-accent shadow-[0_0_10px_var(--color-cart-accent-glow)]"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* ============ Contenido ============ */}
        <main>{children}</main>
      </div>

      {/* ============ Bottom tab bar (mobile iOS) ============ */}
      {!hideTabs && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6px)" }}
        >
          <div className="mx-auto flex max-w-[640px] items-stretch justify-around px-3 pt-2">
            {visibleTabs.filter((t) => !isOver || t.key !== "settings").map((t) => {
              const on = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.href(slug) as never}
                  className={
                    "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition " +
                    (on ? "text-cart-accent" : "text-cart-ink-3")
                  }
                >
                  {on && (
                    <motion.span
                      layoutId="event-tab-pill"
                      className="absolute inset-1 -z-10 rounded-lg bg-cart-accent-soft"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span>{t.icon}</span>
                  <span className="text-[10.5px] font-semibold tracking-[0.02em]">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB de compartir en mobile cuando está publicado */}
      {ev?.status === "published" && (
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Compartir evento"
          className="fixed bottom-24 right-5 z-30 grid size-14 place-items-center rounded-full bg-cart-accent text-white shadow-[0_18px_36px_-12px_var(--color-cart-accent-glow-strong)] active:scale-95 lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 6a2 2 0 11-4 0 2 2 0 014 0zM8 10a2 2 0 11-4 0 2 2 0 014 0zM15 14a2 2 0 11-4 0 2 2 0 014 0zM7.5 11l4 2M11.5 7l-4 2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {/* Dialog de compartir */}
      {ev && (
        <ShareEventDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          eventSlug={slug}
          eventTitle={ev.title ?? ""}
          flyerUrl={ev.coverUrl}
        />
      )}

      {/* Sheet editar evento */}
      {ev && (
        <EditEventSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          slug={slug}
          event={ev}
          ticketTypes={ticketTypes}
          promos={promos}
          canQuickEdit={canQuickEdit}
          mode={editMode}
          onSwitchMode={(next) => {
            setComposerModePreference(next);
            setEditMode(next);
          }}
        />
      )}
    </>
  );
}

function EditEventSheet({
  open,
  onClose,
  slug,
  event,
  ticketTypes,
  promos,
  canQuickEdit,
  mode,
  onSwitchMode,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  event: NonNullable<ReturnType<typeof useEvent>["data"]>["event"];
  ticketTypes: NonNullable<ReturnType<typeof useEvent>["data"]>["ticketTypes"];
  promos: Promo[];
  canQuickEdit: boolean;
  mode: ComposerMode;
  onSwitchMode: (next: ComposerMode) => void;
}) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="edit-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-[80] app-scrim"
          />
          <motion.aside
            key="edit-sh"
            role="dialog"
            aria-modal="true"
            aria-label="Editar evento"
            initial={isDesktop ? { x: "100%" } : { y: "100%" }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            className={
              isDesktop
                ? "fixed inset-y-0 right-0 z-[81] flex w-[min(640px,92vw)] flex-col overflow-y-auto border-l border-cart-line-strong bg-cart-bg shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.7)]"
                : "fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
            }
            style={
              isDesktop
                ? undefined
                : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }
            }
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cart-line bg-cart-bg/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                {!isDesktop && (
                  <div className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-cart-ink/15" />
                )}
                <h3 className="font-sans text-[18px] font-semibold tracking-[-0.01em]">
                  Editar evento
                </h3>
                {canQuickEdit && mode === "full" && (
                  <button
                    type="button"
                    onClick={() => onSwitchMode("simple")}
                    className="text-[11.5px] font-medium text-cart-ink-3 underline decoration-cart-ink-4 underline-offset-2 transition hover:text-cart-ink-2"
                  >
                    Versión rápida
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-5 lg:px-6">
              {canQuickEdit && mode === "simple" ? (
                <QuickEditForm
                  slug={slug}
                  event={event}
                  ticketType={ticketTypes[0] as TicketType & { kind: "general" }}
                  promos={promos}
                  onClose={onClose}
                  onSwitchToFull={() => onSwitchMode("full")}
                />
              ) : (
                <EventComposer
                  mode="edit"
                  initial={{ slug, event, ticketTypes }}
                  onClose={onClose}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------
// Pieces
// ------------------------------------------------------------
function EventThumb({ title }: { title: string }) {
  const initial = (title || "?")[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-xl font-sans text-[22px] font-semibold text-white lg:size-[68px] lg:text-[26px]"
      style={{
        background:
          "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 45%, #FF4D5E 100%)",
        boxShadow: "0 8px 24px -10px rgba(124,58,237,0.55)",
      }}
    >
      {initial}
    </div>
  );
}

function StatusPill({
  status,
  live,
  finished,
}: {
  status: EventStatus;
  live: boolean;
  finished: boolean;
}) {
  // "EN VIVO"/"Finalizado" son estados DERIVADOS (status "published" + los
  // flags live/finished que calcula esta pantalla), no un status crudo — no
  // salen de eventStatusDisplay. El resto de labels sí vienen de ahí (fuente
  // única, ver PR #77); solo el hex/tint/glow queda local a este componente.
  const cfg =
    live && status === "published"
      ? { dot: "#22D17F", label: "EN VIVO", tint: "rgba(34,209,127,0.15)", text: "#22D17F" }
      : finished && status === "published"
        ? { dot: "var(--color-cart-ink-3)", label: "Finalizado", tint: "var(--color-cart-line-2)", text: "var(--color-cart-ink-3)" }
        : status === "published"
          ? { dot: "#22D17F", label: eventStatusLabel(status), tint: "rgba(34,209,127,0.12)", text: "#22D17F" }
        : status === "draft"
          ? { dot: "var(--color-cart-ink-3)", label: eventStatusLabel(status), tint: "var(--color-cart-line)", text: "var(--color-cart-ink-2)" }
          : status === "closed"
            ? { dot: "var(--color-cart-ink-3)", label: eventStatusLabel(status), tint: "var(--color-cart-line-2)", text: "var(--color-cart-ink-3)" }
            : status === "pending_review"
              ? { dot: "#F5A623", label: eventStatusLabel(status), tint: "rgba(245,166,35,0.12)", text: "#F5A623" }
              : status === "cancelled"
                ? { dot: "#FF4D5E", label: eventStatusLabel(status), tint: "rgba(255,77,94,0.12)", text: "#FF4D5E" }
                // Fallback defensivo: un EventStatus no contemplado arriba
                // (drift de datos, o un status nuevo sin actualizar este
                // componente) se pinta neutro con su label real — nunca cae
                // en rojo "Cancelado" por accidente.
                : { dot: "var(--color-cart-ink-3)", label: eventStatusLabel(status), tint: "var(--color-cart-line-2)", text: "var(--color-cart-ink-3)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]"
      style={{ background: cfg.tint, color: cfg.text }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: cfg.dot, boxShadow: live ? `0 0 8px ${cfg.dot}` : "none" }}
      />
      {cfg.label}
    </span>
  );
}
