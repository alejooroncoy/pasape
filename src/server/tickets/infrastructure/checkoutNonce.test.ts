import { describe, it, expect, vi, beforeEach } from "vitest";

// Simula Redis SET NX atómico para probar single-use bajo contención paralela.
const store = vi.hoisted(() => new Map<string, string>());

vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
});

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      set: async (key: string, _val: unknown, opts?: { nx?: boolean }) => {
        if (opts?.nx && store.has(key)) return null;
        store.set(key, "1");
        return "OK";
      },
      exists: async (key: string) => (store.has(key) ? 1 : 0),
      incr: async (key: string) => {
        const n = (Number(store.get(key)) || 0) + 1;
        store.set(key, String(n));
        return n;
      },
      expire: async () => 1,
    }),
  },
}));

import { consumeCheckoutToken, peekCheckoutToken } from "./checkoutNonce";

beforeEach(() => {
  store.clear();
});

describe("checkoutNonce — single-use bajo contención", () => {
  it("solo un consume paralelo gana fresh; los demás son replay", async () => {
    const token = "tok-concurrent-1";
    const outcomes = await Promise.all([
      consumeCheckoutToken(token),
      consumeCheckoutToken(token),
      consumeCheckoutToken(token),
    ]);
    expect(outcomes.filter((o) => o === "fresh")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "replay")).toHaveLength(2);
  });

  it("peek ve replay después de quemar el token", async () => {
    const token = "tok-peek-after-consume";
    expect(await peekCheckoutToken(token)).toBe("fresh");
    expect(await consumeCheckoutToken(token)).toBe("fresh");
    expect(await peekCheckoutToken(token)).toBe("replay");
    expect(await consumeCheckoutToken(token)).toBe("replay");
  });

  it("peek no quema: dos peeks seguidos siguen fresh hasta el consume", async () => {
    const token = "tok-peek-nondestructive";
    expect(await peekCheckoutToken(token)).toBe("fresh");
    expect(await peekCheckoutToken(token)).toBe("fresh");
    expect(await consumeCheckoutToken(token)).toBe("fresh");
    expect(await peekCheckoutToken(token)).toBe("replay");
  });
});
