import { describe, it, expect } from "vitest";
import { DEFAULT_MAX_TICKETS_PER_PERSON, effectiveMaxPerPerson } from "./purchaseCaps";

describe("purchaseCaps", () => {
  describe("effectiveMaxPerPerson (NO opt-in)", () => {
    it("usa el default cuando el organizador no configuró tope", () => {
      expect(effectiveMaxPerPerson(null)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
      expect(effectiveMaxPerPerson(undefined)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
    });

    it("respeta el tope configurado por el organizador", () => {
      expect(effectiveMaxPerPerson(4)).toBe(4);
      expect(effectiveMaxPerPerson(20)).toBe(20);
    });

    it("cae al default ante un valor no positivo (nunca deja la compra sin techo)", () => {
      expect(effectiveMaxPerPerson(0)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
      expect(effectiveMaxPerPerson(-3)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
    });
  });
});
