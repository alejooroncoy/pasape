"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";

type Org = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  role: string;
  legalEntityId: string;
};

type LegalEntity = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlug: string | null;
  orgs: Org[];
  legalEntities: LegalEntity[];
  onSelect: (slug: string) => void;
  onCreateOrg: (legalEntityId?: string) => void;
  onCreateLegalEntity: () => void;
  onEditLegalEntity: (legalEntityId: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path
      d="M4 9.5l3.2 3.2L14 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
};

type Group = { entity: LegalEntity; orgs: Org[] };

function groupByEntity(orgs: Org[], entities: LegalEntity[]): Group[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const groups = new Map<string, Group>();
  for (const org of orgs) {
    const entity = byId.get(org.legalEntityId) ?? { id: org.legalEntityId, name: "—" };
    const g = groups.get(entity.id) ?? { entity, orgs: [] };
    g.orgs.push(org);
    groups.set(entity.id, g);
  }
  // Sort: keep groups in entity-list order, append unknown last
  return Array.from(groups.values()).sort((a, b) => {
    const ai = entities.findIndex((e) => e.id === a.entity.id);
    const bi = entities.findIndex((e) => e.id === b.entity.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function ListContents({
  orgs,
  legalEntities,
  activeSlug,
  onSelect,
  onCreateOrg,
  onCreateLegalEntity,
  onEditLegalEntity,
  variant,
}: {
  orgs: Org[];
  legalEntities: LegalEntity[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onCreateOrg: (legalEntityId?: string) => void;
  onCreateLegalEntity: () => void;
  onEditLegalEntity: (legalEntityId: string) => void;
  variant: "popover" | "sheet";
}) {
  const t = useTranslations("organizations.switcher");
  const isSheet = variant === "sheet";
  const groups = useMemo(() => groupByEntity(orgs, legalEntities), [orgs, legalEntities]);
  const entityCount = legalEntities.length;
  const orgCount = orgs.length;

  return (
    <>
      {isSheet && (
        <div className="mb-3 flex justify-center">
          <div className="h-1 w-9 rounded-full bg-cart-ink/15" aria-hidden />
        </div>
      )}

      <div className={isSheet ? "px-[18px]" : ""}>
        <div
          className={
            isSheet
              ? "text-[17px] font-semibold tracking-[-0.01em] text-cart-ink"
              : "text-[13px] font-semibold tracking-[-0.005em] text-cart-ink"
          }
        >
          Mis clientes
        </div>
        {isSheet ? (
          <p className="mt-0.5 text-[12.5px] text-cart-ink-3">{t("subtitle")}</p>
        ) : (
          <p className="text-[11.5px] text-cart-ink-4">
            {entityCount} {entityCount === 1 ? "razón social" : "razones sociales"} · {orgCount}{" "}
            {orgCount === 1 ? "marca" : "marcas"}
          </p>
        )}
      </div>

      <div
        className={
          isSheet
            ? "mt-4 max-h-[55vh] overflow-y-auto px-[18px]"
            : "mt-2 max-h-[320px] overflow-y-auto"
        }
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.03, delayChildren: 0.04 } },
          }}
          className="flex flex-col gap-3"
        >
          {groups.map((g) => (
            <motion.section
              key={g.entity.id}
              variants={{
                hidden: { opacity: 0, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
              }}
              className="flex flex-col gap-1.5"
            >
              <header className="flex items-baseline justify-between gap-2 px-1">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span
                    className={
                      isSheet
                        ? "truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3"
                        : "truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3"
                    }
                  >
                    {g.entity.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditLegalEntity(g.entity.id)}
                    className="shrink-0 text-[10px] font-medium normal-case text-cart-ink-4 hover:text-cart-accent hover:underline"
                    aria-label={`Editar ${g.entity.name}`}
                  >
                    (editar)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onCreateOrg(g.entity.id)}
                  className="shrink-0 text-[11px] font-medium text-cart-accent hover:underline"
                  aria-label={`Nueva marca en ${g.entity.name}`}
                >
                  + Marca
                </button>
              </header>

              <ul
                className={
                  isSheet
                    ? "overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev-2/60"
                    : "overflow-hidden rounded-xl border border-cart-line bg-cart-bg-elev-2/60"
                }
              >
                {g.orgs.map((org, idx) => {
                  const isActive = org.slug === activeSlug;
                  const initial = (org.name || "·").charAt(0).toUpperCase();
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(org.slug)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-cart-bg-elev-2 ${
                          idx > 0 ? "border-t border-cart-line/60" : ""
                        } ${isActive ? "bg-cart-accent-soft/40" : "hover:bg-cart-bg-elev-2/80"}`}
                      >
                        <span
                          aria-hidden
                          className={`grid flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-cart-line-strong bg-gradient-to-br from-[#7C3AED] to-[#b87cff] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] ${
                            isSheet ? "size-10 rounded-xl text-[14px]" : "size-9 text-[13px]"
                          }`}
                        >
                          {org.logoUrl ? (
                            <Avatar src={org.logoUrl} alt={org.name} size={isSheet ? 40 : 36} />
                          ) : (
                            initial
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={
                              isSheet
                                ? "truncate text-[15px] font-semibold text-cart-ink"
                                : "truncate text-[13.5px] font-semibold text-cart-ink"
                            }
                          >
                            {org.name}
                          </span>
                          <span
                            className={
                              isSheet
                                ? "truncate text-[12px] capitalize text-cart-ink-3"
                                : "truncate text-[11px] capitalize text-cart-ink-3"
                            }
                          >
                            {org.role}
                          </span>
                        </span>
                        {isActive && (
                          <span
                            aria-label={t("active")}
                            className={`grid flex-shrink-0 place-items-center rounded-full bg-cart-accent text-black ${
                              isSheet ? "size-6" : "size-5"
                            }`}
                          >
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </motion.div>

        {/* Acciones globales */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 3 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <button
            type="button"
            onClick={onCreateLegalEntity}
            className={
              isSheet
                ? "flex w-full items-center gap-3 rounded-2xl border border-cart-accent/40 bg-cart-accent-soft px-3.5 py-3 text-left transition-colors active:bg-cart-accent-soft/70"
                : "flex w-full items-center gap-2 rounded-lg border border-cart-accent/40 bg-cart-accent-soft px-3 py-2 text-left text-[12.5px] font-semibold text-cart-accent transition-colors hover:brightness-110"
            }
          >
            <span
              aria-hidden
              className={
                isSheet
                  ? "grid size-9 flex-shrink-0 place-items-center rounded-full bg-cart-accent text-black"
                  : "grid size-5 flex-shrink-0 place-items-center rounded-md bg-cart-accent text-black"
              }
            >
              <PlusIcon />
            </span>
            <span
              className={
                isSheet ? "text-[15px] font-semibold text-cart-ink" : "text-[12.5px] font-semibold"
              }
            >
              Nueva razón social
            </span>
          </button>
          <button
            type="button"
            onClick={() => onCreateOrg()}
            className={
              isSheet
                ? "flex w-full items-center gap-3 rounded-2xl border border-cart-line bg-transparent px-3.5 py-3 text-left transition-colors active:bg-cart-bg-elev-2"
                : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev-2 hover:text-cart-ink"
            }
          >
            <span
              aria-hidden
              className={
                isSheet
                  ? "grid size-9 flex-shrink-0 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink-2"
                  : "grid size-5 flex-shrink-0 place-items-center rounded-md border border-cart-line text-cart-ink-2"
              }
            >
              <PlusIcon />
            </span>
            <span className={isSheet ? "text-[15px] font-medium text-cart-ink" : ""}>
              Nueva marca
            </span>
          </button>
        </motion.div>
      </div>
    </>
  );
}

export const OrgSwitcherSheet = ({
  open,
  onOpenChange,
  activeSlug,
  orgs,
  legalEntities,
  onSelect,
  onCreateOrg,
  onCreateLegalEntity,
  onEditLegalEntity,
  triggerRef,
}: Props) => {
  const isDesktop = useIsDesktop();

  const content: ReactNode = (
    <ListContents
      orgs={orgs}
      legalEntities={legalEntities}
      activeSlug={activeSlug}
      onSelect={onSelect}
      onCreateOrg={onCreateOrg}
      onCreateLegalEntity={onCreateLegalEntity}
      onEditLegalEntity={onEditLegalEntity}
      variant={isDesktop ? "popover" : "sheet"}
    />
  );

  if (isDesktop) {
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor virtualRef={triggerRef as React.RefObject<Element>} />
        <AnimatePresence>
          {open && (
            <Popover.Portal forceMount>
              <Popover.Content
                asChild
                side="right"
                align="start"
                sideOffset={10}
                collisionPadding={12}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.97, x: -4 }}
                  transition={{ type: "spring", damping: 28, stiffness: 380, mass: 0.55 }}
                  style={{ transformOrigin: "left top" }}
                  className="home-light z-50 w-[320px] rounded-2xl border border-cart-line-strong bg-cart-bg-elev p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
                >
                  {content}
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          )}
        </AnimatePresence>
      </Popover.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal
            forceMount
            container={typeof document !== "undefined" ? document.body : undefined}
          >
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[60] app-scrim"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 360, mass: 0.8 }}
                className="home-light fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-[26px] border-t border-cart-line-strong bg-cart-bg-elev pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] shadow-[0_-30px_60px_-10px_rgba(0,0,0,0.7)]"
              >
                <Dialog.Title className="sr-only">Mis clientes</Dialog.Title>
                {content}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
