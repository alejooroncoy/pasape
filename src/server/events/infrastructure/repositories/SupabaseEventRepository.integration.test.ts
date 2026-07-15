import { describe, expect, it } from "vitest";

// Integración de los listados públicos (home/categorías/búsqueda + sitemap/llms)
// contra el Supabase de dev. Sin mocks: ejercita el select real y el mapper
// row→dominio. No crea/borra data — solo lee lo que ya existe en dev.
//
// Motivo de este test: /review (specialists de Testing y Maintainability, PR
// #131) marcó que listPublished/listPublishedForSeo no tenían ninguna
// cobertura — ni el shape de columnas devuelto, ni los filtros, ni el orden.
// El riesgo real: EVENT_CARD_COLUMNS/EVENT_SEO_COLUMNS y los tipos EventCard/
// EventSeoEntry se sincronizan a través de un solo mapa (projectedEventMapper,
// ver SupabaseEventRepository.ts), pero solo un test contra Supabase real
// demuestra que las columnas efectivamente existen y el mapper las traduce
// bien — un `satisfies` en TS no puede detectar un typo en el string de SQL.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const { supabaseEventRepository: repo } = await import("./SupabaseEventRepository");

const EVENT_CARD_KEYS = ["id", "slug", "title", "coverUrl", "venue", "startsAt", "timezone", "category"].sort();
const EVENT_SEO_KEYS = [
  "slug",
  "title",
  "description",
  "venue",
  "startsAt",
  "timezone",
  "status",
  "category",
  "createdAt",
].sort();

describe.skipIf(!hasCreds)("SupabaseEventRepository — listados públicos (integración)", () => {
  it("listPublished: solo trae las columnas de EventCard, sin campos del detalle", async () => {
    const events = await repo.listPublished(500, null, null, null);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(Object.keys(ev).sort()).toEqual(EVENT_CARD_KEYS);
    }
  });

  it("listPublished: solo devuelve eventos con status published", async () => {
    // No hay columna `status` en EventCard (a propósito — ver AGENTS.md:
    // el frontend no decide status), así que la única forma de probar el
    // filtro es cruzar contra una query directa a la tabla.
    const events = await repo.listPublished(500, null, null, null);
    const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");
    const db = supabaseAdmin();
    const { data: nonPublished } = await db
      .from("events")
      .select("slug")
      .neq("status", "published")
      .limit(500);
    const nonPublishedSlugs = new Set((nonPublished ?? []).map((e) => e.slug));
    for (const ev of events) {
      expect(nonPublishedSlugs.has(ev.slug)).toBe(false);
    }
  });

  it("listPublished: ordena por startsAt ascendente", async () => {
    const events = await repo.listPublished(500, null, null, null);
    const times = events.map((e) => new Date(e.startsAt).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("listPublished: el filtro de category excluye eventos de otras categorías", async () => {
    const all = await repo.listPublished(500, null, null, null);
    const withCategory = all.find((e) => e.category != null);
    if (!withCategory) return; // dev sin eventos categorizados: no hay nada que probar
    const matching = await repo.listPublished(500, null, withCategory.category, null);
    expect(matching.some((e) => e.id === withCategory.id)).toBe(true);
    expect(matching.every((e) => e.category === withCategory.category)).toBe(true);
  });

  it("listPublished: la búsqueda encuentra por título y no devuelve basura para un término sin match", async () => {
    const all = await repo.listPublished(500, null, null, null);
    if (all.length === 0) return;
    const target = all[0];
    const term = target.title.slice(0, Math.min(5, target.title.length));
    const found = await repo.listPublished(500, null, null, term);
    expect(found.some((e) => e.id === target.id)).toBe(true);

    const nothing = await repo.listPublished(500, null, null, "zzzz_no_deberia_matchear_nunca_zzzz");
    expect(nothing).toEqual([]);
  });

  it("listPublishedForSeo: trae los campos extra (status/description/createdAt) que EventCard no tiene", async () => {
    const events = await repo.listPublishedForSeo(500);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(Object.keys(ev).sort()).toEqual(EVENT_SEO_KEYS);
      expect(ev.status).toBe("published");
    }
  });
});
