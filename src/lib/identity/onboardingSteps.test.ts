import { describe, expect, it } from "vitest";
import { computeOnboardingSteps } from "./onboardingSteps";

// Regresión (plan-eng-review 2026-07-12): acortar el onboarding para
// independent_host NO debe tocar el recorrido de production_company/venue_owner
// — ambos siguen viendo los 5 pasos completos, sin cambio.
describe("computeOnboardingSteps", () => {
  it("buyer (sin intent de organizador) solo ve identity + contact", () => {
    expect(computeOnboardingSteps(false, null)).toEqual(["identity", "contact"]);
  });

  it("independent_host salta entity/brand", () => {
    expect(computeOnboardingSteps(true, "independent_host")).toEqual([
      "type",
      "identity",
      "contact",
    ]);
  });

  it("production_company ve los 5 pasos completos (regresión)", () => {
    expect(computeOnboardingSteps(true, "production_company")).toEqual([
      "type",
      "identity",
      "contact",
      "entity",
      "brand",
    ]);
  });

  it("venue_owner ve los 5 pasos completos (regresión)", () => {
    expect(computeOnboardingSteps(true, "venue_owner")).toEqual([
      "type",
      "identity",
      "contact",
      "entity",
      "brand",
    ]);
  });

  it("organizerType null (aún no elegido) ve los 5 pasos por defecto", () => {
    expect(computeOnboardingSteps(true, null)).toEqual([
      "type",
      "identity",
      "contact",
      "entity",
      "brand",
    ]);
  });
});
