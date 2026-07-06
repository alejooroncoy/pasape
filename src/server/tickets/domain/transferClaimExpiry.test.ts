import { describe, expect, it } from "vitest";
import {
  isTransferClaimExpired,
  transferClaimExpiresAt,
  TRANSFER_CLAIM_TTL_MS,
} from "./transferClaimExpiry";

describe("transferClaimExpiresAt", () => {
  const now = new Date("2026-07-01T12:00:00.000Z").getTime();

  it("usa 7 días si el evento no tiene fin", () => {
    expect(transferClaimExpiresAt(null, now)).toBe(
      new Date(now + TRANSFER_CLAIM_TTL_MS).toISOString(),
    );
  });

  it("usa el fin del evento si es antes que 7 días", () => {
    const endsAt = "2026-07-03T04:00:00.000Z";
    expect(transferClaimExpiresAt(endsAt, now)).toBe(new Date(endsAt).toISOString());
  });

  it("usa 7 días si el evento termina después", () => {
    const endsAt = "2026-08-01T04:00:00.000Z";
    expect(transferClaimExpiresAt(endsAt, now)).toBe(
      new Date(now + TRANSFER_CLAIM_TTL_MS).toISOString(),
    );
  });
});

describe("isTransferClaimExpired", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");

  it("expira por expires_at del link", () => {
    expect(
      isTransferClaimExpired({
        expiresAt: "2026-07-04T00:00:00.000Z",
        eventEndsAt: "2026-07-10T00:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("expira si el evento ya terminó aunque el link siga vigente", () => {
    expect(
      isTransferClaimExpired({
        expiresAt: "2026-07-10T00:00:00.000Z",
        eventEndsAt: "2026-07-04T00:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });
});
