import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedLoadTest } from "./LoadTestMode";

const EVENT = "8ebe021c-9d9a-424b-ba8a-11e0c08db8ad";
const originalEnv = {
  enabled: process.env.LOAD_TEST_ENABLED,
  secret: process.env.LOAD_TEST_SECRET,
  events: process.env.LOAD_TEST_EVENT_IDS,
};

const request = (secret?: string) =>
  new NextRequest("https://pasape.lat/api/tickets/buy", {
    headers: secret ? { "x-pasape-load-test": secret } : {},
  });

afterEach(() => {
  process.env.LOAD_TEST_ENABLED = originalEnv.enabled;
  process.env.LOAD_TEST_SECRET = originalEnv.secret;
  process.env.LOAD_TEST_EVENT_IDS = originalEnv.events;
});

describe("isAuthorizedLoadTest", () => {
  it("permanece apagado por defecto", () => {
    delete process.env.LOAD_TEST_ENABLED;
    process.env.LOAD_TEST_SECRET = "test-secret";
    process.env.LOAD_TEST_EVENT_IDS = EVENT;

    expect(isAuthorizedLoadTest(request("test-secret"), EVENT)).toBe(false);
  });

  it("exige el secreto correcto y el evento incluido explícitamente", () => {
    process.env.LOAD_TEST_ENABLED = "true";
    process.env.LOAD_TEST_SECRET = "test-secret";
    process.env.LOAD_TEST_EVENT_IDS = EVENT;

    expect(isAuthorizedLoadTest(request(), EVENT)).toBe(false);
    expect(isAuthorizedLoadTest(request("otro-secreto"), EVENT)).toBe(false);
    expect(isAuthorizedLoadTest(request("test-secret"), "00000000-0000-4000-8000-000000000000")).toBe(false);
    expect(isAuthorizedLoadTest(request("test-secret"), EVENT)).toBe(true);
  });
});
