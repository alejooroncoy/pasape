import { describe, expect, it } from "vitest";
import { isTicketTypeAllowedInPolicy, type ZoneScanPolicy } from "./ZonePolicy";

describe("isTicketTypeAllowedInPolicy", () => {
  it("permite todo cuando enforce es false", () => {
    const policy: ZoneScanPolicy = { enforce: false, allowedTicketTypeIds: ["a"] };
    expect(isTicketTypeAllowedInPolicy("b", policy)).toBe(true);
  });

  it("rechaza tipos fuera de la puerta cuando enforce es true", () => {
    const policy: ZoneScanPolicy = { enforce: true, allowedTicketTypeIds: ["vip-id"] };
    expect(isTicketTypeAllowedInPolicy("general-id", policy)).toBe(false);
    expect(isTicketTypeAllowedInPolicy("vip-id", policy)).toBe(true);
  });
});
