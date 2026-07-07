import { afterAll, describe, expect, it, vi } from "vitest";

// Integración del onboarding del portero por CÓDIGO (sin cuenta) contra el
// Supabase remoto. Ejercita joinByCode (emite token) y verifyScanAccess (valida
// por token), sin login. Se auto-salta sin credenciales. Limpia lo que crea.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const EVENT = { id: "d994149d-39d9-45e7-b10e-0251d0fb3e56", slug: "reverb-x-la-selva-kx39" };
const DEVICE = "vitest-portero-device-001";

// Headers mutables: por defecto vacíos (camino organizador). Los tests que
// ejercitan al portero por código inyectan aquí el header x-door-token.
let currentHeaders = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => currentHeaders),
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => {} })),
}));

// Sin token, verifyScanAccess cae al camino organizador (cookie). Lo dejamos en
// "no autenticado" para que ese caso dé unauthorized sin tocar red.
vi.mock("@/server/_shared/AuthContext", () => ({
  getAuthContext: vi.fn(async () => ({ ok: false, error: "unauthenticated" })),
}));

const { generateDoorLink } = await import(
  "@/server/events/application/GenerateDoorLink"
);
const { joinByCode } = await import("./JoinByCode");
const { verifyScanAccess } = await import("./VerifyScanAccess");
const { EventsController } = await import(
  "@/server/events/controllers/rest/EventsController"
);
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

afterAll(async () => {
  currentHeaders = new Map();
  if (!hasCreds) return;
  const db = supabaseAdmin();
  await db.from("scanner_sessions").delete().eq("device_id", DEVICE);
  await db.from("event_access_codes").delete().eq("event_id", EVENT.id);
});

describe.skipIf(!hasCreds)("onboarding del portero por código (integración)", () => {
  it("canjea el código sin cuenta → devuelve token y crea la sesión", async () => {
    const link = await generateDoorLink(EVENT, "https://pasape.lat");

    const res = await joinByCode({
      code: link.code,
      deviceId: DEVICE,
      fullName: "Portero de Prueba",
      dni: "73172442",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.token).toBeTruthy();
    expect(res.value.eventSlug).toBe(EVENT.slug);

    const db = supabaseAdmin();
    const { data } = await db
      .from("scanner_sessions")
      .select("profile_id, token, device_id, holder_name, revoked")
      .eq("device_id", DEVICE)
      .maybeSingle();
    expect(data).toMatchObject({
      profile_id: null, // portero por código: sin cuenta
      device_id: DEVICE,
      holder_name: "Portero de Prueba",
      revoked: false,
    });
    expect(data?.token).toBe(res.value.token);
  });

  it("re-canjear en el mismo device reusa el mismo token (idempotente)", async () => {
    const link = await generateDoorLink(EVENT, "https://pasape.lat");
    const a = await joinByCode({ code: link.code, deviceId: DEVICE });
    const b = await joinByCode({ code: link.code, deviceId: DEVICE });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.token).toBe(a.value.token);
  });

  it("rechaza un código inexistente", async () => {
    const res = await joinByCode({ code: "ZZZZZZ", deviceId: DEVICE });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_code");
  });

  it("con el token, verifyScanAccess deja escanear vía 'session'", async () => {
    const link = await generateDoorLink(EVENT, "https://pasape.lat");
    const joined = await joinByCode({ code: link.code, deviceId: DEVICE });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const access = await verifyScanAccess(EVENT.slug, {
      doorToken: joined.value.token,
      deviceId: DEVICE,
    });
    expect(access.ok).toBe(true);
    if (!access.ok) return;
    expect(access.value.via).toBe("session");
    expect(access.value.profileId).toBeNull();
    expect(access.value.sessionId).toBeTruthy();
    expect(access.value.eventId).toBe(EVENT.id);
  });

  it("rechaza un token inválido", async () => {
    const access = await verifyScanAccess(EVENT.slug, { doorToken: "token-falso-xyz" });
    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.error).toBe("forbidden");
  });

  it("el portero por código descarga scan-cache, signing-key y stats vía token", async () => {
    const link = await generateDoorLink(EVENT, "https://pasape.lat");
    const joined = await joinByCode({ code: link.code, deviceId: DEVICE });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    // El controller lee el token y el device del header (no de opts): los
    // inyectamos. Sin x-scanner-device, verifyScanAccess rechaza por device
    // binding (LOW-7) aunque el token sea válido.
    currentHeaders = new Map([
      ["x-door-token", joined.value.token],
      ["x-scanner-device", DEVICE],
    ]);

    const cache = await EventsController.getScanCache(EVENT.slug);
    expect(cache.ok).toBe(true);
    if (cache.ok) expect(cache.value.eventId).toBe(EVENT.id);

    const key = await EventsController.getEventSigningKey(EVENT.slug);
    expect(key.ok).toBe(true);
    if (key.ok) expect(key.value.publicKey).toBeTruthy();

    const stats = await EventsController.stats(EVENT.slug);
    expect(stats.ok).toBe(true);

    currentHeaders = new Map();
  }, 20_000);

  it("sin token ni membership, scan-cache queda bloqueado", async () => {
    currentHeaders = new Map();
    const cache = await EventsController.getScanCache(EVENT.slug);
    expect(cache.ok).toBe(false);
  });
});
