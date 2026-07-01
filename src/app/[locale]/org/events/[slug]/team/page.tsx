"use client";

import { use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useDoorLink } from "@/lib/events/hooks/useDoorLink";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
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
  useEventPromoterScheme,
  useRemoveAssignment,
  useUpdateAssignmentCommission,
  useUpdateEventPromoterScheme,
} from "@/lib/promoters/hooks/useEventPromoters";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";
import type { EventPromoterScheme } from "@/server/events/ports/EventRepository";
import type {
  CommissionConfig,
  CommissionReward,
  CommissionTier,
  CommissionType,
} from "@/server/promoters/domain/OrgPromoter";
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
export function PromotersSection({ slug }: { slug: string }) {
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
      {/* 1 · Configuración para todos */}
      {assigned.length > 0 && (
        <section>
          <SectionHeader
            title="Esquema del evento"
            subtitle="Comisión y cupos para todos los promotores. Lo defines una vez; personaliza a uno tocándolo abajo."
          />
          <EventSchemeCard
            scheme={scheme.data}
            onSave={(patch) => updateScheme.mutate(patch)}
            saving={updateScheme.isPending}
          />
        </section>
      )}

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
function AutoSave({ saving }: { saving: boolean }) {
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(saving);
  useEffect(() => {
    if (prev.current && !saving) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1800);
      prev.current = saving;
      return () => clearTimeout(t);
    }
    prev.current = saving;
  }, [saving]);
  return (
    <span className="text-[11px] font-medium">
      {saving ? (
        <span className="text-cart-ink-3">Guardando…</span>
      ) : justSaved ? (
        <span className="text-emerald-300">✓ Guardado</span>
      ) : (
        <span className="text-cart-ink-4">Se guarda solo</span>
      )}
    </span>
  );
}

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
          className="text-[11.5px] font-semibold text-emerald-300"
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
  const type: CommissionType = scheme?.commissionType ?? "percentage";
  const tabs: [CommissionType, string][] = [
    ["percentage", "Comisión %"],
    ["tiered", "Hitos"],
    ["inkind", "Especie"],
  ];
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex gap-1 rounded-xl bg-cart-bg-elev-2 p-1">
        {tabs.map(([t, lbl]) => (
          <button
            key={t}
            type="button"
            onClick={() => onSave({ commissionType: t })}
            className={
              "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition " +
              (type === t ? "bg-cart-accent text-white" : "text-cart-ink-3 hover:text-white")
            }
          >
            {lbl}
          </button>
        ))}
        </div>
        <AutoSave saving={saving} />
      </div>

      <div className="mt-3">
        {type === "percentage" && (
          <PctRow
            value={scheme?.commissionPct ?? 0}
            onSave={(v) =>
              onSave({ commissionType: "percentage", commissionPct: v, commissionConfig: null })
            }
          />
        )}
        {type === "tiered" && (
          <TiersEditor
            config={scheme?.commissionConfig}
            onSave={(tiers) =>
              onSave({ commissionType: "tiered", commissionConfig: { tiers } })
            }
          />
        )}
        {type === "inkind" && (
          <RewardsEditor
            config={scheme?.commissionConfig}
            onSave={(rewards) =>
              onSave({ commissionType: "inkind", commissionConfig: { rewards } })
            }
          />
        )}
      </div>

      <div className="mt-4 border-t border-cart-line pt-4">
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
            className="text-[11.5px] font-medium text-cart-ink-3 transition hover:text-white"
          >
            Sin tope
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg text-[18px] font-bold text-white transition hover:text-cart-accent"
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
function TiersEditor({
  config,
  onSave,
}: {
  config: CommissionConfig | undefined;
  onSave: (tiers: CommissionTier[]) => void;
}) {
  const initial = config && "tiers" in config ? config.tiers : [];
  const [tiers, setTiers] = useState<CommissionTier[]>(initial);
  const commit = (next: CommissionTier[]) => {
    setTiers(next);
    onSave(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px]">
          <input
            type="number"
            min={1}
            value={t.salesCount || ""}
            onChange={(e) =>
              setTiers((p) => p.map((x, j) => (j === i ? { ...x, salesCount: Number(e.target.value) || 0 } : x)))
            }
            onBlur={() => onSave(tiers)}
            className="w-16 rounded-lg bg-cart-bg-elev-2 px-2 py-1.5 text-center outline-none"
          />
          <span className="text-cart-ink-3">ventas →</span>
          <span className="text-cart-ink-3">S/</span>
          <input
            type="number"
            min={0}
            value={t.payoutCents ? t.payoutCents / 100 : ""}
            onChange={(e) =>
              setTiers((p) =>
                p.map((x, j) => (j === i ? { ...x, payoutCents: Math.round((Number(e.target.value) || 0) * 100) } : x)),
              )
            }
            onBlur={() => onSave(tiers)}
            className="w-20 rounded-lg bg-cart-bg-elev-2 px-2 py-1.5 text-center outline-none"
          />
          <button
            type="button"
            onClick={() => commit(tiers.filter((_, j) => j !== i))}
            className="ml-auto text-cart-ink-4 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...tiers, { salesCount: 0, payoutCents: 0 }])}
        className="rounded-xl border border-dashed border-cart-line-strong py-2 text-[12.5px] font-medium text-cart-accent"
      >
        + Agregar hito
      </button>
    </div>
  );
}

// Premios en especie del evento: lista de (ventas → premio).
function RewardsEditor({
  config,
  onSave,
}: {
  config: CommissionConfig | undefined;
  onSave: (rewards: CommissionReward[]) => void;
}) {
  const initial = config && "rewards" in config ? config.rewards : [];
  const [rewards, setRewards] = useState<CommissionReward[]>(initial);
  const commit = (next: CommissionReward[]) => {
    setRewards(next);
    onSave(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {rewards.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px]">
          <input
            type="number"
            min={1}
            value={r.salesCount || ""}
            onChange={(e) =>
              setRewards((p) => p.map((x, j) => (j === i ? { ...x, salesCount: Number(e.target.value) || 0 } : x)))
            }
            onBlur={() => onSave(rewards)}
            className="w-16 rounded-lg bg-cart-bg-elev-2 px-2 py-1.5 text-center outline-none"
          />
          <span className="text-cart-ink-3">ventas →</span>
          <input
            type="text"
            value={r.label}
            placeholder="Botella, entrada VIP…"
            onChange={(e) =>
              setRewards((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
            }
            onBlur={() => onSave(rewards)}
            className="flex-1 rounded-lg bg-cart-bg-elev-2 px-2.5 py-1.5 outline-none"
          />
          <button
            type="button"
            onClick={() => commit(rewards.filter((_, j) => j !== i))}
            className="text-cart-ink-4 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...rewards, { salesCount: 0, label: "", icon: "🎁" }])}
        className="rounded-xl border border-dashed border-cart-line-strong py-2 text-[12.5px] font-medium text-cart-accent"
      >
        + Agregar premio
      </button>
    </div>
  );
}

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
    a.commissionType === "percentage"
      ? `${a.effectiveCommissionPct}%`
      : a.commissionType === "tiered"
        ? "hitos"
        : "especie";
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
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-300">
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
        className="shrink-0 rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cart-bg-elev-2"
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
type PayPatch = {
  commissionPct?: number | null;
  commissionType?: CommissionType | null;
  commissionConfig?: CommissionConfig | null;
  quota?: number | null;
};

function PersonalizeSheet({
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
    a.commissionType === "percentage"
      ? `${a.effectiveCommissionPct}%`
      : a.commissionType === "tiered"
        ? "hitos"
        : "especie";

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
                  <PayEditor assignment={a} onSet={onSet} />
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
        className="mt-4 self-start text-[12.5px] font-medium text-rose-300/80 transition hover:text-rose-300"
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
}: {
  assignment: EventPromoterAssignment;
  onSet: (patch: PayPatch) => void;
}) {
  const a = assignment;
  const type = a.ownCommissionType ?? a.commissionType;
  const [saved, flash] = useSavedFlash();
  const set = (patch: PayPatch) => {
    onSet(patch);
    flash();
  };
  const modes: [CommissionType, string][] = [
    ["percentage", "Comisión %"],
    ["tiered", "Hitos"],
    ["inkind", "Especie"],
  ];
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-cart-bg-elev-2 p-1">
          {modes.map(([t, lbl]) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ commissionType: t })}
              className={
                "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition " +
                (type === t ? "bg-cart-accent text-white" : "text-cart-ink-3 hover:text-white")
              }
            >
              {lbl}
            </button>
          ))}
        </div>
        <SavedFlash saved={saved} />
      </div>
      <div className="mt-3">
        {type === "percentage" && (
          <PctRow
            value={a.ownCommissionPct ?? a.effectiveCommissionPct}
            onSave={(v) =>
              set({ commissionType: "percentage", commissionPct: v, commissionConfig: null })
            }
          />
        )}
        {type === "tiered" && (
          <TiersEditor
            config={a.ownCommissionConfig ?? undefined}
            onSave={(tiers) => set({ commissionType: "tiered", commissionConfig: { tiers } })}
          />
        )}
        {type === "inkind" && (
          <RewardsEditor
            config={a.ownCommissionConfig ?? undefined}
            onSave={(rewards) => set({ commissionType: "inkind", commissionConfig: { rewards } })}
          />
        )}
      </div>
      {a.commissionCustom && (
        <button
          type="button"
          onClick={() => set({ commissionType: null, commissionPct: null, commissionConfig: null })}
          className="mt-3 rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-white"
        >
          Usar el del evento
        </button>
      )}
    </div>
  );
}

// Input de % por venta. Guarda al salir del campo o con Enter.
function PctRow({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const commit = () => {
    const n = parseInt(local, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) onSave(n);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={100}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="w-20 rounded-xl bg-cart-bg-elev-2 px-3 py-2 text-center text-[15px] font-semibold outline-none ring-1 ring-cart-line-strong focus:ring-cart-accent"
      />
      <span className="text-[13px] text-cart-ink-3">% por venta</span>
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
                    : "bg-cart-bg-elev-2 text-cart-ink-2 ring-1 ring-cart-line-strong hover:text-white")
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
                  className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-white"
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
            <div className="mt-1 truncate font-mono text-[12px] font-semibold text-white">
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
        {door.data?.code && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-cart-bg-elev-2/60 px-3 py-2">
            <div className="min-w-0 truncate">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Código
              </span>
              <span className="ml-2 font-mono text-[12px] font-semibold text-white">
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
                <p className="truncate text-[13px] font-semibold text-white">{p.holderName}</p>
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
