"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Btn, C, FONT_DISPLAY, Field } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useDniLookup } from "@/lib/identity/hooks/useDniLookup";
import { useOnboarding } from "@/lib/identity/hooks/useOnboarding";
import { useUpdateProfile } from "@/lib/identity/hooks/useUpdateProfile";
import {
  ORGANIZER_TYPE_OPTIONS,
  copyFor,
  type OrganizerCopy,
  type OrganizerType,
} from "@/lib/identity/organizerType";

// ============================================================
//  Onboarding multi-step — flows copiados de Mobbin:
//   · Beside  → paso "tipo": header con back + barra de progreso,
//               headline + subheading centrados, hero-icon cuadrado
//               purpura, lista de cards con icon-square + chevron,
//               auto-avance al tocar.
//   · Base    → pasos con formulario: back + barra de progreso,
//               headline grande izquierda, fields, CTA sticky.
//
//  Persistencia:
//   · Step actual en URL ?step=... (sobrevive reload, back/fwd).
//   · Valores del form en sessionStorage (clave pasape:onboarding:v1).
//   · organizer_type se guarda a DB en cuanto el usuario lo elige.
//
//  Si el perfil ya tiene organizer_type, saltamos el paso de tipo.
// ============================================================

type StepKey = "type" | "identity" | "contact" | "entity" | "brand";
type Vals = {
  fullName: string;
  dni: string;
  email: string;
  phone: string;
  role: "buyer" | "organizer" | "promoter";
  entityName: string;
  entityTaxId: string;
  brandName: string;
  brandTouched: boolean;
};

const STORAGE_KEY = "pasape:onboarding:v2";

const EMPTY_VALS: Vals = {
  fullName: "",
  dni: "",
  email: "",
  phone: "",
  role: "buyer",
  entityName: "",
  entityTaxId: "",
  brandName: "",
  brandTouched: false,
};

const readVals = (): Vals => {
  if (typeof window === "undefined") return EMPTY_VALS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_VALS;
    return { ...EMPTY_VALS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_VALS;
  }
};

// Variants para AnimatePresence — slide+fade dependiendo de la dirección.
const stepVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
};

const stripLegalSuffix = (name: string): string =>
  name
    .trim()
    .replace(
      /\s*(S\.?A\.?C\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|S\.?A\.?|S\.?L\.?|LTDA\.?|S\.?A\.?S\.?)\s*$/i,
      "",
    )
    .trim();

const writeVals = (v: Vals) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const clearVals = () => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const onboarding = useOnboarding();
  const updateProfile = useUpdateProfile();
  const { lookup: dniLookup } = useDniLookup();

  const isOrganizerIntent = params.get("intent") === "organizer";
  const organizerType = me?.user?.organizerType ?? null;
  const copy: OrganizerCopy = useMemo(() => copyFor(organizerType), [organizerType]);

  // Steps son fijos por intent — NO los filtramos al guardar organizer_type,
  // porque eso impediría que el usuario volviera atrás a cambiarlo.
  const steps: StepKey[] = useMemo(() => {
    if (!isOrganizerIntent) return ["identity", "contact"];
    return ["type", "identity", "contact", "entity", "brand"];
  }, [isOrganizerIntent]);

  // Step actual viene del URL (?step=...). Default en primer load:
  //  · Sin ?step= y sin organizer_type guardado → empezamos en el primer step
  //  · Sin ?step= pero con organizer_type ya elegido → saltamos a identity
  //  · Con ?step= → respetamos lo que diga el URL (permite volver a "type")
  const stepFromUrl = params.get("step") as StepKey | null;
  const defaultStep: StepKey = organizerType && isOrganizerIntent ? "identity" : steps[0];
  const stepIndex = Math.max(
    0,
    steps.indexOf(stepFromUrl ?? defaultStep),
  );
  const step = steps[stepIndex] ?? steps[0];

  // Dirección de la animación (forward / back) — basada en el cambio de índice.
  const prevIndexRef = useRef(stepIndex);
  const direction = stepIndex >= prevIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevIndexRef.current = stepIndex;
  }, [stepIndex]);

  const setStep = useCallback(
    (next: StepKey) => {
      const sp = new URLSearchParams(params);
      sp.set("step", next);
      // Usamos replace cuando el paso ya está en URL para no llenar el history,
      // push cuando es un avance natural — así back gesture funciona.
      window.history.pushState(null, "", `?${sp.toString()}`);
      // forzamos re-render: leyendo searchParams en Next 16 — push de history no
      // dispara update automático, por eso disparamos un popstate manual.
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [params],
  );

  // Form values. Arrancamos con EMPTY_VALS para que el primer render coincida
  // con el SSR (sessionStorage no existe en server). Después del mount hidratamos.
  const [vals, setValsState] = useState<Vals>(EMPTY_VALS);
  useEffect(() => {
    const stored = readVals();
    setValsState((v) => ({
      ...v,
      ...stored,
      fullName: stored.fullName || me?.user?.fullName || "",
      email: stored.email || me?.user?.email || "",
      phone: stored.phone || me?.user?.phone || "",
      role: isOrganizerIntent ? "organizer" : (stored.role ?? "buyer"),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user?.id]);

  const setVals = (patch: Partial<Vals>) => {
    setValsState((v) => {
      const next = { ...v, ...patch };
      writeVals(next);
      return next;
    });
  };

  // DNI autocompleta nombre (Decolecta) si el usuario no lo tocó.
  const nameTouched = useRef(false);
  useEffect(() => {
    if (vals.dni.length !== 8) return;
    const t = setTimeout(async () => {
      const res = await dniLookup(vals.dni);
      if (res && !nameTouched.current) setVals({ fullName: res.fullName });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals.dni]);

  const hasGoogle = !!me?.user?.email;

  const onPickType = async (type: OrganizerType) => {
    // Optimistic: guardar en DB y avanzar de inmediato.
    void updateProfile.mutateAsync({ organizerType: type }).catch(() => {});
    setStep("identity");
  };

  const effectiveBrand =
    vals.brandTouched ? vals.brandName : stripLegalSuffix(vals.entityName);

  const submit = async () => {
    const result = await onboarding.mutateAsync({
      fullName: vals.fullName,
      email: vals.email || null,
      phone: vals.phone || null,
      dni: vals.dni || null,
      initialRole: vals.role,
      entityName: isOrganizerIntent ? vals.entityName || null : null,
      entityTaxId: isOrganizerIntent ? vals.entityTaxId || null : null,
      brandName: isOrganizerIntent ? effectiveBrand || null : null,
    });
    clearVals();
    router.replace(vals.role === "organizer" && result.orgSlug ? "/org" : "/");
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStep(steps[stepIndex - 1]);
  };

  const stepLabels = steps.map((s) => {
    if (s === "type") return "Tipo";
    if (s === "identity") return "Identidad";
    if (s === "contact") return "Contacto";
    if (s === "entity") return copy.legalEntityTerm.title;
    return "Marca";
  });

  return (
    <Shell
      step={stepIndex}
      total={steps.length}
      labels={stepLabels}
      userEmail={me?.user?.email ?? null}
    >
      <div className="pasape-onb-frame">
        <TopBar
          step={stepIndex}
          total={steps.length}
          labels={stepLabels}
          onBack={goBack}
        />

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 320, damping: 32, mass: 0.7 },
              opacity: { duration: 0.18 },
            }}
            style={{ display: "flex", flexDirection: "column", flex: 1 }}
          >
            {step === "type" && <TypeStep onPick={onPickType} />}
            {step === "identity" && (
              <IdentityStep
                vals={vals}
                isOrganizerIntent={isOrganizerIntent}
                onChange={(p) => {
                  if (p.fullName !== undefined) nameTouched.current = true;
                  setVals(p);
                }}
                onNext={() => setStep("contact")}
              />
            )}
            {step === "contact" && (
              <ContactStep
                vals={vals}
                hasGoogle={hasGoogle}
                isOrganizerIntent={isOrganizerIntent}
                onChange={(p) => setVals(p)}
                onAdvance={() => {
                  if (isOrganizerIntent) setStep("entity");
                  else void submit();
                }}
                isFinal={!isOrganizerIntent}
                submitting={onboarding.isPending}
                error={
                  !isOrganizerIntent && onboarding.error
                    ? (onboarding.error as Error).message
                    : null
                }
              />
            )}
            {step === "entity" && (
              <EntityStep
                vals={vals}
                copy={copy}
                onChange={(p) => setVals(p)}
                onNext={() => setStep("brand")}
              />
            )}
            {step === "brand" && (
              <BrandStep
                vals={vals}
                copy={copy}
                effectiveBrand={effectiveBrand}
                onChange={(p) => setVals(p)}
                onSubmit={() => void submit()}
                submitting={onboarding.isPending}
                error={onboarding.error ? (onboarding.error as Error).message : null}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Shell>
  );
}

// ───────────────────────────────────────────────
//  Shell — responsivo. Mobile: full-width iOS. Desktop: columna centrada
//  estilo Revolut Business / Better Stack (max-width 480 + gradiente sutil).
// ───────────────────────────────────────────────
const ONBOARDING_CSS = `
.pasape-onb-canvas {
  min-height: 100dvh;
  background: #0a0a0f;
  color: #fff;
  font-family: "General Sans", system-ui, -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
}
.pasape-onb-canvas::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(60% 50% at 20% 20%, rgba(124,58,237,0.18), transparent 60%),
    radial-gradient(50% 60% at 80% 90%, rgba(80,90,220,0.14), transparent 65%);
  opacity: 0;
  transition: opacity .4s;
}
.pasape-onb-topnav { display: none; }
.pasape-onb-sidebar { display: none; }
.pasape-onb-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.pasape-onb-brand {
  display: flex; align-items: center; gap: 8px;
  color: #fff; font-weight: 600; letter-spacing: -0.01em;
}
.pasape-onb-frame {
  width: 100%; max-width: 480px; margin: 0 auto;
  flex: 1; display: flex; flex-direction: column;
  position: relative; z-index: 1;
}
.pasape-onb-stepper { display: none; }
@media (min-width: 768px) {
  .pasape-onb-canvas::before { opacity: 1; }
  .pasape-onb-topnav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px;
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    background: transparent;
  }
  .pasape-onb-frame {
    justify-content: center;
    padding: 80px 0 64px;
  }
  .pasape-onb-topbar {
    padding: 0 0 32px !important;
    justify-content: center !important;
  }
  .pasape-onb-back { position: absolute; left: 0; }
  .pasape-onb-progress { display: none !important; }
  .pasape-onb-stepper {
    display: flex; align-items: flex-start; justify-content: center;
    gap: 0; padding: 8px 0 0;
  }
  .pasape-onb-stepper-item {
    display: flex; flex-direction: column; align-items: center;
    position: relative; min-width: 84px;
  }
  .pasape-onb-stepper-line {
    position: absolute; top: 13px; right: 50%;
    width: 100%; height: 1.5px;
    background: rgba(255,255,255,0.1);
    transform: translateX(-14px); z-index: 0;
  }
  .pasape-onb-stepper-item:first-child .pasape-onb-stepper-line { display: none; }
  .pasape-onb-stepper-dot {
    position: relative; z-index: 1;
    width: 26px; height: 26px; border-radius: 999px;
    display: grid; place-items: center;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.55); background: #0a0a0f;
    box-shadow: 0 0 0 1.5px rgba(255,255,255,0.14) inset;
    transition: all .2s;
  }
  .pasape-onb-stepper-dot.is-active {
    color: #fff; background: #7c3aed;
    box-shadow: 0 0 0 1.5px #7c3aed inset, 0 0 0 4px rgba(124,58,237,0.18);
  }
  .pasape-onb-stepper-dot.is-done {
    color: #fff; background: #7c3aed;
    box-shadow: 0 0 0 1.5px #7c3aed inset;
  }
  .pasape-onb-stepper-line.is-done { background: #7c3aed; }
  .pasape-onb-stepper-label {
    margin-top: 8px; font-size: 11px;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.02em; white-space: nowrap;
  }
  .pasape-onb-stepper-label.is-active { color: #fff; font-weight: 600; }
  .pasape-onb-step { padding: 4px 8px 0 !important; flex: initial !important; }
  .pasape-onb-header { text-align: center; margin-bottom: 28px; padding: 0 8px; }
  .pasape-onb-header p { max-width: 360px; margin-left: auto !important; margin-right: auto !important; }
  .pasape-onb-title { font-size: 34px !important; }
  .pasape-onb-cta button {
    max-width: 260px;
    margin: 0 auto;
  }
  .pasape-onb-card {
    border-radius: 22px !important;
    background: rgba(255,255,255,0.035) !important;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.07) inset,
      0 30px 60px -30px rgba(0,0,0,0.6) !important;
  }
  .pasape-onb-card-row { padding: 18px 18px !important; }
  .pasape-onb-cta { padding-bottom: 8px !important; background: none !important; }
}

/* ============================================================
   Desktop ≥1024: split layout estilo Remote — sidebar oscuro
   con vertical stepper a la izquierda, content panel a la derecha.
   ============================================================ */
@media (min-width: 1024px) {
  .pasape-onb-canvas {
    flex-direction: row;
    align-items: stretch;
  }
  .pasape-onb-topnav { display: none !important; }
  .pasape-onb-sidebar {
    display: flex;
    flex-direction: column;
    width: 380px;
    flex-shrink: 0;
    padding: 36px 36px 32px;
    background: linear-gradient(180deg, #0e0e18 0%, #0a0a0f 70%);
    box-shadow: inset -1px 0 0 rgba(255,255,255,0.06);
    position: relative;
    overflow: hidden;
  }
  .pasape-onb-sidebar::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(70% 50% at 20% 100%, rgba(124,58,237,0.22), transparent 70%),
      radial-gradient(50% 30% at 100% 0%, rgba(80,90,220,0.16), transparent 70%);
  }
  .pasape-onb-sidebar > * { position: relative; z-index: 1; }
  .pasape-onb-side-center {
    margin-block: auto;   /* centra verticalmente entre brand (top) y footer (bottom) */
    padding-block: 24px;
  }
  .pasape-onb-side-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: #fff;
  }
  .pasape-onb-side-sub {
    margin-top: 10px;
    font-size: 13.5px;
    line-height: 1.55;
    color: rgba(255,255,255,0.55);
    max-width: 280px;
  }
  .pasape-onb-vstepper {
    list-style: none;
    margin: 32px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .pasape-onb-vstepper-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
  }
  .pasape-onb-vstepper-item::before {
    content: "";
    position: absolute;
    left: 14px;
    top: 36px;
    bottom: -10px;
    width: 1.5px;
    background: rgba(255,255,255,0.1);
  }
  .pasape-onb-vstepper-item:last-child::before { display: none; }
  .pasape-onb-vstepper-item.is-done::before,
  .pasape-onb-vstepper-item.is-active::before {
    background: #7c3aed;
  }
  .pasape-onb-vstepper-dot {
    width: 28px; height: 28px; border-radius: 999px;
    display: grid; place-items: center;
    font-size: 12.5px; font-weight: 600;
    color: rgba(255,255,255,0.55);
    background: #0a0a0f;
    box-shadow: 0 0 0 1.5px rgba(255,255,255,0.14) inset;
    flex-shrink: 0;
    transition: all .2s;
  }
  .pasape-onb-vstepper-item.is-active .pasape-onb-vstepper-dot {
    color: #fff;
    background: #7c3aed;
    box-shadow: 0 0 0 1.5px #7c3aed inset, 0 0 0 4px rgba(124,58,237,0.18);
  }
  .pasape-onb-vstepper-item.is-done .pasape-onb-vstepper-dot {
    color: #fff;
    background: #7c3aed;
    box-shadow: 0 0 0 1.5px #7c3aed inset;
  }
  .pasape-onb-vstepper-label {
    font-size: 14px;
    color: rgba(255,255,255,0.55);
    letter-spacing: -0.005em;
  }
  .pasape-onb-vstepper-item.is-active .pasape-onb-vstepper-label {
    color: #fff;
    font-weight: 600;
  }
  .pasape-onb-side-footer { padding-top: 16px; }

  .pasape-onb-main {
    flex: 1;
    justify-content: center;
    align-items: center;
    padding: 56px 48px;
    position: relative;
    z-index: 1;
  }
  .pasape-onb-frame {
    max-width: 460px;
    width: 100%;
    margin: 0;
    flex: 0 0 auto !important;   /* deja que justify-content: center funcione */
    padding: 0 !important;
    min-height: 560px;            /* ancla la posición del back y evita saltos entre steps */
  }
  /* Stepper horizontal ya no se necesita en desktop wide */
  .pasape-onb-stepper { display: none !important; }
  /* El back queda flotando arriba a la izquierda del content */
  .pasape-onb-topbar {
    padding: 0 0 24px !important;
    justify-content: flex-start !important;
  }
  .pasape-onb-back { position: static !important; }
  /* Header alineado a la izquierda en split layout (no centrado) */
  .pasape-onb-header {
    text-align: left !important;
    margin-bottom: 32px;
    padding: 0 !important;
  }
  .pasape-onb-header p { max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; }
  .pasape-onb-cta button { max-width: none !important; margin: 0 !important; }
}
`;

function Shell({
  children,
  step,
  total,
  labels,
  userEmail,
}: {
  children: ReactNode;
  step: number;
  total: number;
  labels: string[];
  userEmail: string | null;
}) {
  return (
    <div className="pasape-onb-canvas">
      <style dangerouslySetInnerHTML={{ __html: ONBOARDING_CSS }} />
      {/* Sidebar — solo visible en desktop ≥1024px (Remote-style) */}
      <aside className="pasape-onb-sidebar">
        <div className="pasape-onb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-icon-min.svg" alt="Pasape" width={26} height={26} />
          <span style={{ fontSize: 12, letterSpacing: "0.22em", fontWeight: 700, color: "#fff" }}>
            PASAPE
          </span>
        </div>
        <div className="pasape-onb-side-center">
          <div className="pasape-onb-side-title">
            Crea tu cuenta de organizador.
          </div>
          <p className="pasape-onb-side-sub">
            Te tomará menos de un minuto. Puedes editar todo después en Configuración.
          </p>
          <ol className="pasape-onb-vstepper">
          {labels.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label + i}
                className={
                  "pasape-onb-vstepper-item" +
                  (active ? " is-active" : done ? " is-done" : "")
                }
              >
                <span className="pasape-onb-vstepper-dot">
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6.2l2.4 2.4L9.5 4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="pasape-onb-vstepper-label">{label}</span>
              </li>
            );
          })}
          </ol>
        </div>
        {userEmail && (
          <div className="pasape-onb-side-footer">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
              SESIÓN
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                color: "rgba(255,255,255,0.75)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userEmail}
            </div>
          </div>
        )}
      </aside>

      {/* Topnav viejo — solo se muestra en 768–1023 (sin sidebar) */}
      <div className="pasape-onb-topnav">
        <div className="pasape-onb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-icon-min.svg" alt="Pasape" width={22} height={22} />
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              fontWeight: 700,
              color: C.dim,
            }}
          >
            PASAPE
          </span>
        </div>
      </div>

      <main className="pasape-onb-main">{children}</main>
    </div>
  );
}

// ───────────────────────────────────────────────
//  TopBar: back round + barra de progreso (Base/Beside).
// ───────────────────────────────────────────────
function TopBar({
  step,
  total,
  labels,
  onBack,
}: {
  step: number;
  total: number;
  labels: string[];
  onBack: () => void;
}) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div
      className="pasape-onb-topbar"
      style={{
        padding: "14px 18px 0",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Atrás"
        className="pasape-onb-back"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: 0,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* Desktop: stepper con números + labels (estilo Pipedrive) */}
      <div className="pasape-onb-stepper">
        {labels.map((label, i) => {
          const done = i < step;
          const active = i === step;
          const lineDone = i <= step; // la línea izquierda se llena si llegamos hasta acá
          return (
            <div key={label + i} className="pasape-onb-stepper-item">
              <div
                className={
                  "pasape-onb-stepper-line" + (lineDone ? " is-done" : "")
                }
                aria-hidden
              />
              <div
                className={
                  "pasape-onb-stepper-dot" +
                  (active ? " is-active" : done ? " is-done" : "")
                }
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.2l2.4 2.4L9.5 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div
                className={
                  "pasape-onb-stepper-label" + (active ? " is-active" : "")
                }
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
      {/* Mobile: pill bar */}
      <div
        className="pasape-onb-progress"
        style={{
          flex: 1,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${C.purple} 0%, #B594F6 100%)`,
            transition: "width .35s cubic-bezier(.2,.8,.2,1)",
            boxShadow: "0 0 10px rgba(124,58,237,0.55)",
          }}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
//  TypeStep — copia del flow Beside.
// ───────────────────────────────────────────────
function TypeStep({ onPick }: { onPick: (t: OrganizerType) => void }) {
  return (
    <div className="pasape-onb-step" style={{ padding: "28px 22px 24px", flex: 1 }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 22px",
          borderRadius: 18,
          background: C.purple,
          display: "grid",
          placeItems: "center",
          boxShadow:
            "0 12px 28px -8px rgba(124,58,237,0.55), 0 0 0 1px rgba(255,255,255,0.05) inset",
          color: "#fff",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 20V8.5L12 3l8 5.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          textAlign: "center",
          margin: 0,
        }}
      >
        ¿Cómo organizas tus eventos?
      </h1>
      <p
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: 1.5,
          color: C.dim,
          textAlign: "center",
          padding: "0 6px",
        }}
      >
        Elige la opción que mejor te describe. Adaptamos los textos según tu tipo.
      </p>

      <div
        className="pasape-onb-card"
        style={{
          marginTop: 24,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
          overflow: "hidden",
        }}
      >
        {ORGANIZER_TYPE_OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className="pasape-onb-card-row"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              background: "transparent",
              border: 0,
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: C.purpleSoft,
                color: C.purple,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {opt.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: FONT_DISPLAY,
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                {opt.label}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: C.dim,
                }}
              >
                {opt.description}
              </span>
            </span>
            <Chevron />
          </button>
        ))}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ color: C.dimmer, flexShrink: 0 }}
    >
      <path
        d="M5 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ───────────────────────────────────────────────
//  IdentityStep — nombre + DNI.
// ───────────────────────────────────────────────
function IdentityStep({
  vals,
  isOrganizerIntent,
  onChange,
  onNext,
}: {
  vals: Vals;
  isOrganizerIntent: boolean;
  onChange: (p: Partial<Vals>) => void;
  onNext: () => void;
}) {
  const canContinue = vals.fullName.trim().length > 0;
  return (
    <StepBody
      eyebrow="Tu identidad"
      title={<>Empecemos<br />por tu nombre.</>}
      hint={
        isOrganizerIntent
          ? "Aparece en tu panel y en los avisos a tu equipo. Lo puedes cambiar después."
          : "Solo va a tu QR. No lo mostramos a nadie más."
      }
      cta={
        <Btn onClick={onNext} disabled={!canContinue}>
          Continuar →
        </Btn>
      }
    >
      <Field
        label="Nombre completo"
        value={vals.fullName}
        onChange={(e) => onChange({ fullName: e.target.value })}
        placeholder="Juan Pérez García"
        active={vals.fullName.length > 0}
        autoFocus
      />
      <Field
        label="DNI"
        mono
        value={vals.dni}
        onChange={(e) => onChange({ dni: e.target.value.replace(/\D/g, "") })}
        placeholder="71234567"
        active={vals.dni.length > 0}
        hint={
          isOrganizerIntent
            ? "Opcional. Solo si quieres que aparezca en facturas o reportes."
            : "Opcional. Si lo pones, autocompletamos tu nombre."
        }
      />
    </StepBody>
  );
}

// ───────────────────────────────────────────────
//  ContactStep — celular o email + role opcional.
// ───────────────────────────────────────────────
function ContactStep({
  vals,
  hasGoogle,
  isOrganizerIntent,
  onChange,
  onAdvance,
  isFinal,
  submitting,
  error,
}: {
  vals: Vals;
  hasGoogle: boolean;
  isOrganizerIntent: boolean;
  onChange: (p: Partial<Vals>) => void;
  onAdvance: () => void;
  isFinal: boolean;
  submitting: boolean;
  error: string | null;
}) {
  const ready = hasGoogle ? vals.phone.length >= 6 : /.+@.+\..+/.test(vals.email);
  return (
    <StepBody
      eyebrow={isOrganizerIntent ? "Cómo te contactamos" : "Último paso"}
      title={
        hasGoogle ? (
          <>Tu número<br />de contacto.</>
        ) : (
          <>¿A qué correo<br />te escribimos?</>
        )
      }
      hint={
        isOrganizerIntent
          ? hasGoogle
            ? "Por aquí te avisamos de ventas, escaneos y reportes. Nada de spam."
            : "A este correo te mandamos los avisos del panel y los reportes."
          : hasGoogle
            ? "Te avisamos por WhatsApp cuando tu QR esté listo."
            : "Te mandamos tus tickets ahí. Nada de spam."
      }
      cta={
        <>
          {error && (
            <div style={{ marginBottom: 10, fontSize: 12, color: C.red }}>{error}</div>
          )}
          <Btn onClick={onAdvance} disabled={(isFinal && submitting) || !ready}>
            {isFinal ? (submitting ? "Guardando…" : "Listo") : "Continuar →"}
          </Btn>
        </>
      }
    >
      {hasGoogle ? (
        <Field
          label="Celular"
          mono
          value={vals.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="987 654 321"
          active={vals.phone.length > 0}
          autoFocus
        />
      ) : (
        <Field
          label="Email"
          type="email"
          value={vals.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="juan@gmail.com"
          active={vals.email.length > 0}
          autoFocus
        />
      )}
      {!isOrganizerIntent && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: C.dimmer,
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            CÓMO VAS A USAR PASAPE
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["buyer", "promoter", "organizer"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ role: r })}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  border: 0,
                  background: vals.role === r ? C.purple : "rgba(255,255,255,0.05)",
                  color: vals.role === r ? "#fff" : C.dim,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {r === "buyer" ? "Comprar" : r === "promoter" ? "Promotor" : "Organizador"}
              </button>
            ))}
          </div>
        </div>
      )}
    </StepBody>
  );
}

// ───────────────────────────────────────────────
//  EntityStep — razón social / cliente / local (copy condicional).
// ───────────────────────────────────────────────
function EntityStep({
  vals,
  copy,
  onChange,
  onNext,
}: {
  vals: Vals;
  copy: OrganizerCopy;
  onChange: (p: Partial<Vals>) => void;
  onNext: () => void;
}) {
  const canContinue = vals.entityName.trim().length > 0;
  return (
    <StepBody
      eyebrow={copy.legalEntityTerm.title}
      title={<>{copy.newEntity.headline}.</>}
      hint={copy.newEntity.subhint}
      cta={
        <Btn onClick={onNext} disabled={!canContinue}>
          Continuar →
        </Btn>
      }
    >
      <Field
        label={copy.newEntity.nameLabel}
        value={vals.entityName}
        onChange={(e) => onChange({ entityName: e.target.value })}
        placeholder={copy.newEntity.namePlaceholder}
        active={vals.entityName.length > 0}
        autoFocus
      />
      <Field
        label="RUC (opcional)"
        mono
        value={vals.entityTaxId}
        onChange={(e) => onChange({ entityTaxId: e.target.value.replace(/\D/g, "") })}
        placeholder="20XXXXXXXXX"
        active={vals.entityTaxId.length > 0}
        hint="Solo si emites factura. No es obligatorio para arrancar."
      />
    </StepBody>
  );
}

// ───────────────────────────────────────────────
//  BrandStep — primera marca (con sugerencia desde entityName).
// ───────────────────────────────────────────────
function BrandStep({
  vals,
  copy,
  effectiveBrand,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  vals: Vals;
  copy: OrganizerCopy;
  effectiveBrand: string;
  onChange: (p: Partial<Vals>) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const ready = effectiveBrand.trim().length > 0;
  return (
    <StepBody
      eyebrow="Tu primera marca"
      title={<>{copy.newBrand.headline}.</>}
      hint={copy.newBrand.subhint}
      cta={
        <>
          {error && (
            <div style={{ marginBottom: 10, fontSize: 12, color: C.red }}>{error}</div>
          )}
          <Btn onClick={onSubmit} disabled={submitting || !ready}>
            {submitting ? "Creando panel…" : "Crear panel"}
          </Btn>
        </>
      }
    >
      <Field
        label="Nombre de la marca"
        value={effectiveBrand}
        onChange={(e) =>
          onChange({ brandName: e.target.value, brandTouched: true })
        }
        placeholder="Nombre de tu marca"
        active={effectiveBrand.length > 0}
        hint={copy.newBrand.fieldHint}
        autoFocus
      />
      <div
        style={{
          marginTop: 4,
          padding: "12px 14px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            color: C.dimmer,
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          {copy.newBrand.livesUnderLabel.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {vals.entityName || "—"}
        </div>
      </div>
    </StepBody>
  );
}

// ───────────────────────────────────────────────
//  StepBody — layout compartido (eyebrow + título + form + CTA sticky).
//  Inspirado en Base.
// ───────────────────────────────────────────────
function StepBody({
  eyebrow,
  title,
  hint,
  children,
  cta,
}: {
  eyebrow: string;
  title: ReactNode;
  hint?: string;
  children: ReactNode;
  cta: ReactNode;
}) {
  return (
    <>
      <div className="pasape-onb-step" style={{ padding: "28px 22px 0", flex: 1 }}>
        <div className="pasape-onb-header">
          <div
            style={{
              fontSize: 11,
              color: C.purple,
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {eyebrow.toUpperCase()}
          </div>
          <h1
            className="pasape-onb-title"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              margin: 0,
              marginBottom: 8,
              color: "#fff",
            }}
          >
            {title}
          </h1>
          {hint && (
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: C.dim,
                margin: "0 0 22px",
              }}
            >
              {hint}
            </p>
          )}
        </div>
        {children}
      </div>
      <div
        className="pasape-onb-cta"
        style={{
          position: "sticky",
          bottom: 0,
          padding: "16px 22px 24px",
          background: `linear-gradient(180deg, transparent 0%, ${C.bg} 40%)`,
        }}
      >
        {cta}
      </div>
    </>
  );
}
