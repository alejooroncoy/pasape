"use client";

import { use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useDoorLink } from "@/lib/events/hooks/useDoorLink";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useOrgInvites } from "@/lib/identity/organizations/hooks/useOrgInvites";
import {
  useAddEventCoOrganizer,
  useEventCoOrganizers,
  useRemoveEventCoOrganizer,
} from "@/lib/events/hooks/useEventCoOrganizers";
import { useOrgPromoters } from "@/lib/promoters/hooks/useOrgPromoters";
import {
  useAssignPromotersToEvent,
  useEventPromoters,
  useRemoveAssignment,
  useUpdateAssignmentCommission,
} from "@/lib/promoters/hooks/useEventPromoters";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";
import { EventShell } from "../_shell/EventShell";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventTeamPage({ params }: { params: Params }) {
  const { slug } = use(params);

  return (
    <EventShell slug={slug} active="team">
      <Disclaimer />

      <div className="mt-6 flex flex-col gap-8">
        <InheritedAccessSection />
        <EventCoOrganizersSection slug={slug} />
        <PromotersSection slug={slug} />
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
    <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3 sm:inline-flex">
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
  const remove = useRemoveEventCoOrganizer(slug);
  const [picker, setPicker] = useState(false);

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
        subtitle="Gente del equipo de tu marca invitada solo a este evento."
        action={
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
          >
            <PlusIcon /> Agregar de tu equipo
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
                  className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium text-cart-ink-2 transition hover:bg-red-500/10 hover:text-red-300"
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
            onClose={() => setPicker(false)}
            title={
              available.length > 0
                ? "Agregar del equipo"
                : "No hay nadie disponible"
            }
          >
            <CoOrgPicker
              available={available}
              busy={add.isPending}
              onPick={(profileId) =>
                add.mutate(profileId, {
                  onSuccess: () => setPicker(false),
                })
              }
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
}: {
  available: Array<{
    profileId: string;
    fullName: string | null;
    email: string | null;
    role: string;
  }>;
  busy: boolean;
  onPick: (profileId: string) => void;
}) {
  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 pb-6 text-center">
        <p className="max-w-[280px] text-[13.5px] text-cart-ink-3">
          Todo el equipo de tu marca ya está acá, o aún no tienes a nadie.
        </p>
        <Link
          href="/org/team"
          className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white"
        >
          Ir a Equipo de la marca
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pb-4">
      <p className="text-[12.5px] text-cart-ink-3">
        Elige a quién sumar como co-organizador solo de este evento.
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
  );
}

// ============================================================
// PROMOTERS SECTION (sin cambios funcionales — sigue editable)
// ============================================================
function PromotersSection({ slug }: { slug: string }) {
  const pool = useOrgPromoters();
  const assignments = useEventPromoters(slug);
  const assign = useAssignPromotersToEvent(slug);
  const remove = useRemoveAssignment(slug);
  const updateCommission = useUpdateAssignmentCommission(slug);
  const [picker, setPicker] = useState(false);

  const assigned = assignments.data ?? [];
  const assignedSet = useMemo(
    () => new Set(assigned.map((a) => a.orgPromoterId)),
    [assigned],
  );
  const available = (pool.data ?? []).filter((p) => !assignedSet.has(p.id));

  return (
    <section id="promotores" className="scroll-mt-24">
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
                onRemove={() => {
                  if (confirm(`¿Quitar a ${a.name} de este evento?`)) remove.mutate(a.promoterLinkId);
                }}
                onChangeCommission={(pct) =>
                  updateCommission.mutate({ linkId: a.promoterLinkId, commissionPct: pct })
                }
                onChangeQuota={(quota) =>
                  updateCommission.mutate({ linkId: a.promoterLinkId, quota })
                }
              />
            ))}
          </div>
        )}
      </div>

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
      </AnimatePresence>
    </section>
  );
}

function AssignmentRow({
  assignment,
  onRemove,
  onChangeCommission,
  onChangeQuota,
}: {
  assignment: EventPromoterAssignment;
  onRemove: () => void;
  onChangeCommission: (pct: number) => void;
  onChangeQuota: (quota: number | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  // Why: assignment.url puede venir absoluta (con origin) o relativa (/r/code).
  // Si ya es absoluta, no le prependeamos otro origin (causaba el doble URL
  // http://localhost:3001http://localhost:3001/r/...).
  const absoluteUrl = () => {
    if (typeof window === "undefined") return assignment.url;
    return assignment.url.startsWith("/")
      ? `${window.location.origin}${assignment.url}`
      : assignment.url;
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
    if (!assignment.whatsapp) return;
    const text = encodeURIComponent(
      `Hola ${assignment.name.split(" ")[0]}, este es tu link para vender el evento: ${absoluteUrl()}`,
    );
    const phone = assignment.whatsapp.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };
  const inactive = !assignment.active;
  return (
    <div
      className={
        "grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[auto_1fr_auto_auto_auto_auto] lg:items-center lg:px-5 " +
        (inactive ? "opacity-60" : "")
      }
    >
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[14px] font-semibold text-cart-accent">
          {(assignment.name[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">
              {assignment.name}
            </span>
            {inactive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cart-ink-4/15 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-cart-ink-3">
                <span className="size-1 rounded-full bg-cart-ink-3" />
                DESACTIVADO
              </span>
            ) : (
              !assignment.profileId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-300">
                  <span className="size-1 rounded-full bg-amber-300" />
                  SIN ACTIVAR
                </span>
              )
            )}
          </div>
          <div className="truncate font-mono text-[10.5px] text-cart-ink-3">/r/{assignment.code}</div>
        </div>
      </div>

      <div className="hidden text-[11.5px] text-cart-ink-3 lg:block">
        {assignment.whatsapp || "—"}
      </div>

      <CommissionEditor value={assignment.eventCommissionPct} onChange={onChangeCommission} />
      <QuotaEditor value={assignment.quota} onChange={onChangeQuota} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={inactive}
          title={inactive ? "Link desactivado" : undefined}
          className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cart-bg-elev-2"
        >
          {copied ? "✓" : "Copiar link"}
        </button>
        {assignment.whatsapp && !inactive && (
          <button
            type="button"
            onClick={onWa}
            aria-label="WhatsApp"
            className="grid size-8 place-items-center rounded-full"
            style={{ background: "#25D366" }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="#062315">
              <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3z" />
            </svg>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar"
        className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-red-500/10 hover:text-red-300"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function CommissionEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocal(value);
          setEditing(true);
        }}
        className="rounded-full bg-cart-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-cart-accent transition hover:bg-cart-accent-soft/80"
      >
        {value}%
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={100}
        value={local}
        onChange={(e) => setLocal(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        autoFocus
        className="w-14 rounded-lg bg-cart-bg-elev-2 px-2 py-1 text-center font-mono text-[12px] outline-none"
      />
      <button
        type="button"
        onClick={() => {
          onChange(local);
          setEditing(false);
        }}
        className="rounded-lg bg-cart-accent px-2 py-1 text-[11px] font-semibold text-white"
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg px-1 py-1 text-[11px] text-cart-ink-3 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

function QuotaEditor({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<string>("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocal(value !== null ? String(value) : "");
          setEditing(true);
        }}
        className="rounded-full bg-white/8 px-2.5 py-1 text-[11.5px] font-semibold text-cart-ink-2 transition hover:bg-white/12"
      >
        {value === null ? "∞" : `${value} ent.`}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={local}
        placeholder="∞"
        onChange={(e) => setLocal(e.target.value)}
        autoFocus
        className="w-16 rounded-lg bg-cart-bg-elev-2 px-2 py-1 text-center font-mono text-[12px] outline-none"
      />
      <button
        type="button"
        onClick={() => {
          const num = parseInt(local, 10);
          // Vacío/<1 NO se interpreta como ilimitado: se descarta el cambio.
          // Para quitar el tope hay que usar "Sin límite" explícitamente.
          if (local.trim() === "" || isNaN(num) || num < 1) {
            setEditing(false);
            return;
          }
          onChange(num);
          setEditing(false);
        }}
        className="rounded-lg bg-cart-accent px-2 py-1 text-[11px] font-semibold text-white"
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(null);
          setEditing(false);
        }}
        title="Quitar el tope de ventas"
        className="rounded-lg bg-white/8 px-2 py-1 text-[11px] font-medium text-cart-ink-2 hover:bg-white/12"
      >
        ∞ Sin límite
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg px-1 py-1 text-[11px] text-cart-ink-3 hover:text-white"
      >
        ✕
      </button>
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
    defaultCommissionPct: number;
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
                    <span className="rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-300">
                      SIN ACTIVAR
                    </span>
                  )}
                </div>
                {p.whatsapp && (
                  <div className="truncate font-mono text-[11px] text-cart-ink-3">{p.whatsapp}</div>
                )}
              </div>
              <span className="rounded-full bg-cart-accent-soft px-2 py-1 text-[11px] font-semibold text-cart-accent">
                {p.defaultCommissionPct}%
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
        action={
          <Link
            href={`/org/events/${slug}/door-link` as never}
            className="hidden rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5 text-[12px] font-medium text-cart-ink-2 transition hover:text-white sm:inline-flex"
          >
            Configurar →
          </Link>
        }
      />
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
        {door.data?.url ? (
          <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              {copied ? "Copiado" : "Link"}
            </div>
            <div className="mt-1 truncate font-mono text-[12px] font-semibold text-white">
              {door.data.code ?? door.data.url}
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
            className="flex-1 rounded-xl bg-cart-bg-elev-2 px-3 py-2 text-[12.5px] font-medium transition hover:bg-white/10"
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
      </div>
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

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (isDesktop) {
    return (
      <>
        <motion.div
          key="bd-desktop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          key="sh-desktop"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 380 }}
          className="fixed right-0 top-0 z-81 flex h-dvh w-full max-w-[520px] flex-col border-l border-cart-line-strong bg-cart-bg-elev shadow-[-20px_0_60px_-10px_rgba(0,0,0,0.7)]"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cart-line bg-cart-bg-elev/95 px-6 py-4 backdrop-blur">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div
        key="bd-mobile"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        key="sh-mobile"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 140 || info.velocity.y > 700) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-81 mx-auto max-h-[88dvh] w-full max-w-[560px] touch-none overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="sticky top-0 z-10 -mx-px flex flex-col bg-cart-bg-elev/95 px-5 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-semibold text-cart-accent"
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="px-5">{children}</div>
      </motion.div>
    </>
  );
}
