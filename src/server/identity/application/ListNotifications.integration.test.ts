import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Integración de countUnreadNotifications/markNotificationsRead contra el
// Supabase real — cubre el conteo del dot de "Mis entradas" en el nav (antes
// hardcodeado a `dot: true`) y el flujo de marcarlo leído. Crea su propio
// profile + notification (aislado, se limpia solo) en vez de tocar data real.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const { countUnreadNotifications, markNotificationsRead } = await import("./ListNotifications");
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

const RUN = Date.now();
const profileIds: string[] = [];

const createProfile = async (tag: string): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.createUser({
    email: `vitest-notif-${tag}-${RUN}@example.com`,
    email_confirm: true,
    user_metadata: { full_name: `Vitest ${tag}` },
  });
  if (error || !data?.user) throw new Error(`fixture auth user failed: ${error?.message}`);
  profileIds.push(data.user.id);
  return data.user.id;
};

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  for (const id of profileIds) {
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe.skipIf(!hasCreds)("countUnreadNotifications / markNotificationsRead (integración)", () => {
  it("cuenta solo ticket_ready sin leer, e ignora otros kinds", async () => {
    const profileId = await createProfile("count");
    const db = supabaseAdmin();
    await db.from("notifications").insert([
      { profile_id: profileId, kind: "ticket_ready", payload: {} },
      { profile_id: profileId, kind: "ticket_ready", payload: {} },
      { profile_id: profileId, kind: "event_updated", payload: {} },
    ]);

    const before = await countUnreadNotifications(profileId, "ticket_ready");
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.value).toBe(2);
  }, 15_000);

  it("marca leídas y el conteo baja a cero (idempotente)", async () => {
    const profileId = await createProfile("markread");
    const db = supabaseAdmin();
    await db.from("notifications").insert([
      { profile_id: profileId, kind: "ticket_ready", payload: {} },
      { profile_id: profileId, kind: "ticket_ready", payload: {} },
    ]);

    const marked = await markNotificationsRead(profileId, "ticket_ready");
    expect(marked.ok).toBe(true);

    const after = await countUnreadNotifications(profileId, "ticket_ready");
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.value).toBe(0);

    // segunda pasada: no hay no-leídos, no debe fallar ni "revivir" nada
    const markedAgain = await markNotificationsRead(profileId, "ticket_ready");
    expect(markedAgain.ok).toBe(true);
    const stillZero = await countUnreadNotifications(profileId, "ticket_ready");
    if (stillZero.ok) expect(stillZero.value).toBe(0);
  }, 15_000);

  it("un perfil sin notificaciones nuevas cuenta 0 (caso feliz: sin dot)", async () => {
    const profileId = await createProfile("empty");
    const count = await countUnreadNotifications(profileId, "ticket_ready");
    expect(count.ok).toBe(true);
    if (count.ok) expect(count.value).toBe(0);
  }, 15_000);
});
