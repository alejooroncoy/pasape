import { describe, expect, it } from "vitest";
import {
  sanitizeDocument,
  sanitizeEmail,
  sanitizeGuestContact,
  sanitizePersonName,
  sanitizePromoCode,
} from "./sanitize";

describe("sanitizePersonName", () => {
  it("quita tags y colapsa espacios", () => {
    expect(sanitizePersonName("  Juan <script>Pérez  ")).toBe("Juan scriptPérez");
    expect(sanitizePersonName("María-José O'Connor")).toBe("María-José O'Connor");
  });
});

describe("sanitizeDocument", () => {
  it("DNI peruano solo dígitos", () => {
    expect(sanitizeDocument("71-234.567x", false)).toBe("71234567");
  });

  it("extranjero alfanumérico", () => {
    expect(sanitizeDocument("ab-12 34", true)).toBe("AB1234");
  });
});

describe("sanitizeEmail", () => {
  it("normaliza", () => {
    expect(sanitizeEmail("  Juan@Mail.COM  ")).toBe("juan@mail.com");
  });
});

describe("sanitizePromoCode", () => {
  it("solo código seguro", () => {
    expect(sanitizePromoCode(" promo<script>-1 ")).toBe("PROMOSCRIPT-1");
  });
});

describe("sanitizeGuestContact", () => {
  it("sanitiza todos los campos", () => {
    expect(
      sanitizeGuestContact({
        fullName: " Ana <b>López</b> ",
        dni: "71234567",
        phone: "+51 999 888 777",
        email: " Ana@Test.com ",
        isForeigner: false,
      }),
    ).toEqual({
      fullName: "Ana bLópezb",
      dni: "71234567",
      phone: "+51999888777",
      email: "ana@test.com",
      isForeigner: false,
    });
  });
});
