"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCreateOrg } from "@/lib/identity/organizations/hooks/useCreateOrg";
import { useLegalEntities } from "@/lib/identity/organizations/hooks/useLegalEntities";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "@/i18n/navigation";

// Quita sufijos legales comunes en Perú/LATAM para sugerir el nombre de marca
// a partir del nombre legal. Ej: "Tardeo S.A.C." → "Tardeo".
const stripLegalSuffix = (name: string): string =>
  name
    .trim()
    .replace(/\s*(S\.?A\.?C\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|S\.?A\.?|S\.?L\.?|LTDA\.?|S\.?A\.?S\.?)\s*$/i, "")
    .trim();

// /org/new ya solo cubre el caso "agregar marca extra" desde el switcher.
// El first-time se hace en /auth/onboarding (page.tsx redirige cuando
// el usuario aún no tiene marcas).
export function NewOrgClient(_: { isFirstTime: boolean }) {
  return (
    <div className="pt-2">
      <InlineNewBrand />
    </div>
  );
}

// ============================================================
// Onboarding: flow multi-step para usuarios nuevos.
// ============================================================


function LabeledInput({
  label,
  optional,
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-cart-ink-2">{label}</span>
        {optional && <span className="text-[11px] text-cart-ink-4">opcional</span>}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
      />
    </label>
  );
}

// ============================================================
// Inline: "+ Nueva marca" desde el switcher (usuario con marcas existentes).
// ============================================================

function InlineNewBrand() {
  const router = useRouter();
  const search = useSearchParams();
  const entities = useLegalEntities();
  const create = useCreateOrg();

  const presetEntityId = search.get("legalEntityId");
  // `?step=razon-social` viene del switcher cuando el usuario clickea
  // "Nueva razón social" — forzamos modo "new" para que arranque creando
  // una entidad, no eligiendo una existente.
  const forceNewEntity = search.get("step") === "razon-social";
  const myEntities = entities.data ?? [];
  const hasEntities = myEntities.length > 0;

  const [mode, setMode] = useState<"pick" | "new">(
    forceNewEntity || !hasEntities ? "new" : "pick",
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    presetEntityId ?? myEntities[0]?.id ?? "",
  );
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityTaxId, setNewEntityTaxId] = useState("");
  const [name, setName] = useState("");
  const [brandTouched, setBrandTouched] = useState(false);

  // Auto-prefill cuando estás creando nueva razón social: usa el nombre limpio.
  const suggestedFromEntity = stripLegalSuffix(newEntityName);
  const effectiveName =
    mode === "new" && !brandTouched && suggestedFromEntity ? suggestedFromEntity : name;

  useEffect(() => {
    if (!hasEntities) {
      setMode("new");
    } else if (!forceNewEntity) {
      setMode((m) => (m === "new" && !newEntityName ? "pick" : m));
      setSelectedEntityId((prev) => prev || presetEntityId || myEntities[0]?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEntities, presetEntityId, forceNewEntity, myEntities.length]);

  const errorMessage = create.error instanceof Error ? create.error.message : null;

  const submit = async () => {
    await create.mutateAsync({
      name: effectiveName.trim(),
      ...(mode === "pick"
        ? { legalEntityId: selectedEntityId }
        : {
            newLegalEntity: {
              name: newEntityName.trim(),
              taxId: newEntityTaxId.trim() || null,
            },
          }),
    });
    router.replace("/org");
  };

  const canSubmit = useMemo(() => {
    if (!effectiveName.trim()) return false;
    if (mode === "pick") return Boolean(selectedEntityId);
    return Boolean(newEntityName.trim());
  }, [effectiveName, mode, selectedEntityId, newEntityName]);

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="mb-6">
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.02em] text-cart-ink">
          {forceNewEntity ? "Nueva productora" : "Nueva marca"}
        </h1>
        <p className="mt-1 text-[13.5px] text-cart-ink-3">
          {forceNewEntity
            ? "Crea tu productora y su primera marca."
            : "Elige bajo qué productora vive esta marca o crea una nueva."}
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-cart-line bg-cart-bg-elev p-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Productora
            </h2>
            {hasEntities && (
              <button
                type="button"
                onClick={() => setMode(mode === "pick" ? "new" : "pick")}
                className="text-[12px] font-medium text-cart-accent hover:underline"
              >
                {mode === "pick" ? "+ Crear nueva" : "Usar existente"}
              </button>
            )}
          </div>

          {mode === "pick" && hasEntities ? (
            <div className="overflow-hidden rounded-xl border border-cart-line bg-cart-bg-elev-2/60">
              {myEntities.map((e, idx) => {
                const active = e.id === selectedEntityId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedEntityId(e.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      idx > 0 ? "border-t border-cart-line/60" : ""
                    } ${active ? "bg-cart-accent-soft/40" : "hover:bg-cart-bg-elev-2/80"}`}
                  >
                    <span
                      aria-hidden
                      className={`grid size-5 flex-shrink-0 place-items-center rounded-full border ${
                        active ? "border-cart-accent bg-cart-accent" : "border-cart-line-strong"
                      }`}
                    >
                      {active && <span className="size-2 rounded-full bg-black" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-semibold text-cart-ink">
                        {e.name}
                      </span>
                      {e.taxId && (
                        <span className="truncate text-[11.5px] text-cart-ink-3">
                          RUC {e.taxId}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <LabeledInput
                label="Nombre"
                value={newEntityName}
                onChange={setNewEntityName}
                placeholder="Nocturno Producciones"
                autoFocus={!hasEntities}
              />
              <LabeledInput
                label="RUC"
                optional
                value={newEntityTaxId}
                onChange={setNewEntityTaxId}
                placeholder="20XXXXXXXXX"
                inputMode="numeric"
              />
            </div>
          )}
        </section>

        <div className="h-px bg-cart-line" aria-hidden />

        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Marca
          </h2>
          <div className="flex flex-col gap-1.5">
            <LabeledInput
              label="Nombre de la marca"
              value={effectiveName}
              onChange={(v) => {
                setBrandTouched(true);
                setName(v);
              }}
              placeholder="Nombre de tu marca"
              autoFocus={hasEntities}
            />
            {mode === "new" && (
              <p className="text-[11.5px] leading-snug text-cart-ink-4">
                Si tu razón social y tu marca son lo mismo, deja este nombre.
                Si manejas varias bajo la misma empresa, ponle el nombre del primer producto.
              </p>
            )}
          </div>
        </section>

        {errorMessage && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => router.replace("/org")}
            className="rounded-full border border-cart-line bg-transparent px-4 py-2 text-[13px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
          >
            Cancelar
          </button>
          <Button
            size="lg"
            disabled={create.isPending || !canSubmit}
            onClick={submit}
          >
            {create.isPending ? "Creando…" : "Crear marca"}
          </Button>
        </div>
      </div>
    </div>
  );
}
