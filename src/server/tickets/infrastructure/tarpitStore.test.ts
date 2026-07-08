import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockeamos el cliente Redis compartido para probar el contrato de arm/read del
// tarpit diferido sin una instancia real. `getRedis` puede devolver null (dev
// sin Upstash) → todo debe degradar fail-open a 0 / no-op.
const store = new Map<string, { value: number; ex?: number }>();
const redisMock = {
  set: vi.fn(async (k: string, v: number, opts?: { ex?: number }) => {
    store.set(k, { value: v, ex: opts?.ex });
    return "OK";
  }),
  get: vi.fn(async (k: string) => store.get(k)?.value ?? null),
};

let redisOrNull: typeof redisMock | null = redisMock;
vi.mock("@/server/_shared/redis", () => ({
  getRedis: () => redisOrNull,
}));

import { armTarpit, pendingTarpitMs } from "./tarpitStore";

beforeEach(() => {
  store.clear();
  redisMock.set.mockClear();
  redisMock.get.mockClear();
  redisOrNull = redisMock;
});

describe("tarpitStore — tarpit diferido", () => {
  it("arma el peaje para device e IP y lo lee de vuelta (máximo de ambos)", async () => {
    await armTarpit("dev123", "1.2.3.4", 2_000);
    expect(store.has("tarpit:dev:dev123")).toBe(true);
    expect(store.has("tarpit:ip:1.2.3.4")).toBe(true);
    expect(await pendingTarpitMs("dev123", "1.2.3.4")).toBe(2_000);
  });

  it("no lee lo que no se armó (0 pendiente)", async () => {
    expect(await pendingTarpitMs("otro", "9.9.9.9")).toBe(0);
  });

  it("clampa el delay al techo de 8s al armar", async () => {
    await armTarpit("devX", null, 99_999);
    expect(await pendingTarpitMs("devX", null)).toBe(8_000);
  });

  it("no arma nada con delay <= 0", async () => {
    await armTarpit("devY", "5.5.5.5", 0);
    expect(redisMock.set).not.toHaveBeenCalled();
    expect(await pendingTarpitMs("devY", "5.5.5.5")).toBe(0);
  });

  it("setea un TTL corto (duración del delay + margen)", async () => {
    await armTarpit("devTTL", null, 2_000);
    expect(store.get("tarpit:dev:devTTL")?.ex).toBe(2 + 3);
  });

  it("fail-open: sin Redis no arma ni lee (0)", async () => {
    redisOrNull = null;
    await armTarpit("devZ", "7.7.7.7", 5_000);
    expect(redisMock.set).not.toHaveBeenCalled();
    expect(await pendingTarpitMs("devZ", "7.7.7.7")).toBe(0);
  });

  it("fail-open: si Redis lanza al leer, devuelve 0", async () => {
    redisMock.get.mockRejectedValueOnce(new Error("boom"));
    await armTarpit("devErr", null, 1_000);
    expect(await pendingTarpitMs("devErr", null)).toBe(0);
  });
});
