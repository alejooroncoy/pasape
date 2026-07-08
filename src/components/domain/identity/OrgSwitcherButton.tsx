"use client";

import { useRef, useState } from "react";
import { useIsRestoring } from "@tanstack/react-query";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { useLegalEntities } from "@/lib/identity/organizations/hooks/useLegalEntities";
import { useSwitchOrg } from "@/lib/identity/organizations/hooks/useSwitchOrg";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { Avatar } from "@/components/ui/Avatar";
import { OrgSwitcherSheet } from "./OrgSwitcherSheet";
import { Link, useRouter } from "@/i18n/navigation";

type Props = {
  /**
   * Si el switcher vive dentro de un contenedor con `transform` (ej. el drawer
   * móvil animado con motion), pasale un callback que cierre ese contenedor
   * antes de abrir el sheet. Si no, el `position: fixed` del sheet quedaría
   * relativo al contenedor transformado en lugar del viewport.
   */
  onBeforeOpen?: () => void;
};

export const OrgSwitcherButton = ({ onBeforeOpen }: Props = {}) => {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const legalEntities = useLegalEntities();
  const switchOrg = useSwitchOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // El cache de `identity` se persiste a IndexedDB (ver query-client.tsx) y se
  // restaura async tras el mount. Mientras restaura, tratar `data` como
  // ausente evita el hydration mismatch: el server siempre renderiza sin
  // sesión, así el primer paint del cliente coincide sin importar el timing
  // de la restauración.
  const isRestoring = useIsRestoring();

  if (isRestoring || !me.data || !orgs.data) return null;

  if (orgs.data.length === 0) {
    return (
      <Link
        href={"/org/new" as never}
        className="flex w-full items-center gap-3 rounded-2xl border border-cart-accent/40 bg-cart-accent-soft px-3 py-2.5 text-left transition hover:border-cart-accent hover:brightness-110"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-cart-accent text-black"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-semibold text-white">
            Crear tu primera marca
          </span>
          <span className="truncate text-[11.5px] text-cart-ink-3">
            Empieza en menos de un minuto
          </span>
        </span>
      </Link>
    );
  }

  const activeSlug = me.data.activeOrgSlug;
  const active = orgs.data.find((o) => o.slug === activeSlug) ?? orgs.data[0];
  const count = orgs.data.length;
  const initial = (active.name || "·").charAt(0).toUpperCase();
  const subtitle = count > 1 ? `${count} marcas · cambiar` : "Tu marca";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          // Si vivimos dentro del drawer móvil, cerrarlo libera el `transform`
          // que rompe el `position: fixed` del sheet. Lo abrimos en paralelo
          // — el sheet portea a `document.body`, así que no depende de este
          // botón seguir montado.
          onBeforeOpen?.();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-2.5 py-2 text-left transition-colors hover:border-cart-line-strong"
      >
        <span
          aria-hidden
          className="grid size-10 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-cart-line-strong bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[14px] font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
        >
          {active.logoUrl ? (
            <Avatar src={active.logoUrl} alt={active.name} size={40} />
          ) : (
            initial
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-white">
            {active.name}
          </span>
          <span className="block truncate text-[11.5px] text-cart-ink-3">{subtitle}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className="flex-shrink-0 text-cart-ink-3 transition-colors group-hover:text-white"
        >
          <path
            d="M4 5.5L7 2.5l3 3M4 8.5L7 11.5l3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <OrgSwitcherSheet
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        // Why: usamos el slug RESUELTO (active.slug), no el crudo de la sesión.
        // Si el usuario aún no eligió marca, activeOrgSlug es null y el dropdown
        // no resaltaba ninguna; con el default determinista (primera org) el
        // botón y el dropdown muestran/resaltan siempre lo mismo.
        activeSlug={active.slug}
        orgs={orgs.data}
        legalEntities={legalEntities.data ?? []}
        onSelect={async (slug) => {
          await switchOrg.mutateAsync(slug);
          setOpen(false);
        }}
        onCreateOrg={(legalEntityId) => {
          setOpen(false);
          const qs = legalEntityId ? `?legalEntityId=${legalEntityId}` : "";
          router.push(`/org/new${qs}` as never);
        }}
        onCreateLegalEntity={() => {
          setOpen(false);
          router.push("/org/new?step=razon-social" as never);
        }}
        onEditLegalEntity={(id) => {
          setOpen(false);
          router.push(`/org/legal-entities/${id}` as never);
        }}
      />
    </>
  );
};
