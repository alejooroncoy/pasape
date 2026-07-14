import type { OrganizerType } from "@/lib/identity/organizerType";

export type OnboardingStepKey = "type" | "identity" | "contact" | "entity" | "brand";

// Extraída a un módulo sin dependencias de Next/React para poder testearla sin
// arrastrar el árbol de imports de page.tsx (next-intl navigation, motion,
// etc.) — ver onboardingSteps.test.ts.
//
// Regresión (plan-eng-review 2026-07-12): acortar el onboarding para
// independent_host (artista/banda independiente) NO debe tocar el recorrido
// de production_company/venue_owner — ambos siguen viendo los 5 pasos
// completos, sin cambio.
export const computeOnboardingSteps = (
  isOrganizerIntent: boolean,
  organizerType: OrganizerType | null,
): OnboardingStepKey[] => {
  if (!isOrganizerIntent) return ["identity", "contact"];
  if (organizerType === "independent_host") return ["type", "identity", "contact"];
  return ["type", "identity", "contact", "entity", "brand"];
};
