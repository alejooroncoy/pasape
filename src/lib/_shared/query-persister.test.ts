import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Simula el bug de WebKit: openDB() rechaza con el DOMException real que
// PostHog capturó en producción (issue 019f4e68-2423-76c3-9163-2a9a3ddfa3c2).
vi.mock("idb", () => ({
  openDB: vi.fn(() =>
    Promise.reject(
      new DOMException(
        "An internal error was encountered in the Indexed Database server",
        "UnknownError",
      ),
    ),
  ),
}));

describe("query-persister — IndexedDB no disponible (WebKit UnknownError)", () => {
  beforeEach(() => {
    // getDb() solo intenta abrir la conexión si `indexedDB` existe en el global.
    (globalThis as { indexedDB?: unknown }).indexedDB = {};
  });

  afterEach(() => {
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
    vi.resetModules();
  });

  it("restoreClient() no propaga el rechazo de openDB", async () => {
    const { createIdbPersister } = await import("./query-persister");
    await expect(createIdbPersister().restoreClient()).resolves.toBeUndefined();
  });

  it("persistClient() no propaga el rechazo de openDB", async () => {
    const { createIdbPersister } = await import("./query-persister");
    await expect(
      createIdbPersister().persistClient({
        timestamp: 0,
        buster: "",
        clientState: { mutations: [], queries: [] },
      }),
    ).resolves.toBeUndefined();
  });

  it("removeClient() no propaga el rechazo de openDB", async () => {
    const { createIdbPersister } = await import("./query-persister");
    await expect(createIdbPersister().removeClient()).resolves.toBeUndefined();
  });

  it("clearPersistedQueryCache() no propaga el rechazo de openDB", async () => {
    const { clearPersistedQueryCache } = await import("./query-persister");
    await expect(clearPersistedQueryCache()).resolves.toBeUndefined();
  });
});
