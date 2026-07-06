import crypto from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

// `import "server-only"` solo resuelve dentro del bundler de Next (alias a
// node_modules/next/dist/compiled/server-only); en vitest (resolución Node
// pura) el specifier "server-only" no existe como paquete instalado. Lo
// mockeamos como no-op SOLO para poder importar el módulo bajo test — no
// afecta el comportamiento que estamos probando.
vi.mock("server-only", () => ({}));

// Integración del webhook de Mercado Pago contra el Supabase remoto (sin
// mocks de red: no llamamos a MP, ejercitamos las rutas que retornan antes de
// tocar la API real — firma inválida y dedupe, que son las que hoy no tienen
// ninguna cobertura). Se auto-salta sin credenciales.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const hasWebhookSecret = !!process.env.MP_WEBHOOK_SECRET;

const { handleMpWebhook } = await import("./HandleWebhook");
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

// dataId falso: no corresponde a ningún pago real en MP. Esto es intencional:
// el camino de dedupe corta ANTES de llamar a la API de MP (el insert en
// mp_webhook_events falla por PK duplicada y retorna ok({}) de inmediato), así
// que podemos probar la idempotencia sin depender de un pago real en sandbox.
const DATA_ID = `vitest-fake-${Date.now()}`;
const REQUEST_ID = "vitest-request-id-001";

const signManifest = (params: {
  dataId: string;
  requestId: string;
  secret: string;
  ts?: string;
}): { header: string; ts: string } => {
  const ts = params.ts ?? String(Math.floor(Date.now() / 1000));
  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", params.secret).update(manifest).digest("hex");
  return { header: `ts=${ts},v1=${v1}`, ts };
};

const rawBodyFor = (dataId: string): string =>
  JSON.stringify({ type: "payment", data: { id: dataId } });

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  await db
    .from("mp_webhook_events")
    .delete()
    .eq("mp_id", `payment-${DATA_ID}`);
});

describe.skipIf(!hasCreds)("webhook de Mercado Pago (integración)", () => {
  it.skipIf(!hasWebhookSecret)(
    "rechaza una firma HMAC inválida",
    async () => {
      const res = await handleMpWebhook({
        rawBody: rawBodyFor(DATA_ID),
        query: new URLSearchParams(),
        headers: {
          signature: "ts=1700000000,v1=firma-invalida-a-proposito",
          requestId: REQUEST_ID,
        },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("invalid_signature");
    },
  );

  it.skipIf(!hasWebhookSecret)(
    "el mismo webhook (mismo data.id) no se procesa dos veces",
    async () => {
      const secret = process.env.MP_WEBHOOK_SECRET!;
      const { header } = signManifest({ dataId: DATA_ID, requestId: REQUEST_ID, secret });

      // Primera entrega: pasa la firma, entra a la sección de dedupe (inserta
      // la fila), y falla al buscar el pago en MP porque el data.id es falso.
      // Ese fallo es esperado y no afecta lo que estamos probando: que la
      // fila de dedupe ya quedó insertada.
      const first = await handleMpWebhook({
        rawBody: rawBodyFor(DATA_ID),
        query: new URLSearchParams(),
        headers: { signature: header, requestId: REQUEST_ID },
      });
      expect(first.ok).toBe(false);
      if (!first.ok) expect(first.error).toMatch(/^mp_payment_fetch_failed/);

      const db = supabaseAdmin();
      const dedupeKey = `payment-${DATA_ID}`;
      const { data: rows } = await db
        .from("mp_webhook_events")
        .select("mp_id")
        .eq("mp_id", dedupeKey);
      expect(rows).toHaveLength(1);

      // Segunda entrega: mismo data.id (aunque cambie request-id) → dedupe por payment id.
      const second = await handleMpWebhook({
        rawBody: rawBodyFor(DATA_ID),
        query: new URLSearchParams(),
        headers: { signature: header, requestId: "vitest-request-id-002" },
      });
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.value).toEqual({});

      // Sigue habiendo una sola fila de dedupe: no se duplicó el procesamiento.
      const { data: rowsAfter } = await db
        .from("mp_webhook_events")
        .select("mp_id")
        .eq("mp_id", dedupeKey);
      expect(rowsAfter).toHaveLength(1);
    },
    15_000, // la primera entrega hace un fetch real a la API de MP (timeout 5s del cliente)
  );

  it("payload sin type/data.id se ignora silenciosamente", async () => {
    const res = await handleMpWebhook({
      rawBody: "{}",
      query: new URLSearchParams(),
      headers: { signature: null, requestId: null },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({});
  });
});
