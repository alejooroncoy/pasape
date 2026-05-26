"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { OrgShell } from "@/app/[locale]/org/_shell/OrgShell";
import { SettingsCard, SettingsRow } from "@/app/[locale]/org/settings/_components/SettingsCard";
import { TextInput } from "@/app/[locale]/org/settings/_components/Field";
import { useUpdateLegalEntity } from "@/lib/identity/organizations/hooks/useUpdateLegalEntity";

type Entity = {
  id: string;
  name: string;
  taxId: string | null;
  country: string;
  slug: string | null;
  displayName: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
};
type Org = { id: string; slug: string; name: string; logoUrl: string | null };

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function LegalEntityClient({ entity, orgs }: { entity: Entity; orgs: Org[] }) {
  const router = useRouter();
  const update = useUpdateLegalEntity();

  // ====== datos legales
  const [name, setName] = useState(entity.name);
  const [taxId, setTaxId] = useState(entity.taxId ?? "");

  const legalDirty = name.trim() !== entity.name || (taxId.trim() || null) !== entity.taxId;

  const saveLegal = async () => {
    if (!legalDirty || !name.trim()) return;
    await update.mutateAsync({
      id: entity.id,
      name: name.trim(),
      taxId: taxId.trim() || null,
    });
    router.refresh();
  };

  // ====== página pública
  const initiallyEnabled = !!entity.slug;
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [displayName, setDisplayName] = useState(entity.displayName ?? "");
  const [slug, setSlug] = useState(entity.slug ?? "");
  const [bio, setBio] = useState(entity.bio ?? "");
  const [logoUrl, setLogoUrl] = useState(entity.logoUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(entity.coverUrl ?? "");

  // Auto-sugiere slug a partir del display name si está vacío.
  useEffect(() => {
    if (enabled && !slug && displayName) {
      setSlug(slugify(displayName));
    }
  }, [enabled, slug, displayName]);

  const slugValid = SLUG_RE.test(slug);
  const publicDirty =
    enabled !== initiallyEnabled ||
    (enabled
      ? slug !== (entity.slug ?? "") ||
        displayName !== (entity.displayName ?? "") ||
        bio !== (entity.bio ?? "") ||
        logoUrl !== (entity.logoUrl ?? "") ||
        coverUrl !== (entity.coverUrl ?? "")
      : false);

  const publicSaveDisabled =
    !publicDirty ||
    update.isPending ||
    (enabled && (!slugValid || displayName.trim().length === 0));

  const publicHref = useMemo(() => (enabled && slug ? `/p/${slug}` : null), [enabled, slug]);

  const savePublic = async () => {
    if (publicSaveDisabled) return;
    if (!enabled) {
      // apagar: borrar slug. Mantenemos otros campos como meta por si vuelve a activar.
      await update.mutateAsync({ id: entity.id, slug: null });
    } else {
      await update.mutateAsync({
        id: entity.id,
        slug: slug.trim(),
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        logoUrl: logoUrl.trim() || null,
        coverUrl: coverUrl.trim() || null,
      });
    }
    router.refresh();
  };

  return (
    <OrgShell>
      <div className="mb-8 sm:mb-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-cart-ink-3 transition hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M7 2L3 6l4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Volver
        </button>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cart-ink-3">
          Productora
        </div>
        <h1 className="mt-1 font-sans text-[clamp(28px,5vw,36px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
          {entity.displayName || entity.name}
        </h1>
        <p className="mt-2 max-w-prose text-[13.5px] leading-snug text-cart-ink-3">
          Los cambios afectan a{" "}
          {orgs.length === 1 ? "la marca" : `las ${orgs.length} marcas`} que viven bajo esta productora.
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="flex flex-col gap-6"
      >
        {/* ============== Página pública del grupo ============== */}
        <SettingsCard
          title="Página pública del grupo"
          description="Una sola URL con todas tus marcas. Opcional — si la tienes apagada, cada marca sigue teniendo su propia página."
        >
          {/* Toggle hero — patrón Glass */}
          <div className="px-6 py-4 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[14.5px] font-semibold tracking-[-0.01em]">
                    {enabled ? "Activa" : "Apagada"}
                  </div>
                  {enabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#22D17F]/12 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#22D17F]">
                      <span className="size-1 rounded-full bg-[#22D17F]" />
                      EN LÍNEA
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12.5px] text-cart-ink-3">
                  {publicHref ? (
                    <>
                      Disponible en{" "}
                      <span className="font-mono text-cart-ink-2">pasape.lat{publicHref}</span>
                    </>
                  ) : (
                    "Activa para crear una URL paraguas con todas tus marcas."
                  )}
                </div>
              </div>
              <Toggle on={enabled} onChange={setEnabled} />
            </div>
          </div>

          {/* Form de detalles, solo cuando está activa */}
          {enabled && (
            <>
              <div className="border-t border-cart-line" />
              <SettingsRow
                label="Nombre para mostrar"
                description="Cómo se llama el grupo públicamente."
              >
                <TextInput
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nombre público"
                />
              </SettingsRow>

              <SettingsRow
                label={
                  <span className="inline-flex items-center gap-2">
                    URL pública
                    {slug && slugValid && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#22D17F]/12 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.1em] text-[#22D17F]">
                        <span className="size-1 rounded-full bg-[#22D17F]" />
                        OK
                      </span>
                    )}
                    {slug && !slugValid && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/12 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.1em] text-amber-300">
                        REVISAR
                      </span>
                    )}
                  </span>
                }
                description="Solo letras minúsculas, números y guiones."
              >
                <div className="flex items-center gap-2 rounded-xl border border-cart-line bg-cart-bg-elev px-3 py-2 transition focus-within:border-cart-line-strong">
                  <span className="font-mono text-[12.5px] text-cart-ink-3">pasape.lat/p/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="inpuntahermosa"
                    className="flex-1 bg-transparent font-mono text-[13.5px] font-semibold text-white outline-none placeholder:text-cart-ink-4"
                  />
                </div>
              </SettingsRow>

              <SettingsRow label="Bio" description="Una línea sobre el grupo. Máximo 280.">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 280))}
                  rows={3}
                  placeholder="Discoteca y club nocturno"
                  className="w-full resize-none rounded-xl border border-cart-line bg-cart-bg-elev px-3 py-2 text-[14px] outline-none transition placeholder:text-cart-ink-4 focus:border-cart-line-strong"
                />
                <div className="mt-1 text-right text-[10.5px] text-cart-ink-4">
                  {bio.length}/280
                </div>
              </SettingsRow>

              <SettingsRow label="Logo (URL)" description="Cuadrado, mín 256×256.">
                <TextInput
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.png"
                  type="url"
                />
              </SettingsRow>

              <SettingsRow label="Portada (URL)" description="Ancho 16:9, mín 1280×720.">
                <TextInput
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…/cover.jpg"
                  type="url"
                />
              </SettingsRow>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cart-line px-6 py-4 sm:px-8">
            <div className="text-[12px] text-cart-ink-3">
              {publicHref && (
                <Link
                  href={publicHref as never}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-medium text-cart-ink-2 transition hover:text-white"
                  target="_blank"
                >
                  Ver página →
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={savePublic}
              disabled={publicSaveDisabled}
              className="rounded-full bg-cart-accent px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
            >
              {update.isPending
                ? "Guardando…"
                : !enabled && initiallyEnabled
                  ? "Apagar página"
                  : "Guardar"}
            </button>
          </div>
        </SettingsCard>

        {/* ============== Datos legales ============== */}
        <SettingsCard title="Datos legales" description="Aparecen en facturas y en tu contabilidad.">
          <SettingsRow label="Nombre legal" description="Como aparece en SUNAT (si tienes RUC).">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nocturno Producciones S.A.C."
            />
          </SettingsRow>
          <SettingsRow label="RUC" description="Identificador tributario.">
            <TextInput
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="20XXXXXXXXX"
              inputMode="numeric"
            />
          </SettingsRow>
          <SettingsRow label="País" description="Jurisdicción donde está constituida.">
            <TextInput value={entity.country} readonly />
          </SettingsRow>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-cart-line px-6 py-4 sm:px-8">
            {update.isSuccess && !legalDirty && !publicDirty && (
              <span className="text-[12px] text-emerald-300">Cambios guardados.</span>
            )}
            {update.error && (
              <span className="text-[12px] text-rose-300">
                No se pudo guardar. Intenta de nuevo.
              </span>
            )}
            <button
              type="button"
              onClick={saveLegal}
              disabled={!legalDirty || update.isPending || !name.trim()}
              className="rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </SettingsCard>

        {/* ============== Marcas ============== */}
        <SettingsCard
          title="Tus marcas"
          description={`${orgs.length} ${orgs.length === 1 ? "marca activa" : "marcas activas"} bajo esta productora.`}
        >
          {orgs.map((org) => (
            <SettingsRow
              key={org.id}
              label={
                <span className="inline-flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid size-8 flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-cart-line-strong bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[12px] font-semibold text-white"
                  >
                    {org.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      org.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span>{org.name}</span>
                </span>
              }
            >
              <div className="flex justify-end gap-2">
                <Link
                  href={`/${org.slug}` as never}
                  target="_blank"
                  className="rounded-full bg-white/5 px-3 py-1.5 text-[12px] font-medium text-cart-ink-2 transition hover:text-white"
                >
                  Ver página
                </Link>
                <Link
                  href={"/org/settings" as never}
                  className="rounded-full border border-cart-line bg-cart-bg px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 hover:border-cart-line-strong hover:text-white"
                >
                  Gestionar
                </Link>
              </div>
            </SettingsRow>
          ))}
          <div className="flex justify-end px-6 py-4 sm:px-8">
            <Link
              href={`/org/new?legalEntityId=${entity.id}` as never}
              className="rounded-full bg-cart-accent px-4 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110"
            >
              + Nueva marca
            </Link>
          </div>
        </SettingsCard>
      </motion.div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </OrgShell>
  );
}

// ============================================================
// iOS-style toggle
// ============================================================
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={
        "relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200 " +
        (on
          ? "bg-cart-accent shadow-[0_0_12px_var(--color-cart-accent-glow)]"
          : "bg-white/10")
      }
    >
      <span
        className={
          "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-200 " +
          (on ? "translate-x-[24px]" : "translate-x-0")
        }
      />
    </button>
  );
}
