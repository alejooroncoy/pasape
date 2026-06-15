"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { OrgShell } from "../_shell/OrgShell";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { useUpdateOrganization } from "@/lib/identity/hooks/useUpdateOrganization";
import { useLegalEntities } from "@/lib/identity/organizations/hooks/useLegalEntities";
import { useUpdateLegalEntity } from "@/lib/identity/organizations/hooks/useUpdateLegalEntity";
import { SettingsCard, SettingsRow } from "./_components/SettingsCard";
import { TextInput, TextArea } from "./_components/Field";
import { SectionNav, type Section } from "./_components/SectionNav";

const ORG_ASSETS_BUCKET = "event-assets";

// Solo settings de MARCA. Lo de tu cuenta (perfil, notifs, sesión) vive en /account.
const SECTIONS: Section[] = [
  { id: "organizacion", label: "Tu marca" },
  { id: "pagos", label: "Pagos" },
  { id: "peligro", label: "Eliminar marca" },
];

export default function OrgSettingsPage() {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const legalEntities = useLegalEntities();

  const activeOrg = orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const activeLegalEntity = legalEntities.data?.find(
    (le) => le.id === activeOrg?.legalEntityId,
  );

  const [orgName, setOrgName] = useState(activeOrg?.name ?? "");
  const [orgSlug, setOrgSlug] = useState(activeOrg?.slug ?? "");
  const [orgDescription, setOrgDescription] = useState(activeOrg?.description ?? "");
  const [orgInstagram, setOrgInstagram] = useState(activeOrg?.instagram ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(activeOrg?.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [bankOpen, setBankOpen] = useState(false);

  const save = useUpdateOrganization(activeOrg?.slug ?? "");

  // Rehidrata el formulario cuando carga / cambia la org activa.
  useEffect(() => {
    if (!activeOrg) return;
    setOrgName(activeOrg.name);
    setOrgSlug(activeOrg.slug);
    setOrgDescription(activeOrg.description ?? "");
    setOrgInstagram(activeOrg.instagram ?? "");
    setLogoPreview(activeOrg.logoUrl ?? null);
  }, [activeOrg]);

  const onLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = f.name.includes(".") ? f.name.split(".").pop() : "jpg";
      const path = `org-logos/${activeOrg?.slug ?? "org"}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(ORG_ASSETS_BUCKET)
        .upload(path, f, { cacheControl: "3600", upsert: false, contentType: f.type || undefined });
      if (error) throw error;
      const { data } = supabase.storage.from(ORG_ASSETS_BUCKET).getPublicUrl(path);
      setLogoPreview(data.publicUrl);
    } catch {
      setLogoError("No se pudo subir el logo. Reintenta.");
    } finally {
      setLogoUploading(false);
    }
  };

  const cleanInstagram = orgInstagram.trim().replace(/^@+/, "");
  const dirty = useMemo(() => {
    if (!activeOrg) return false;
    return (
      orgName.trim() !== activeOrg.name ||
      orgSlug.trim() !== activeOrg.slug ||
      (orgDescription.trim() || null) !== (activeOrg.description ?? null) ||
      (cleanInstagram || null) !== (activeOrg.instagram ?? null) ||
      (logoPreview ?? null) !== (activeOrg.logoUrl ?? null)
    );
  }, [activeOrg, orgName, orgSlug, orgDescription, cleanInstagram, logoPreview]);

  const onSave = async () => {
    if (!activeOrg || !dirty) return;
    await save.mutateAsync({
      name: orgName.trim() || undefined,
      slug: orgSlug.trim() || undefined,
      description: orgDescription.trim() || null,
      instagram: cleanInstagram || null,
      logoUrl: logoPreview,
    });
  };

  // Carga / sin marca: evitar mostrar inputs vacíos (parece marca borrada).
  const loadingOrg = orgs.isLoading || me.isLoading;
  const noOrg = orgs.isFetched && !activeOrg;
  if (loadingOrg || noOrg) {
    return (
      <OrgShell>
        <div className="mb-8 sm:mb-10">
          <h1 className="font-sans text-[clamp(34px,7.2vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
            Ajustes
          </h1>
        </div>
        {noOrg ? (
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-5 py-8 text-center text-[14px] text-cart-ink-3">
            No encontramos una marca activa. Crea o selecciona una marca para configurarla.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-cart-bg-elev-2" />
            ))}
          </div>
        )}
      </OrgShell>
    );
  }

  return (
    <OrgShell>
      <div className="mb-8 sm:mb-10">
        <h1 className="font-sans text-[clamp(34px,7.2vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
          Ajustes
        </h1>
        <p className="mt-2 max-w-prose text-[13.5px] leading-snug text-cart-ink-3 sm:text-[14px]">
          Configura tu marca, datos de pago y la información pública de tu productora.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-10">
        <SectionNav sections={SECTIONS} />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
          }}
          className="flex min-w-0 flex-1 flex-col gap-6"
        >
          {/* Tu marca */}
          <SettingsCard
            id="organizacion"
            title="Tu marca"
            description="Cómo se ve tu marca en Pasape para los asistentes."
          >
            <SettingsRow
              label="Logo"
              description="Imagen cuadrada. Se muestra en eventos y en tu página pública."
              align="start"
            >
              <div className="flex items-center gap-3 sm:justify-end">
                <div className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev-2">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[18px] font-semibold text-cart-ink-3">
                      {(orgName || activeOrg?.name || "P").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={logoUploading}
                  className="rounded-full border border-cart-line bg-cart-bg px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white disabled:opacity-60"
                >
                  {logoUploading ? "Subiendo…" : "Cambiar"}
                </button>
                {logoPreview && !logoUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoError(null);
                    }}
                    className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-cart-ink-3 transition hover:text-red-300"
                  >
                    Quitar
                  </button>
                )}
                {logoError && <span className="text-[11.5px] text-red-300">{logoError}</span>}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoPick}
                />
              </div>
            </SettingsRow>

            <SettingsRow label="Nombre" description="Como aparece en tus eventos.">
              <TextInput
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Nombre de tu marca"
              />
            </SettingsRow>

            <SettingsRow
              label="Slug público"
              description={
                activeOrg?.slug ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-cart-ink-2">
                      pasape.lat/{activeOrg.slug}
                    </span>
                    <a
                      href={`/${activeOrg.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-cart-accent-soft px-2 py-0.5 text-[11px] font-semibold text-cart-accent transition hover:brightness-110"
                    >
                      Abrir
                      <svg width="9" height="9" viewBox="0 0 11 11" fill="none">
                        <path
                          d="M3 3h5v5M3 8l5-5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </span>
                ) : (
                  "Esta será la URL pública de tu marca."
                )
              }
            >
              <TextInput
                value={orgSlug}
                onChange={(e) =>
                  setOrgSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  )
                }
                placeholder="tu-marca"
              />
            </SettingsRow>

            <SettingsRow
              label="Descripción corta"
              description="Aparece en tu página pública. Máx. 160 caracteres."
              align="start"
            >
              <TextArea
                value={orgDescription}
                onChange={(e) =>
                  setOrgDescription((e.target as HTMLTextAreaElement).value)
                }
                maxLength={160}
                placeholder="Una línea corta de qué hace tu marca"
                rows={2}
              />
            </SettingsRow>

            <SettingsRow
              label="Instagram"
              description="Tu usuario, sin el @. Aparece en tu página pública."
            >
              <TextInput
                value={orgInstagram}
                onChange={(e) => setOrgInstagram(e.target.value)}
                placeholder="111producciones"
              />
            </SettingsRow>
          </SettingsCard>

          {/* Pagos */}
          <SettingsCard
            id="pagos"
            title="Pagos"
            description="Pasape cobra las entradas y te transfiere lo recaudado al cierre del evento."
          >
            <SettingsRow
              label="Cuenta bancaria"
              description={
                activeLegalEntity?.bankAccountNumber
                  ? `${activeLegalEntity.bankName ?? "Banco"} · ${maskAccount(activeLegalEntity.bankAccountNumber)}`
                  : "A esta cuenta te transferimos lo recaudado al finalizar cada evento."
              }
            >
              <div className="sm:text-right">
                <button
                  type="button"
                  onClick={() => setBankOpen(true)}
                  disabled={!activeLegalEntity}
                  className="rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {activeLegalEntity?.bankAccountNumber ? "Editar" : "Configurar"}
                </button>
              </div>
            </SettingsRow>
          </SettingsCard>

          {/* Eliminar marca */}
          <SettingsCard
            id="peligro"
            title="Eliminar marca"
            description="Acción irreversible. Borra todos los eventos y datos de esta marca."
            danger
          >
            <SettingsRow
              label={<span className="text-rose-200">Eliminar marca</span>}
              description="Esta acción no se puede deshacer. Borra todos los eventos y datos de esta marca."
            >
              <div className="flex sm:justify-end">
                <button
                  type="button"
                  disabled
                  title="Próximamente — escríbenos para eliminar tu marca"
                  className="cursor-not-allowed rounded-full border border-rose-500/30 bg-rose-500/5 px-4 py-1.5 text-[12.5px] font-semibold text-rose-200/60"
                >
                  Próximamente
                </button>
              </div>
            </SettingsRow>
          </SettingsCard>
        </motion.div>
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />

      <AnimatePresence>
        {bankOpen && activeLegalEntity && (
          <BankAccountSheet
            legalEntity={activeLegalEntity}
            onClose={() => setBankOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Barra de guardar — aparece solo cuando hay cambios sin guardar. */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/90 backdrop-blur-md"
          >
            <div className="mx-auto flex w-full max-w-[760px] items-center justify-between gap-3 px-5 py-3.5 lg:px-8">
              <span className="text-[13px] text-cart-ink-3">
                {save.isError ? (
                  <span className="text-rose-300">
                    No se pudo guardar. Revisa el slug (puede estar tomado).
                  </span>
                ) : (
                  "Tienes cambios sin guardar"
                )}
              </span>
              <button
                type="button"
                onClick={onSave}
                disabled={save.isPending || logoUploading}
                className="rounded-full bg-cart-accent px-5 py-2 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {save.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </OrgShell>
  );
}

// Bancos peruanos más comunes
const PE_BANKS = [
  "BCP",
  "BBVA",
  "Interbank",
  "Scotiabank",
  "BanBif",
  "Banco de la Nación",
  "Banco Pichincha",
  "Mibanco",
  "Otro",
];

const maskAccount = (n: string): string => {
  const digits = n.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return `••• ${digits.slice(-4)}`;
};

function BankAccountSheet({
  legalEntity,
  onClose,
}: {
  legalEntity: {
    id: string;
    name: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankCci: string | null;
  };
  onClose: () => void;
}) {
  const update = useUpdateLegalEntity();
  const [bankName, setBankName] = useState(legalEntity.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(legalEntity.bankAccountNumber ?? "");
  const [cci, setCci] = useState(legalEntity.bankCci ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Esc cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError(null);
    if (!bankName.trim()) return setError("Elige el banco.");
    if (accountNumber.replace(/\D/g, "").length < 8)
      return setError("El número de cuenta parece incompleto (mínimo 8 dígitos).");
    const cciClean = cci.replace(/\D/g, "");
    if (cciClean && cciClean.length !== 20) return setError("El CCI debe tener exactamente 20 dígitos.");
    try {
      await update.mutateAsync({
        id: legalEntity.id,
        bankName: bankName.trim(),
        bankAccountNumber: accountNumber.trim(),
        bankCci: cciClean || null,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Cuenta bancaria"
        initial={isDesktop ? { x: "100%" } : { y: "100%" }}
        animate={isDesktop ? { x: 0 } : { y: 0 }}
        exit={isDesktop ? { x: "100%" } : { y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        className="fixed inset-x-0 bottom-0 z-81 mx-auto max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)] md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-dvh md:max-h-none md:rounded-none md:rounded-l-3xl md:border-l"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cart-line bg-cart-bg-elev/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="font-sans text-[18px] font-semibold tracking-[-0.01em]">
              Cuenta bancaria
            </h3>
            <p className="mt-0.5 text-[12px] text-cart-ink-3">{legalEntity.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-full text-cart-ink-3 hover:bg-white/5 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev-2/40 p-3 text-[12px] leading-snug text-cart-ink-3">
            Pasape cobra las entradas y al cierre del evento transfiere lo recaudado a esta cuenta.
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Banco</div>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cart-line-strong"
            >
              <option value="">Selecciona un banco…</option>
              {PE_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Número de cuenta</div>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="194-1234567-0-12"
              inputMode="numeric"
              className="w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 font-mono text-[14px] text-white outline-none focus:border-cart-line-strong"
            />
            <p className="mt-1.5 text-[11.5px] text-cart-ink-3">
              Tal cual aparece en tu cartola del banco.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-cart-ink-2">CCI</span>
              <span className="text-[10.5px] text-cart-ink-3">20 dígitos</span>
            </div>
            <input
              value={cci}
              onChange={(e) => setCci(e.target.value.replace(/\D/g, "").slice(0, 20))}
              placeholder="00219412345678901234"
              inputMode="numeric"
              className="w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 font-mono text-[14px] text-white outline-none focus:border-cart-line-strong"
            />
            <p className="mt-1.5 text-[11.5px] text-cart-ink-3">
              Código de Cuenta Interbancario para transferencias entre bancos.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={update.isPending}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-cart-accent px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
          >
            {update.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
