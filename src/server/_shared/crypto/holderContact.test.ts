import { describe, it, expect } from "vitest";
import {
  encryptHolderEmail,
  encryptHolderPhone,
  decryptHolderEmail,
  decryptHolderPhone,
  resolveHolderEmail,
  resolveHolderPhone,
  normalizeHolderEmail,
  normalizeHolderPhone,
} from "./holderContact";

const hasKey = !!process.env.DNI_ENC_KEY;

describe.skipIf(!hasKey)("cifrado holder email/phone", () => {
  it("email: ida y vuelta + normaliza mayúsculas", () => {
    const enc = encryptHolderEmail("  Ana@Mail.COM ");
    expect(enc).toBeTruthy();
    expect(decryptHolderEmail(enc)).toBe("ana@mail.com");
    expect(normalizeHolderEmail("Ana@Mail.COM")).toBe("ana@mail.com");
  });

  it("phone: ida y vuelta + solo dígitos", () => {
    const enc = encryptHolderPhone("+51 999 888 777");
    expect(decryptHolderPhone(enc)).toBe("51999888777");
    expect(normalizeHolderPhone("+51 999-888-777")).toBe("51999888777");
  });

  it("resolve dual-read: enc gana sobre legacy", () => {
    const enc = encryptHolderEmail("nuevo@pasape.lat");
    expect(
      resolveHolderEmail({ holder_email: "viejo@pasape.lat", holder_email_enc: enc }),
    ).toBe("nuevo@pasape.lat");
    expect(resolveHolderEmail({ holder_email: "solo@legacy.lat", holder_email_enc: null })).toBe(
      "solo@legacy.lat",
    );
  });

  it("resolve phone dual-read", () => {
    const enc = encryptHolderPhone("51999111222");
    expect(
      resolveHolderPhone({ holder_phone: "51999888777", holder_phone_enc: enc }),
    ).toBe("51999111222");
  });

  it("vacío → null", () => {
    expect(encryptHolderEmail("")).toBeNull();
    expect(encryptHolderPhone(null)).toBeNull();
  });
});
