import { describe, expect, it } from "vitest";
import { openCheckoutSession, sealCheckoutSession } from "./checkoutSessionStorage";

describe("checkoutSessionStorage", () => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const payload = {
    guestDni: "12345678",
    guestEmail: "a@b.com",
    orderToken: "secret-token",
  };

  it("round-trip cifrado", async () => {
    const sealed = await sealCheckoutSession(orderId, payload);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("12345678");
    expect(await openCheckoutSession(orderId, sealed)).toEqual(payload);
  });

  it("no abre con otro orderId", async () => {
    const sealed = await sealCheckoutSession(orderId, payload);
    expect(await openCheckoutSession("22222222-2222-4222-8222-222222222222", sealed)).toBeNull();
  });

  it("lee JSON legacy sin prefijo", async () => {
    const legacy = JSON.stringify(payload);
    expect(await openCheckoutSession(orderId, legacy)).toEqual(payload);
  });
});
