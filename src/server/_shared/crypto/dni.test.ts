import { describe, it, expect } from "vitest";
import { encryptDni, decryptDni, dniLast4, normalizeDni } from "./dni";

const hasKey = !!process.env.DNI_ENC_KEY;

describe.skipIf(!hasKey)("cifrado de DNI", () => {
  it("ida y vuelta: descifra a lo cifrado (normalizado)", () => {
    const enc = encryptDni("73172442");
    expect(enc).toBeTruthy();
    expect(decryptDni(enc)).toBe("73172442");
  });

  it("normaliza: ignora guiones/espacios al cifrar", () => {
    const enc = encryptDni("7317-2442 ");
    expect(decryptDni(enc)).toBe("73172442");
  });

  it("no es determinístico: dos cifrados del mismo DNI difieren (IV random)", () => {
    expect(encryptDni("73172442")).not.toBe(encryptDni("73172442"));
  });

  it("vacío → null en ambos sentidos", () => {
    expect(encryptDni("")).toBeNull();
    expect(encryptDni(null)).toBeNull();
    expect(decryptDni(null)).toBeNull();
    expect(decryptDni("")).toBeNull();
  });

  it("dato corrupto → null (no lanza)", () => {
    expect(decryptDni("no-es-base64-valido!!")).toBeNull();
  });

  it("last4 / normalize", () => {
    expect(dniLast4("73172442")).toBe("2442");
    expect(dniLast4("12")).toBe("12");
    expect(dniLast4(null)).toBeNull();
    expect(normalizeDni("73-17 24.42")).toBe("73172442");
  });
});
