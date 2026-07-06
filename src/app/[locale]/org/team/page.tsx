"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Money } from "@/lib/_shared/money";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { OrgShell } from "@/app/[locale]/org/_shell/OrgShell";
import { PhoneField } from "@/components/design/PhoneField";
import { useOrgInvites } from "@/lib/identity/organizations/hooks/useOrgInvites";
import { useCreateInvite } from "@/lib/identity/organizations/hooks/useCreateInvite";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useLegalEntities } from "@/lib/identity/organizations/hooks/useLegalEntities";
import {
  useCreateOrgPromoter,
  useDeleteOrgPromoter,
  useOrgPromoters,
  useOrgScheme,
  useUpdateOrgPromoter,
  useUpdateOrgScheme,
} from "@/lib/promoters/hooks/useOrgPromoters";
import type { CommissionConfig, OrgPromoter } from "@/server/promoters/domain/OrgPromoter";
import { CommissionSchemeEditor } from "@/components/promoters/CommissionSchemeEditor";

type Tab = "coorg" | "promoters";

export default function OrgTeamPage() {
  return (
    <Suspense fallback={null}>
      <OrgTeamPageInner />
    </Suspense>
  );
}

function OrgTeamPageInner() {
  const params = useSearchParams();
  const initialTab: Tab = params.get("tab") === "promoters" ? "promoters" : "coorg";
  const [tab, setTab] = useState<Tab>(initialTab);
  const promoters = useOrgPromoters();
  const invites = useOrgInvites();

  // Solo activos (antes sumaba invitaciones pendientes y no coincidía con la
  // sección "Activos").
  const coorgCount = invites.data?.members?.length ?? 0;
  const promCount = promoters.data?.length ?? 0;

  return (
    <OrgShell>
      <div className="mb-5 sm:mb-6 lg:mb-8">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[26px] sm:font-semibold sm:tracking-[-0.02em] lg:text-[30px]">
          Tu equipo
        </h1>
        <p className="mt-1.5 text-[15px] leading-snug text-cart-ink-3 sm:mt-1 sm:text-[13px]">
          Quién está contigo en la marca. Se aplica a todos tus eventos.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-cart-line">
        <TabButton active={tab === "coorg"} onClick={() => setTab("coorg")} count={coorgCount}>
          Co-organizadores
        </TabButton>
        <TabButton active={tab === "promoters"} onClick={() => setTab("promoters")} count={promCount}>
          Promotores
        </TabButton>
      </div>

      {tab === "coorg" ? <CoorgTab /> : <PromotersTab />}
    </OrgShell>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex items-center gap-2 px-4 py-3 text-[13.5px] font-medium transition " +
        (active ? "text-white" : "text-cart-ink-3 hover:text-white")
      }
    >
      {children}
      {typeof count === "number" && (
        <span
          className={
            "rounded-full px-1.5 py-px text-[10.5px] font-semibold " +
            (active ? "bg-cart-accent-soft text-cart-accent" : "bg-white/5 text-cart-ink-3")
          }
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-cart-accent shadow-[0_0_10px_var(--color-cart-accent-glow)]" />
      )}
    </button>
  );
}

type ScopeFilter = "all" | "legal_entity" | "organization" | "portfolio";

const SCOPE_FILTERS: Array<{ key: ScopeFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "legal_entity", label: "Razón social" },
  { key: "organization", label: "Marca" },
  { key: "portfolio", label: "Portafolio" },
];

// ============================================================
// Co-organizadores tab
// ============================================================
function CoorgTab() {
  const invites = useOrgInvites();
  const createInvite = useCreateInvite();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ScopeFilter>("all");

  const data = invites.data;
  const allMembers = data?.members ?? [];
  const members =
    scope === "all" ? allMembers : allMembers.filter((m) => m.grantedVia === scope);
  const pending = (data?.invites ?? []).filter((i) => i.status === "pending");

  // Cuenta por scope para mostrar al lado del chip.
  const counts: Record<ScopeFilter, number> = {
    all: allMembers.length,
    legal_entity: allMembers.filter((m) => m.grantedVia === "legal_entity").length,
    organization: allMembers.filter((m) => m.grantedVia === "organization").length,
    portfolio: allMembers.filter((m) => m.grantedVia === "portfolio").length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header de sección */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13.5px] text-cart-ink-3">
            Quién co-gestiona tu equipo. Acceso por marca, por razón social o transversal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
        >
          <PlusIcon /> Invitar
        </button>
      </div>

      {/* Scope filter chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SCOPE_FILTERS.map((f) => {
          const active = scope === f.key;
          const c = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setScope(f.key)}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition " +
                (active
                  ? "bg-cart-accent-soft text-white shadow-[0_0_0_1px_var(--color-cart-accent)_inset]"
                  : "bg-cart-bg-elev text-cart-ink-2 hover:text-white")
              }
            >
              {f.label}
              <span
                className={
                  "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] " +
                  (active
                    ? "bg-cart-accent text-white"
                    : "bg-cart-bg-elev-2 text-cart-ink-3")
                }
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {/* Activos */}
      <Section title="Activos" count={members.length}>
        {members.length === 0 ? (
          <EmptyCell
            label={
              scope === "all"
                ? "Sólo tú por ahora. Invita a alguien para que te ayude."
                : "Nadie con este scope todavía."
            }
          />
        ) : (
          <div className="divide-y divide-cart-line">
            {members.map((m) => (
              <PersonRow
                key={m.profileId}
                name={m.fullName || m.email || "Sin nombre"}
                subtitle={m.email ?? "—"}
                role={prettyRole(m.role)}
                avatarUrl={m.avatarUrl}
                grantedVia={m.grantedVia}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Pending */}
      {pending.length > 0 && (
        <Section title="Invitaciones pendientes" count={pending.length}>
          <div className="divide-y divide-cart-line">
            {pending.map((i) => (
              <PersonRow
                key={i.id}
                name={i.email ?? "—"}
                subtitle={`Invitado · expira ${formatDate(i.expiresAt)}`}
                role={prettyRole(i.role)}
                avatarUrl={null}
                pending
              />
            ))}
          </div>
        </Section>
      )}

      {/* Invite sheet */}
      <AnimatePresence>
        {open && (
          <Sheet onClose={() => setOpen(false)} title="Invitar co-organizador">
            <CoorgInviteForm
              isPending={createInvite.isPending}
              onSubmit={(payload) => {
                createInvite.mutate(payload, {
                  onSuccess: () => setOpen(false),
                });
              }}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

type InviteScope = "organization" | "legal_entity" | "portfolio";

type InvitePayload =
  | {
      channel: "email";
      email: string;
      role: "admin" | "editor";
      scopeType: InviteScope;
      scopeId: string;
    }
  | {
      channel: "whatsapp";
      phone: string;
      role: "admin" | "editor";
      scopeType: InviteScope;
      scopeId: string;
    };

function CoorgInviteForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (payload: InvitePayload) => void;
}) {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const legalEntities = useLegalEntities();

  const activeOrg =
    orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const activeLegalEntity = legalEntities.data?.find(
    (le) => le.id === activeOrg?.legalEntityId,
  );

  const [channel, setChannel] = useState<"email" | "whatsapp">("whatsapp");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("admin");
  const [scope, setScope] = useState<InviteScope>("organization");

  const resolveScopeId = (): string | null => {
    if (scope === "organization") return activeOrg?.id ?? null;
    if (scope === "legal_entity") return activeOrg?.legalEntityId ?? null;
    // portfolio = scope del usuario que invita
    return me.data?.user?.id ?? null;
  };

  const submit = () => {
    const scopeId = resolveScopeId();
    if (!scopeId) return;
    const base = { role, scopeType: scope, scopeId };
    if (channel === "email") {
      if (!email.trim()) return;
      onSubmit({ ...base, channel: "email", email: email.trim() });
    } else {
      if (!phone.trim()) return;
      onSubmit({ ...base, channel: "whatsapp", phone: phone.trim() });
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Canal */}
      <div>
        <Label>Por dónde le mandamos la invitación</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Pill
            active={channel === "whatsapp"}
            onClick={() => setChannel("whatsapp")}
            label="WhatsApp"
          />
          <Pill active={channel === "email"} onClick={() => setChannel("email")} label="Email" />
        </div>
      </div>

      {/* Destino */}
      {channel === "email" ? (
        <FieldInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="mafer@nocturno.pe"
        />
      ) : (
        <label className="flex flex-col gap-1.5">
          <Label>WhatsApp</Label>
          <PhoneField value={phone} onChange={setPhone} />
        </label>
      )}

      {/* Rol */}
      <div>
        <Label>¿Qué puede hacer?</Label>
        <div className="mt-2 flex flex-col gap-2">
          <RoleCard
            active={role === "admin"}
            onClick={() => setRole("admin")}
            title="Admin"
            description="Acceso total · ver dinero · editar todo · cancelar"
          />
          <RoleCard
            active={role === "editor"}
            onClick={() => setRole("editor")}
            title="Editor"
            description="Puede editar el evento y gestionar promotores. No cancela ni ve pagos."
          />
        </div>
      </div>

      {/* Scope selector — patrón Slack: persona + role + dónde tiene acceso */}
      <div>
        <Label>¿A qué le das acceso?</Label>
        <div className="mt-2 flex flex-col gap-2">
          <RoleCard
            active={scope === "organization"}
            onClick={() => setScope("organization")}
            title={activeOrg ? `Esta marca · ${activeOrg.name}` : "Esta marca"}
            description="Solo esta marca. La opción más usada."
          />
          {activeLegalEntity && (
            <RoleCard
              active={scope === "legal_entity"}
              onClick={() => setScope("legal_entity")}
              title={`Toda la razón social · ${activeLegalEntity.name}`}
              description="Acceso a todas las marcas bajo esta razón social."
            />
          )}
          <RoleCard
            active={scope === "portfolio"}
            onClick={() => setScope("portfolio")}
            title="Toda mi cuenta"
            description="Acceso transversal a todas tus razones sociales y marcas."
          />
        </div>
      </div>

      <button
        type="button"
        data-primary-cta
        onClick={submit}
        disabled={isPending}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-cart-accent px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
      >
        {isPending ? "Mandando…" : "Mandar invitación"}
      </button>
    </div>
  );
}

// ============================================================
// Promotores tab
// ============================================================
function PromotersTab() {
  const promoters = useOrgPromoters();
  const create = useCreateOrgPromoter();
  const update = useUpdateOrgPromoter();
  const remove = useDeleteOrgPromoter();
  const [editing, setEditing] = useState<null | OrgPromoter>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13.5px] text-cart-ink-3">
            Promotores de tu marca — los agregás acá una vez y después elegís quiénes venden en cada
            evento, cada uno con su link único.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
        >
          <PlusIcon /> Agregar
        </button>
      </div>

      <BrandSchemeCard />

      <Section title="Promotores de la marca" count={promoters.data?.length ?? 0}>
        {promoters.isLoading ? (
          <EmptyCell label="Cargando…" />
        ) : (promoters.data?.length ?? 0) === 0 ? (
          <EmptyCell label="Aún no tienes promotores. Agrega el primero." />
        ) : (
          <div className="divide-y divide-cart-line">
            {promoters.data!.map((p) => (
              <PromoterRow
                key={p.id}
                promoter={p}
                onEdit={() => setEditing(p)}
                onRemove={() => {
                  if (confirm(`¿Quitar a ${p.name} del pool?`)) remove.mutate(p.id);
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <AnimatePresence>
        {adding && (
          <Sheet onClose={() => setAdding(false)} title="Nuevo promotor">
            <PromoterForm
              isPending={create.isPending}
              onSubmit={(payload) =>
                create.mutate(payload, { onSuccess: () => setAdding(false) })
              }
            />
          </Sheet>
        )}
        {editing && (
          <Sheet onClose={() => setEditing(null)} title={`Editar ${editing.name}`}>
            <PromoterForm
              initial={editing}
              isPending={update.isPending}
              onSubmit={(payload) =>
                update.mutate(
                  { id: editing.id, payload },
                  { onSuccess: () => setEditing(null) },
                )
              }
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromoterRow({
  promoter,
  onEdit,
  onRemove,
}: {
  promoter: OrgPromoter;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Link
      href={`/org/team/${promoter.id}` as never}
      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] lg:px-5"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[14px] font-semibold text-cart-accent">
        {(promoter.name[0] ?? "?").toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{promoter.name}</div>
        <div className="flex items-center gap-2">
          {promoter.whatsapp && (
            <span className="truncate font-mono text-[11.5px] text-cart-ink-3">{promoter.whatsapp}</span>
          )}
          {promoter.profileId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#22D17F]/12 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.08em] text-[#22D17F]">
              <span className="size-1 rounded-full bg-[#22D17F]" />
              ACTIVO EN APP
            </span>
          )}
        </div>
      </div>
      <span className="rounded-full bg-cart-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-cart-accent">
        {promoter.defaultCommissionPct == null ? "Igual que marca" : `${promoter.defaultCommissionPct}%`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          className="grid size-9 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
          aria-label="Editar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 12l8-8 2 2-8 8H2v-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="grid size-9 place-items-center rounded-full text-cart-ink-3 transition hover:bg-red-500/10 hover:text-red-300"
          aria-label="Quitar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </Link>
  );
}

const ICON_PRESETS = ["bottle", "crown", "table", "ticket", "gift", "cash", "champagne"] as const;

// Premios pre-armados — chips de un click para los más comunes.
const REWARD_PRESETS: ReadonlyArray<{ icon: string; label: string }> = [
  { icon: "bottle", label: "Botella" },
  { icon: "crown", label: "Pase VIP" },
  { icon: "table", label: "Mesa" },
  { icon: "ticket", label: "Entrada gratis" },
];

function RewardIcon({ name, size = 18 }: { name: string; size?: number }) {
  const s = size;
  const stroke = 1.6;
  switch (name) {
    case "bottle":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 2h4v3.2c0 .6.2 1.1.6 1.5l1.6 1.6c.5.6.8 1.3.8 2V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10.3c0-.7.3-1.4.8-2l1.6-1.6c.4-.4.6-.9.6-1.5V2Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="M9 13h6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "crown":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7l3.5 3L12 4l5.5 6L21 7l-2 12H5L3 7Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="M5 19h14" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "gift":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8s-3-5-5.5-3.5S8 8 12 8Zm0 0s3-5 5.5-3.5S16 8 12 8Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
        </svg>
      );
    case "cash":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth={stroke} />
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth={stroke} />
          <path d="M6 9.5v5M18 9.5v5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "champagne":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 3h10l-1.2 8a4 4 0 0 1-3.8 3.4A4 4 0 0 1 8.2 11L7 3Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="M12 14.5V21M9 21h6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "ticket":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="M14 6v12" stroke="currentColor" strokeWidth={stroke} strokeDasharray="2 2" />
        </svg>
      );
    case "table":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 9h18M5 9v11M19 9v11M9 9v4h6V9" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 9c0-2 3-4 8-4s8 2 8 4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={stroke} />
        </svg>
      );
  }
}

// Regla base de la marca: el default que heredan TODOS los promotores y eventos.
// Mismo editor unificado, autoguardado. Vive arriba del pool.
function BrandSchemeCard() {
  const scheme = useOrgScheme();
  const update = useUpdateOrgScheme();
  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-white">
          Reglas para todos tus promotores
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-cart-ink-3">
          El default de tu marca: aplica a todos tus eventos. Lo puedes cambiar por evento, o por
          promotor (su tarifa propia manda sobre el default del evento).
        </p>
      </div>
      <CommissionSchemeEditor
        variant="page"
        saving={update.isPending}
        pct={scheme.data?.commissionPct ?? 0}
        config={scheme.data?.commissionConfig}
        onPctChange={(v) => update.mutate({ commissionPct: v })}
        onConfigChange={(cfg) => update.mutate({ commissionConfig: cfg })}
      />
    </section>
  );
}

function PromoterForm({
  initial,
  isPending,
  onSubmit,
}: {
  initial?: OrgPromoter;
  isPending: boolean;
  onSubmit: (payload: {
    name: string;
    whatsapp: string | null;
    defaultCommissionPct: number | null;
    commissionConfig: CommissionConfig;
    notes?: string | null;
  }) => void;
}) {
  const brand = useOrgScheme();
  const [name, setName] = useState(initial?.name ?? "");
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  // null = hereda de la marca (default de un promotor nuevo). El editor lo muestra.
  const [pct, setPct] = useState<number | null>(initial?.defaultCommissionPct ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // Dos ejes independientes: % (pct) + metas (config). El editor maneja el config.
  const [config, setConfig] = useState<CommissionConfig>(
    initial?.commissionConfig && "milestones" in initial.commissionConfig
      ? initial.commissionConfig
      : null,
  );

  const submit = () => {
    if (!name.trim()) return;
    // Limpia metas: solo hitos válidos; si no queda ninguno → sin metas (null).
    let commissionConfig: CommissionConfig = null;
    if (config) {
      const clean = config.milestones
        .filter((m) => m.threshold > 0 && (m.rewardKind === "cash" ? (m.amountCents ?? 0) > 0 : m.label.trim()))
        .map((m) => ({ ...m, label: m.label.trim() }))
        .sort((a, b) => a.threshold - b.threshold);
      if (clean.length > 0) commissionConfig = { basis: config.basis, milestones: clean };
    }
    onSubmit({
      name: name.trim(),
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,
      defaultCommissionPct: pct,
      commissionConfig,
      notes: notes.trim() ? notes.trim() : null,
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <FieldInput label="Nombre" value={name} onChange={setName} placeholder="Lucho" />
      <label className="flex flex-col gap-1.5">
        <Label>WhatsApp</Label>
        <PhoneField value={whatsapp} onChange={setWhatsapp} />
      </label>

      <div>
        <Label>Cómo le pagas</Label>
        <p className="mt-1 text-[11.5px] leading-snug text-cart-ink-3">
          Por defecto usa las reglas de tu marca. Cámbialo solo si este promotor cobra distinto.
        </p>
        <div className="mt-2.5">
          <CommissionSchemeEditor
            variant="drawer"
            autoSave={false}
            pct={pct}
            config={config}
            onPctChange={setPct}
            onConfigChange={setConfig}
            inheritedPct={brand.data?.commissionPct ?? 0}
            inheritLabel="tu marca"
          />
        </div>
      </div>

      <FieldInput label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Vende mejor los jueves" />

      <button
        type="button"
        data-primary-cta
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-cart-accent px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
      >
        {isPending ? "Guardando…" : initial ? "Guardar cambios" : "Agregar al pool"}
      </button>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex w-[120px] items-center gap-1.5 rounded-xl bg-cart-bg-elev px-3 py-2 font-mono text-[13.5px]">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.trunc(Number(e.target.value) || 0)))}
        className="w-full bg-transparent outline-none"
      />
      {suffix && <span className="shrink-0 text-[10.5px] text-cart-ink-3">{suffix}</span>}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-xl bg-cart-bg-elev text-white"
        aria-label="Elegir icono"
      >
        <RewardIcon name={value} size={20} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-xl border border-cart-line bg-cart-bg-elev-2 p-1.5 shadow-lg">
          {ICON_PRESETS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              className={
                "grid size-9 place-items-center rounded-lg text-white transition hover:bg-white/10 " +
                (icon === value ? "bg-white/10" : "")
              }
              aria-label={icon}
            >
              <RewardIcon name={icon} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full text-cart-ink-3 transition hover:bg-red-500/10 hover:text-red-300"
      aria-label="Quitar"
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function AddRowBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-cart-ink-2 transition hover:bg-white/10 hover:text-white"
    >
      <PlusIcon /> {label}
    </button>
  );
}

// ============================================================
// Shared UI
// ============================================================
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {typeof count === "number" && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10.5px] font-semibold text-cart-ink-3">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyCell({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-[13px] text-cart-ink-3 lg:px-5">{label}</div>;
}

function PersonRow({
  name,
  subtitle,
  role,
  avatarUrl,
  grantedVia,
  pending,
}: {
  name: string;
  subtitle: string;
  role: string;
  avatarUrl: string | null;
  grantedVia?: "portfolio" | "legal_entity" | "organization";
  pending?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 lg:px-5">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="size-10 rounded-full object-cover" />
      ) : (
        <div className="grid size-10 place-items-center rounded-full bg-cart-bg-elev-2 text-[13px] font-semibold text-cart-ink-2">
          {(name[0] ?? "?").toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{name}</span>
          {grantedVia && grantedVia !== "organization" && (
            <span className="rounded-full bg-white/5 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.08em] text-cart-ink-3">
              {grantedVia === "portfolio" ? "PORTFOLIO" : "RAZÓN SOCIAL"}
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-cart-ink-3">{subtitle}</div>
      </div>
      <span
        className={
          "rounded-full px-2.5 py-1 text-[11.5px] font-semibold " +
          (pending
            ? "bg-amber-400/15 text-amber-300"
            : "bg-cart-accent-soft text-cart-accent")
        }
      >
        {pending ? "PENDIENTE" : role}
      </span>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
      {children}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          "rounded-xl border border-cart-line bg-cart-bg-elev px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-cart-line-strong placeholder:text-cart-ink-4 " +
          (mono ? "font-mono text-[13.5px]" : "")
        }
      />
    </label>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl px-3 py-2.5 text-[13px] font-semibold transition " +
        (active
          ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
          : "bg-cart-bg-elev text-cart-ink-2 hover:text-white")
      }
    >
      {label}
    </button>
  );
}

function RoleCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-start gap-3 rounded-2xl border p-3 text-left transition " +
        (active
          ? "border-cart-accent bg-cart-accent-soft shadow-[0_0_0_1px_var(--color-cart-accent-glow)_inset]"
          : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
      }
    >
      <span
        className={
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border " +
          (active ? "border-cart-accent bg-cart-accent text-white" : "border-cart-line-strong text-transparent")
        }
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-cart-ink-3">{description}</div>
      </div>
    </button>
  );
}

function useIsDesktop() {
  // Lazy init: en el primer render del Sheet (que solo monta tras un click,
  // siempre en cliente) ya leemos el viewport — evita el flicker bottom→right
  // que rompía la animación de entrada del drawer.
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

  // Atajos: Esc cierra · Cmd/Ctrl+Enter dispara el CTA primario del sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const cta = sheetRef.current?.querySelector<HTMLButtonElement>(
          "[data-primary-cta]:not(:disabled)",
        );
        if (cta) {
          e.preventDefault();
          cta.click();
        }
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
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] text-cart-ink-3 sm:inline">
                <kbd className="rounded border border-cart-line bg-cart-bg px-1.5 py-0.5 text-[10px] font-medium">Esc</kbd> cerrar ·{" "}
                <kbd className="rounded border border-cart-line bg-cart-bg px-1.5 py-0.5 text-[10px] font-medium">⌘</kbd>
                <kbd className="ml-0.5 rounded border border-cart-line bg-cart-bg px-1.5 py-0.5 text-[10px] font-medium">↵</kbd> guardar
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 3l8 8M11 3l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </motion.div>
      </>
    );
  }

  // Mobile: bottom sheet con drag-to-dismiss
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

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function prettyRole(role: string): string {
  return (
    {
      owner: "OWNER",
      admin: "ADMIN",
      editor: "EDITOR",
      reporter: "REPORTER",
      door: "DOOR",
    }[role] ?? role.toUpperCase()
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}
