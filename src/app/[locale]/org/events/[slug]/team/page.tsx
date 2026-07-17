"use client";

import { use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useDoorLink } from "@/lib/events/hooks/useDoorLink";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { useRealtimeEventStats } from "@/lib/events/hooks/useRealtimeEventStats";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useOrgInvites } from "@/lib/identity/organizations/hooks/useOrgInvites";
import {
  useAddEventCoOrganizer,
  useEventCoOrganizers,
  useInviteEventCoOrganizer,
  useRemoveEventCoOrganizer,
} from "@/lib/events/hooks/useEventCoOrganizers";
import { useOrgPromoters, useOrgScheme } from "@/lib/promoters/hooks/useOrgPromoters";
import {
  useAssignPromotersToEvent,
  useEventPromoters,
  useEventPromoterScheme,
  useRemoveAssignment,
  useUpdateAssignmentCommission,
  useUpdateEventPromoterScheme,
} from "@/lib/promoters/hooks/useEventPromoters";
import {
  useDecideApplication,
  useGenerateInvite,
  usePendingApplications,
  useRealtimePromoterApplications,
} from "@/lib/promoters/hooks/usePromoter";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";
import type { EventPromoterScheme } from "@/server/events/ports/EventRepository";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";
import { CommissionSchemeEditor } from "@/components/promoters/CommissionSchemeEditor";
import { EventShell } from "../_shell/EventShell";
import { Sheet } from "../_shell/Sheet";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventTeamPage({ params }: { params: Params }) {
  const { slug } = use(params);

  return (
    <EventShell slug={slug} active="team">
      <Disclaimer />

      <div className="mt-6 flex flex-col gap-8">
        <InheritedAccessSection />
        <EventCoOrganizersSection slug={slug} />
        <DoorSection slug={slug} />
      </div>
    </EventShell>
  );
}

// ============================================================
// DISCLAIMER
// ============================================================
function Disclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 text-[13px] leading-relaxed text-cart-ink-2 lg:px-5">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[11px] font-semibold text-cart-accent">
        i
      </span>
      <p>
        Aquí ves el equipo de este evento. Para invitar gente nueva, anda al{" "}
        <Link
          href="/org/team"
          className="font-semibold text-cart-accent underline-offset-2 hover:underline"
        >
          Equipo de la marca →
        </Link>
      </p>
    </div>
  );
}

// ============================================================
// INHERITED ACCESS — read-only members granted at brand/legal-entity/portfolio scope
// ============================================================
function InheritedAccessSection() {
  const invites = useOrgInvites();
  const members = invites.data?.members ?? [];

  return (
    <section>
      <SectionHeader
        title="Acceso heredado"
        subtitle="Gente que ya tiene acceso a este evento por su rol en la marca, razón social o portafolio."
      />
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
        {members.length === 0 ? (
          <EmptyState
            title="Nadie con acceso heredado todavía."
            cta={{ href: "/org/team", label: "Invita gente en Equipo de la marca →" }}
          />
        ) : (
          <ul className="divide-y divide-cart-line">
            {members.map((m) => (
              <li
                key={m.profileId}
                className="flex items-center gap-3 px-4 py-3 lg:px-5"
              >
                <Avatar name={m.fullName || m.email || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                    {m.fullName || m.email}
                  </div>
                  {m.fullName && m.email && (
                    <div className="truncate text-[11.5px] text-cart-ink-3">
                      {m.email}
                    </div>
                  )}
                </div>
                <ScopeChip grantedVia={m.grantedVia} />
                <RoleChip role={m.role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ScopeChip({
  grantedVia,
}: {
  grantedVia: "portfolio" | "legal_entity" | "organization";
}) {
  const label =
    grantedVia === "portfolio"
      ? "Portafolio"
      : grantedVia === "legal_entity"
        ? "Razón social"
        : "Marca";
  return (
    <span className="hidden rounded-full bg-cart-line-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3 sm:inline-flex">
      {label}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  return (
    <span className="rounded-full bg-cart-bg-elev-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cart-ink-2">
      {role}
    </span>
  );
}

// ============================================================
// EVENT-ONLY CO-ORGANIZERS — editable, picker from brand team pool
// ============================================================
function EventCoOrganizersSection({ slug }: { slug: string }) {
  const me = useCurrentUser();
  const invites = useOrgInvites();
  const coorgs = useEventCoOrganizers(slug);
  const add = useAddEventCoOrganizer(slug);
  const invite = useInviteEventCoOrganizer(slug);
  const remove = useRemoveEventCoOrganizer(slug);
  const [picker, setPicker] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);

  const myProfileId = me.data?.user?.id ?? null;
  const assignedIds = useMemo(
    () => new Set((coorgs.data ?? []).map((c) => c.profileId)),
    [coorgs.data],
  );
  const available = (invites.data?.members ?? []).filter(
    (m) => !assignedIds.has(m.profileId) && m.profileId !== myProfileId,
  );

  return (
    <section>
      <SectionHeader
        title="Co-organizadores de este evento"
        subtitle="Gente invitada solo a este evento — de tu equipo o por correo."
        action={
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
          >
            <PlusIcon /> Agregar co-organizador
          </button>
        }
      />
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
        {(coorgs.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Nadie invitado a este evento todavía."
            description="Suma personas que ya están en tu equipo de marca para que vean y editen solo este evento."
          />
        ) : (
          <ul className="divide-y divide-cart-line">
            {coorgs.data!.map((c) => (
              <li
                key={c.profileId}
                className="flex items-center gap-3 px-4 py-3 lg:px-5"
              >
                <Avatar name={c.fullName || c.email || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                    {c.fullName || c.email}
                  </div>
                  {c.fullName && c.email && (
                    <div className="truncate text-[11.5px] text-cart-ink-3">
                      {c.email}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `¿Quitar a ${c.fullName || c.email} de este evento?`,
                      )
                    ) {
                      remove.mutate(c.profileId);
                    }
                  }}
                  className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium text-cart-ink-2 transition hover:bg-red-500/10 hover:text-red-600"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {picker && (
          <Sheet
            onClose={() => {
              setPicker(false);
              setInvited(null);
            }}
            title="Agregar co-organizador"
          >
            <CoOrgPicker
              available={available}
              busy={add.isPending}
              onPick={(profileId) =>
                add.mutate(profileId, {
                  onSuccess: () => setPicker(false),
                })
              }
              onInvite={(email) =>
                invite.mutate(email, {
                  onSuccess: () => setInvited(email),
                })
              }
              inviting={invite.isPending}
              inviteError={invite.error?.message ?? null}
              invited={invited}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </section>
  );
}

function CoOrgPicker({
  available,
  busy,
  onPick,
  onInvite,
  inviting,
  inviteError,
  invited,
}: {
  available: Array<{
    profileId: string;
    fullName: string | null;
    email: string | null;
    role: string;
  }>;
  busy: boolean;
  onPick: (profileId: string) => void;
  onInvite: (email: string) => void;
  inviting: boolean;
  inviteError: string | null;
  invited: string | null;
}) {
  return (
    <div className="flex flex-col gap-5 pb-4">
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-cart-ink-3">
            De tu equipo de marca:
          </p>
          {available.map((m) => (
            <button
              key={m.profileId}
              type="button"
              disabled={busy}
              onClick={() => onPick(m.profileId)}
              className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-3 text-left transition hover:border-cart-line-strong disabled:opacity-60"
            >
              <Avatar name={m.fullName || m.email || "?"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {m.fullName || m.email}
                </div>
                {m.fullName && m.email && (
                  <div className="truncate text-[11.5px] text-cart-ink-3">
                    {m.email}
                  </div>
                )}
              </div>
              <RoleChip role={m.role} />
            </button>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-cart-line" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cart-ink-4">
            o
          </span>
          <div className="h-px flex-1 bg-cart-line" />
        </div>
      )}

      <InviteByEmailForm
        busy={inviting}
        error={inviteError}
        invited={invited}
        onSubmit={onInvite}
      />
    </div>
  );
}

// Invitar por correo a alguien que NO está en el equipo de la marca — solo
// para este evento. Es la opción obvia por defecto: caso más común cuando el
// organizador quiere sumar a alguien puntual (ej. un amigo, un freelance).
function InviteByEmailForm({
  busy,
  error,
  invited,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  invited: string | null;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (invited) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-6 text-center">
        <span className="grid size-9 place-items-center rounded-full bg-emerald-500 text-white">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[13.5px] font-semibold text-cart-ink">Invitación enviada</p>
        <p className="max-w-[280px] text-[12.5px] text-cart-ink-3">
          Le llegó un correo a <span className="font-medium text-cart-ink-2">{invited}</span>. Cuando
          lo acepte, va a poder editar solo este evento.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(email.trim());
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-[12.5px] text-cart-ink-3">
        Invita por correo a alguien nuevo — quedará solo en este evento, sin acceso al resto de tu
        marca.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="h-12 flex-1 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 text-[14px] font-medium outline-none focus:border-cart-accent"
        />
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-cart-accent px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Invitar"}
        </button>
      </div>
      {error && (
        <p className="text-[12px] font-medium text-red-600">
          No se pudo enviar. Revisa el correo e intenta de nuevo.
        </p>
      )}
    </form>
  );
}

// ============================================================
// PROMOTERS SECTION (sin cambios funcionales — sigue editable)
// ============================================================
// Invitar por link de grupo: el organizador comparte UN link (/apply/{token}),
// quien entra pide ser promotor y cae en "Solicitudes" para aprobación manual.
// Reemplaza la vieja pantalla /invite ("Compártelo en stories"): mismo flujo,
// ahora integrado en la pestaña Promotores y con el diseño nuevo.
function EventInviteLinkCard({ slug }: { slug: string }) {
  const generate = useGenerateInvite();
  const pending = usePendingApplications(slug);
  useRealtimePromoterApplications(slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // El % ya no viaja acá: al aprobar, el promotor hereda el esquema del evento.
    if (!generate.data && !generate.isPending) generate.mutate({ eventSlug: slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fullUrl = generate.data
    ? `${typeof window === "undefined" ? "" : window.location.origin}${generate.data.url}`
    : "";
  const pretty = fullUrl.replace(/^https?:\/\//, "");
  const pendingCount = pending.data?.length ?? 0;

  const onCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard?.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const onShare = async () => {
    if (!fullUrl) return;
    if (navigator.share) await navigator.share({ url: fullUrl, title: "Sé promotor" }).catch(() => {});
    else onCopy();
  };

  return (
    <section>
      <SectionHeader
        title="Invitar por link"
        subtitle="Comparte un link en tu grupo. Quien entre pide ser promotor y tú lo apruebas."
      />
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
        <button
          type="button"
          onClick={onCopy}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-cart-line bg-cart-bg px-4 py-3 text-left font-mono text-[13px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong"
        >
          <span className="truncate">
            {generate.isPending ? "Generando…" : copied ? "¡Copiado!" : pretty || "—"}
          </span>
          <CopyGlyph />
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cart-accent px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
          >
            Compartir el link
          </button>
          {/* Soft-nav: la ruta se intercepta (@modal/(.)requests) y abre el
              drawer sobre esta página, con la URL en /requests. En hard-nav /
              refresh cae la página completa promoters/requests. */}
          <Link
            href={`/org/events/${slug}/promoters/requests` as never}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-cart-line px-4 py-2.5 text-[13.5px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong"
          >
            Solicitudes
            {pendingCount > 0 && (
              <span className="grid min-w-[20px] place-items-center rounded-full bg-cart-accent px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-cart-ink-4">
          Aprobación manual, uno por uno · el link vence al cerrar el evento.
        </p>
      </div>
    </section>
  );
}

// Contenido de Solicitudes (postulaciones por link). Lo comparten la ruta
// interceptora (drawer overlay, soft-nav) y la página completa (hard-nav).
// Aprobar hace que el promotor herede el esquema de comisión del evento.
export function RequestsSheet({ slug }: { slug: string }) {
  const pending = usePendingApplications(slug);
  useRealtimePromoterApplications(slug);
  const decide = useDecideApplication(slug);
  const scheme = useEventPromoterScheme(slug);
  const brand = useOrgScheme();
  const list = pending.data ?? [];
  const count = list.length;
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePct = scheme.data?.commissionPct ?? brand.data?.commissionPct ?? 0;
  const hasMilestones = (scheme.data?.commissionConfig?.milestones?.length ?? 0) > 0;
  const commissionLabel = `${effectivePct}%${hasMilestones ? " + metas" : ""}`;

  const flash = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  };

  return (
    <div className="flex flex-col">
      {notice && (
        <p className="mb-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-[13px] font-medium text-emerald-600">
          {notice}
        </p>
      )}
      <h4 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">
        {count === 0
          ? "Sin solicitudes pendientes."
          : `${count} ${count === 1 ? "persona quiere" : "personas quieren"} ser tus promotores.`}
      </h4>
      <p className="mt-2 text-[13px] leading-relaxed text-cart-ink-3">
        Entraron por tu link. Acepta solo a los que conozcas — al aceptar recibirán{" "}
        <span className="font-semibold text-cart-ink">{commissionLabel}</span> de comisión
        (según el esquema del evento).
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {list.map((req) => {
          const initial = req.applicantName[0]?.toUpperCase() ?? "?";
          const busy = decide.isPending && decide.variables?.applicationId === req.id;
          return (
            <div key={req.id} className="rounded-2xl border border-cart-line bg-cart-bg p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-cart-accent text-[17px] font-bold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{req.applicantName}</div>
                  <div className="truncate text-[11.5px] text-cart-ink-3">
                    {req.applicantHandle ?? "sin contacto"} · recibirá {commissionLabel}
                  </div>
                </div>
              </div>
              {req.message && (
                <div className="mt-3 rounded-lg bg-cart-bg-elev px-3 py-2 text-[11.5px] text-cart-ink-3">
                  {req.message}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    decide.mutate(
                      { applicationId: req.id, decision: "rejected" },
                      { onSuccess: () => flash(`Solicitud de ${req.applicantName} rechazada`) },
                    )
                  }
                  className="h-10 flex-1 rounded-xl bg-cart-bg-elev-2 text-[13px] font-semibold text-cart-ink-3 transition hover:text-cart-ink disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    decide.mutate(
                      { applicationId: req.id, decision: "approved" },
                      { onSuccess: () => flash(`${req.applicantName} aceptado · ${commissionLabel}`) },
                    )
                  }
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
  );
}

function CopyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-cart-accent">
      <rect x="6" y="6" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function PromotersSection({ slug }: { slug: string }) {
  const event = useEvent(slug);
  // Ventas en vivo: el mismo Broadcast del dashboard invalida las queries de
  // promotores — sin esto la pestaña solo se actualizaba al reenfocar.
  useRealtimeEventStats(event.data?.event?.id, slug);
  const pool = useOrgPromoters();
  const assignments = useEventPromoters(slug);
  const assign = useAssignPromotersToEvent(slug);
  const scheme = useEventPromoterScheme(slug);
  const updateScheme = useUpdateEventPromoterScheme(slug);
  const updateCommission = useUpdateAssignmentCommission(slug);
  const remove = useRemoveAssignment(slug);
  const [picker, setPicker] = useState(false);
  // Promotor abierto para personalizar (sheet en web / drawer en móvil).
  const [personalizeId, setPersonalizeId] = useState<string | null>(null);

  const assigned = assignments.data ?? [];
  // Derivar del cache para que el sheet refleje los cambios optimistas en vivo.
  const personalizeTarget = assigned.find((a) => a.promoterLinkId === personalizeId) ?? null;
  const assignedSet = useMemo(
    () => new Set(assigned.map((a) => a.orgPromoterId)),
    [assigned],
  );
  const available = (pool.data ?? []).filter((p) => !assignedSet.has(p.id));

  return (
    <div id="promotores" className="flex flex-col gap-8 scroll-mt-24">
      {/* 0 · Invitar por link de grupo (self-apply + solicitudes) */}
      <EventInviteLinkCard slug={slug} />

      {/* 1 · Esquema del evento — visible siempre (H23) */}
      <section>
        <SectionHeader
          title="Esquema del evento"
          subtitle="Comisión y cupos para todos los promotores. Configuralo antes de aprobar solicitudes."
        />
        <EventSchemeCard
          scheme={scheme.data}
          onSave={(patch) => updateScheme.mutate(patch)}
          saving={updateScheme.isPending}
        />
      </section>

      {/* 2 · Promotores de este evento */}
      <section>
        <SectionHeader
          title="Promotores asignados"
          subtitle="Cada promotor del pool de tu marca puede vender este evento con su link único."
          action={
            <button
              type="button"
              onClick={() => setPicker(true)}
              disabled={available.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] disabled:opacity-50"
            >
              <PlusIcon /> Asignar del pool
            </button>
          }
        />
        <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          {assigned.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center lg:px-5">
            <div className="text-[14px] font-semibold">Sin promotores asignados</div>
            <p className="max-w-[360px] text-[12.5px] text-cart-ink-3">
              Asigna promotores del pool de tu marca para que puedan vender este evento con su link
              único.
            </p>
            {(pool.data?.length ?? 0) === 0 ? (
              <Link
                href={{ pathname: "/org/team", query: { tab: "promoters" } } as never}
                className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white"
              >
                Crear primer promotor
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white"
              >
                <PlusIcon /> Asignar del pool
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-cart-line">
            {assigned.map((a) => (
              <AssignmentRow
                key={a.promoterLinkId}
                assignment={a}
                onOpen={() => setPersonalizeId(a.promoterLinkId)}
              />
            ))}
          </div>
        )}
      </div>
        {assigned.length > 0 && (
          <p className="mt-2 px-1 text-[11px] text-cart-ink-4">
            Toca un promotor para personalizarlo. El punto <span className="text-cart-accent">•</span> marca
            un valor propio; el resto sigue el esquema del evento.
          </p>
        )}
      </section>

      <AnimatePresence>
        {picker && (
          <Sheet
            onClose={() => setPicker(false)}
            title={available.length > 0 ? "Asignar promotores" : "Pool vacío"}
          >
            <PoolPicker
              available={available}
              busy={assign.isPending}
              onConfirm={(ids) =>
                assign.mutate(ids, { onSuccess: () => setPicker(false) })
              }
            />
          </Sheet>
        )}
        {personalizeTarget && (
          <Sheet
            onClose={() => setPersonalizeId(null)}
            title={`Personalizar a ${personalizeTarget.name.split(" ")[0]}`}
          >
            <PersonalizeSheet
              assignment={personalizeTarget}
              saving={updateCommission.isPending}
              onSet={(patch) =>
                updateCommission.mutate({ linkId: personalizeTarget.promoterLinkId, ...patch })
              }
              onRemove={() => {
                if (confirm(`¿Quitar a ${personalizeTarget.name} de este evento?`)) {
                  remove.mutate(personalizeTarget.promoterLinkId, {
                    onSuccess: () => setPersonalizeId(null),
                  });
                }
              }}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// EventSchemeCard — "así pago y reparto a todos". Un solo lugar para el evento:
// comisión (%/Hitos/Especie) + cupos default. Cada cambio guarda al toque; la
// herencia hace que los promotores sin valor propio lo tomen.
// Indicador de auto-guardado: "Se guarda solo" → "Guardando…" → "✓ Guardado".
// Hace evidente que no hay botón de guardar (es automático).
// Confirmación inline, junto a lo que el organizador acaba de tocar (no arriba,
// donde no está mirando). flash() la dispara tras cada guardado local.
function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = () => {
    setSaved(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setSaved(false), 1600);
  };
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return [saved, flash] as const;
}

function SavedFlash({ saved }: { saved: boolean }) {
  return (
    <AnimatePresence>
      {saved && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="text-[11.5px] font-semibold text-emerald-600"
        >
          ✓ Guardado
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function EventSchemeCard({
  scheme,
  onSave,
  saving,
}: {
  scheme: EventPromoterScheme | undefined;
  onSave: (patch: Partial<EventPromoterScheme>) => void;
  saving: boolean;
}) {
  // Esquema "para todos": mismo editor unificado (dos ejes colapsables) + el
  // cupo default del evento debajo. El % del evento en null hereda de la marca.
  const brand = useOrgScheme();
  return (
    <div className="flex flex-col gap-3">
      <CommissionSchemeEditor
        variant="page"
        saving={saving}
        pct={scheme?.commissionPct ?? null}
        config={scheme?.commissionConfig}
        onPctChange={(v) => onSave({ commissionPct: v })}
        onConfigChange={(cfg) => onSave({ commissionConfig: cfg })}
        inheritedPct={brand.data?.commissionPct ?? 0}
        inheritLabel="tu marca"
      />

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 lg:px-5">
        <SchemeCupo
          label="Cada uno vende"
          value={scheme?.defaultQuota ?? null}
          min={1}
          onChange={(v) => onSave({ defaultQuota: v })}
        />
      </div>
    </div>
  );
}

// Un cupo default del evento: etiqueta + pastilla editable (popover/drawer).
// Cupo default del evento, editable INLINE (sin popover): clic en el valor →
// input en el sitio + "sin tope". Más directo en desktop.
function SchemeCupo({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState("");
  const start = () => {
    setLocal(value != null ? String(value) : "");
    setEditing(true);
  };
  const commit = () => {
    const n = parseInt(local, 10);
    if (!(local.trim() === "" || isNaN(n) || n < min)) onChange(n);
    setEditing(false);
  };
  return (
    <div className="rounded-xl bg-cart-bg-elev-2 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
        {label}
      </div>
      {editing ? (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={min}
            value={local}
            autoFocus
            placeholder="sin tope"
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-24 rounded-lg bg-cart-bg-elev px-2.5 py-1.5 text-[16px] font-bold outline-none ring-1 ring-cart-line-strong focus:ring-cart-accent"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(null);
              setEditing(false);
            }}
            className="text-[11.5px] font-medium text-cart-ink-3 transition hover:text-cart-ink"
          >
            Sin tope
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg text-[18px] font-bold text-cart-ink transition hover:text-cart-accent"
        >
          {value == null ? "sin tope" : value}
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-cart-ink-4" aria-hidden>
            <path d="M9 2.5l2.5 2.5-6 6H3v-2.5l6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Hitos en efectivo del evento: lista editable de (ventas → S/). Guarda al editar.

// Fila LIMPIA: nombre + link + copiar/WhatsApp. Los cupos/comisión van como
// números EFECTIVOS de referencia (un puntito • = personalizado). Tocar la fila
// abre el sheet de personalización (sin saltar de página). Sin perillas inline.
function AssignmentRow({
  assignment,
  onOpen,
}: {
  assignment: EventPromoterAssignment;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const a = assignment;
  // Why: assignment.url puede venir absoluta (con origin) o relativa (/r/code).
  const absoluteUrl = () => {
    if (typeof window === "undefined") return a.url;
    return a.url.startsWith("/") ? `${window.location.origin}${a.url}` : a.url;
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };
  const onWa = () => {
    if (!a.whatsapp) return;
    const text = encodeURIComponent(
      `Hola ${a.name.split(" ")[0]}, este es tu link para vender el evento: ${absoluteUrl()}`,
    );
    window.open(`https://wa.me/${a.whatsapp.replace(/[^\d]/g, "")}?text=${text}`, "_blank");
  };
  const inactive = !a.active;
  const commissionRef =
    `${a.effectiveCommissionPct}%${(a.effectiveConfig?.milestones.length ?? 0) > 0 ? " + metas" : ""}`;
  const quotaRef = a.effectiveQuota == null ? "sin tope" : String(a.effectiveQuota);

  return (
    <div className={"flex items-center gap-2 px-4 py-3 lg:px-5 " + (inactive ? "opacity-60" : "")}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[14px] font-semibold text-cart-accent">
          {(a.name[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{a.name}</span>
            {inactive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cart-ink-4/15 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-cart-ink-3">
                <span className="size-1 rounded-full bg-cart-ink-3" />
                DESACTIVADO
              </span>
            ) : (
              !a.profileId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-700">
                  <span className="size-1 rounded-full bg-amber-300" />
                  SIN ACTIVAR
                </span>
              )
            )}
          </div>
          {/* Referencia efectiva. El punto • marca, sin gritar, lo personalizado. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-cart-ink-4">
            <RefBit custom={a.commissionCustom}>{commissionRef}</RefBit>
            <RefBit custom={a.quotaCustom}>vende {quotaRef}</RefBit>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onCopy}
        disabled={inactive}
        title={inactive ? "Link desactivado" : undefined}
        className="shrink-0 rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium transition hover:bg-cart-line-strong disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cart-bg-elev-2"
      >
        {copied ? "✓" : "Copiar link"}
      </button>
      {a.whatsapp && !inactive && (
        <button
          type="button"
          onClick={onWa}
          aria-label="WhatsApp"
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{ background: "#25D366" }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#062315">
            <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3z" />
          </svg>
        </button>
      )}
      <span className="shrink-0 text-[18px] text-cart-ink-4" aria-hidden>
        ›
      </span>
    </div>
  );
}

// Un dato de referencia en la fila. Punto • en acento si está personalizado.
function RefBit({ custom, children }: { custom: boolean; children: ReactNode }) {
  return (
    <span className={custom ? "text-cart-accent" : undefined}>
      {custom && <span aria-hidden>• </span>}
      {children}
    </span>
  );
}

// Contenido del sheet/drawer de personalización de un promotor. Solo personaliza
// (comisión / vende + quitar). Cada campo dice "del evento" o el valor
// propio; nunca aparece la palabra "override". KPIs/ventas viven en otro lado.
export type PayPatch = {
  commissionPct?: number | null;
  commissionConfig?: CommissionConfig | null;
  quota?: number | null;
};

export function PersonalizeSheet({
  assignment,
  onSet,
  onRemove,
  saving,
}: {
  assignment: EventPromoterAssignment;
  onSet: (patch: PayPatch) => void;
  onRemove: () => void;
  saving: boolean;
}) {
  const a = assignment;
  const first = a.name.split(" ")[0];
  const [payOpen, setPayOpen] = useState(false);

  const paySummary =
    `${a.effectiveCommissionPct}%${(a.effectiveConfig?.milestones.length ?? 0) > 0 ? " + metas" : ""}`;

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-1 pb-1">
        <p className="text-[12.5px] leading-relaxed text-cart-ink-3">
          Cambia solo lo de {first}; el resto sigue el esquema del evento.
        </p>
        <span className="shrink-0 pt-0.5 text-[11px] font-medium text-cart-ink-4">
          Se guarda solo
        </span>
      </div>
      <div className="divide-y divide-cart-line">
        {/* Cómo le pagas — colapsible: la fila queda y el editor se despliega abajo. */}
        <div>
          <button
            type="button"
            onClick={() => setPayOpen((v) => !v)}
            aria-expanded={payOpen}
            className="group flex w-full items-center justify-between gap-3 py-3.5 text-left"
          >
            <div>
              <div className="text-[13.5px] font-medium">Cómo le pagas</div>
              <div className="text-[11.5px] text-cart-ink-4">% por venta, hitos o especie</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {a.commissionCustom ? (
                <span className="rounded-full bg-cart-accent-soft px-2.5 py-1 text-[12.5px] font-semibold text-cart-accent">
                  {paySummary}
                </span>
              ) : (
                <span className="text-[12.5px] text-cart-ink-3">{paySummary} · del evento</span>
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className={
                  "transition-transform duration-200 " +
                  (payOpen ? "rotate-90 text-cart-ink-2" : "text-cart-ink-4 group-hover:text-cart-ink-2")
                }
                aria-hidden
              >
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
          <AnimatePresence initial={false}>
            {payOpen && (
              <motion.div
                key="pay-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pb-4">
                  <PayEditor assignment={a} onSet={onSet} saving={saving} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <InlineField
          label="Cuánto vende"
          hint="entradas que puede vender"
          custom={a.quotaCustom}
          inheritedText={(a.effectiveQuota == null ? "sin tope" : a.effectiveQuota) + " · del evento"}
          ownValue={a.ownQuota}
          min={1}
          onSave={(v) => onSet({ quota: v })}
          onReset={() => onSet({ quota: null })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-4 self-start text-[12.5px] font-medium text-rose-600/80 transition hover:text-rose-600"
      >
        Quitar del evento
      </button>
    </div>
  );
}

// Editor de "Cómo le pagas" de UN promotor: 3 modalidades (% / hitos / especie).
// Se despliega como colapsible en la fila. Escribe el override del link
// (tipo + % o config); "usar el del evento" lo limpia para heredar.
function PayEditor({
  assignment,
  onSet,
  saving,
}: {
  assignment: EventPromoterAssignment;
  onSet: (patch: PayPatch) => void;
  saving: boolean;
}) {
  const a = assignment;
  // Mismo editor unificado que el evento/marca, en variante drawer (agrega
  // hitos/premios inline, sin abrir otro drawer encima). Muestra el valor propio
  // o, si no lo personalizó, el heredado del evento.
  return (
    <div className="flex flex-col gap-3">
      <CommissionSchemeEditor
        variant="drawer"
        saving={saving}
        pct={a.ownCommissionPct}
        config={a.ownCommissionConfig ?? a.effectiveConfig}
        onPctChange={(v) => onSet({ commissionPct: v })}
        onConfigChange={(cfg) => onSet({ commissionConfig: cfg })}
        inheritedPct={a.inheritedCommissionPct}
        inheritLabel="el evento"
      />
      {a.commissionCustom && (
        <button
          type="button"
          onClick={() => onSet({ commissionPct: null, commissionConfig: null })}
          className="self-start rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-cart-ink"
        >
          Usar el del evento
        </button>
      )}
    </div>
  );
}

// Campo personalizable: muestra el valor propio o "del evento". Editar inline.
function InlineField({
  label,
  hint,
  custom,
  inheritedText,
  ownValue,
  min,
  max,
  unit,
  onSave,
  onReset,
}: {
  label: string;
  hint: string;
  custom: boolean;
  inheritedText: string;
  ownValue: number | null;
  min: number;
  max?: number;
  unit?: string;
  onSave: (v: number) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState("");
  const [saved, flash] = useSavedFlash();
  const toggle = () => {
    if (!open) setLocal(ownValue != null && ownValue !== -1 ? String(ownValue) : "");
    setOpen((v) => !v);
  };
  const commit = () => {
    const num = parseInt(local, 10);
    if (!(local.trim() === "" || isNaN(num) || num < min || (max != null && num > max))) {
      onSave(num);
      flash();
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">{label}</div>
          <div className="text-[11.5px] text-cart-ink-4">{hint}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {custom ? (
            <span className="rounded-full bg-cart-accent-soft px-2.5 py-1 text-[12.5px] font-semibold text-cart-accent">
              {ownValue === -1 ? "sin tope" : `${ownValue}${unit ?? ""}`}
            </span>
          ) : (
            <span className="text-[12.5px] text-cart-ink-3">{inheritedText}</span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={
              "transition-transform duration-200 " +
              (open ? "rotate-90 text-cart-ink-2" : "text-cart-ink-4 group-hover:text-cart-ink-2")
            }
            aria-hidden
          >
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="field-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pb-4">
              <input
                type="number"
                min={min}
                max={max}
                value={local}
                autoFocus
                placeholder="sin tope"
                onChange={(e) => setLocal(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setOpen(false);
                }}
                className="w-24 rounded-xl bg-cart-bg-elev-2 px-3 py-2 text-center text-[15px] font-semibold outline-none ring-1 ring-cart-line-strong focus:ring-cart-accent"
              />
              {unit && <span className="text-[14px] text-cart-ink-3">{unit}</span>}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setLocal("");
                  onSave(-1);
                  flash();
                }}
                className={
                  "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition " +
                  (ownValue === -1
                    ? "bg-cart-accent-soft text-cart-accent"
                    : "bg-cart-bg-elev-2 text-cart-ink-2 ring-1 ring-cart-line-strong hover:text-cart-ink")
                }
              >
                Sin tope
              </button>
              {custom && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setLocal("");
                    onReset();
                    flash();
                  }}
                  className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-cart-ink"
                >
                  Usar el del evento
                </button>
              )}
              <SavedFlash saved={saved} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PoolPicker({
  available,
  busy,
  onConfirm,
}: {
  available: Array<{
    id: string;
    name: string;
    whatsapp: string | null;
    defaultCommissionPct: number | null;
    profileId: string | null;
  }>;
  busy: boolean;
  onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 pb-6 text-center">
        <p className="max-w-[280px] text-[13.5px] text-cart-ink-3">
          Ya asignaste todos los promotores de tu pool, o aún no tienes ninguno.
        </p>
        <Link
          href="/org/team"
          className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white"
        >
          Ir a Equipo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="text-[12.5px] text-cart-ink-3">
        Elige del pool de tu marca. Puedes ajustar el % por evento después.
      </div>
      <div className="flex flex-col gap-2">
        {available.map((p) => {
          const checked = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition " +
                (checked
                  ? "border-cart-accent bg-cart-accent-soft"
                  : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
              }
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[13px] font-semibold text-cart-ink-2">
                {(p.name[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  {!p.profileId && (
                    <span className="rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-700">
                      SIN ACTIVAR
                    </span>
                  )}
                </div>
                {p.whatsapp && (
                  <div className="truncate font-mono text-[11px] text-cart-ink-3">{p.whatsapp}</div>
                )}
              </div>
              <span className="rounded-full bg-cart-accent-soft px-2 py-1 text-[11px] font-semibold text-cart-accent">
                {p.defaultCommissionPct == null ? "Igual que marca" : `${p.defaultCommissionPct}%`}
              </span>
              <span
                className={
                  "grid size-6 shrink-0 place-items-center rounded-full border transition " +
                  (checked
                    ? "border-cart-accent bg-cart-accent text-white"
                    : "border-cart-line-strong text-transparent")
                }
              >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5.5l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(Array.from(selected))}
        disabled={busy || selected.size === 0}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-cart-accent px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
      >
        {busy
          ? "Asignando…"
          : selected.size === 0
            ? "Selecciona al menos uno"
            : `Asignar ${selected.size} al evento`}
      </button>
    </div>
  );
}

// ============================================================
// DOOR SECTION
// ============================================================
function DoorSection({ slug }: { slug: string }) {
  const door = useDoorLink(slug);
  const stats = useEventStats(slug);
  const porteros = (stats.data?.doors ?? []).filter((d) => d.holderName);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!door.data?.url) return;
    try {
      await navigator.clipboard.writeText(door.data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };

  const onWa = () => {
    if (!door.data?.url) return;
    const text = encodeURIComponent(`Para escanear en la puerta: ${door.data.url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <section>
      <SectionHeader
        title="Portero"
        subtitle="Quien escanea QRs en la puerta. Comparte este link y se abre la app de escaneo."
      />
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
        {door.data?.url ? (
          <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              {copied ? "Copiado" : "Link"}
            </div>
            <div className="mt-1 truncate font-mono text-[12px] font-semibold text-cart-ink">
              {door.data.url}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-cart-line bg-cart-bg-elev-2/40 px-3 py-3 text-[12px] text-cart-ink-3">
            Generando link…
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-xl bg-cart-bg-elev-2 px-3 py-2 text-[12.5px] font-medium transition hover:bg-cart-line-strong"
          >
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={onWa}
            aria-label="WhatsApp"
            className="grid size-9 place-items-center rounded-xl"
            style={{ background: "#25D366" }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#062315">
              <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3z" />
            </svg>
          </button>
        </div>
        {door.data?.code && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-cart-bg-elev-2/60 px-3 py-2">
            <div className="min-w-0 truncate">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Código
              </span>
              <span className="ml-2 font-mono text-[12px] font-semibold text-cart-ink">
                {door.data.code}
              </span>
            </div>
          </div>
        )}
      </div>

      {porteros.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
            Porteros conectados
          </p>
          {porteros.map((p) => (
            <div
              key={p.deviceId}
              className="flex items-center gap-3 rounded-xl border border-cart-line bg-cart-bg-elev px-3.5 py-2.5"
            >
              <span
                className={
                  "size-1.5 shrink-0 rounded-full " +
                  (p.isStale ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]")
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-cart-ink">{p.holderName}</p>
                <p className="mt-0.5 text-[11px] text-cart-ink-3">
                  {p.dniLast2 ? `DNI ··${p.dniLast2}` : "DNI no registrado"}
                  {p.zoneName ? ` · ${p.zoneName}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10.5px] text-cart-ink-3">
                {p.isStale ? "Sin sincronizar" : "Activo"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// SHARED BITS
// ============================================================
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-sans text-[18px] font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-cart-ink-3">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center lg:px-5">
      <div className="text-[14px] font-semibold">{title}</div>
      {description && (
        <p className="max-w-[400px] text-[12.5px] text-cart-ink-3">{description}</p>
      )}
      {cta && (
        <Link
          href={cta.href as never}
          className="mt-1 text-[13px] font-semibold text-cart-accent hover:underline"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[12px] font-semibold text-cart-ink-2">
      {(name[0] ?? "?").toUpperCase()}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

