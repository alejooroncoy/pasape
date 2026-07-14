import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  // getDb() solo intenta abrir la conexión si `indexedDB` existe en el global.
  (globalThis as { indexedDB?: unknown }).indexedDB = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("query-persister — IndexedDB no disponible (WebKit UnknownError)", () => {
  beforeEach(() => {
    // Simula el bug de WebKit: openDB() rechaza con el DOMException real que
    // PostHog capturó en producción (issue 019f4e68-2423-76c3-9163-2a9a3ddfa3c2).
    vi.doMock("idb", () => ({
      openDB: vi.fn(() =>
        Promise.reject(
          new DOMException(
            "An internal error was encountered in the Indexed Database server",
            "UnknownError",
          ),
        ),
      ),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
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

  it("clearPersistedQueryCache() no propaga el rechazo de openDB y fuerza deleteDB", async () => {
    const { clearPersistedQueryCache } = await import("./query-persister");
    const idb = await import("idb");
    await expect(clearPersistedQueryCache()).resolves.toBeUndefined();
    expect(idb.deleteDB).toHaveBeenCalledWith("pasape-rq");
  });
});

describe("query-persister — la conexión abre pero la operación falla (QuotaExceededError, etc.)", () => {
  const makeFakeDb = (overrides: Record<string, unknown> = {}) => ({
    close: vi.fn(),
    put: vi.fn().mockRejectedValue(new Error("boom")),
    get: vi.fn().mockRejectedValue(new Error("boom")),
    delete: vi.fn().mockRejectedValue(new Error("boom")),
    ...overrides,
  });

  it("persistClient() no propaga si db.put() rechaza, y cierra la conexión", async () => {
    const fakeDb = makeFakeDb();
    vi.doMock("idb", () => ({
      openDB: vi.fn(() => Promise.resolve(fakeDb)),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
    const { createIdbPersister } = await import("./query-persister");
    await expect(
      createIdbPersister().persistClient({
        timestamp: 0,
        buster: "",
        clientState: { mutations: [], queries: [] },
      }),
    ).resolves.toBeUndefined();
    expect(fakeDb.close).toHaveBeenCalled();
  });

  it("restoreClient() devuelve undefined si db.get() rechaza, y cierra la conexión", async () => {
    const fakeDb = makeFakeDb();
    vi.doMock("idb", () => ({
      openDB: vi.fn(() => Promise.resolve(fakeDb)),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
    const { createIdbPersister } = await import("./query-persister");
    await expect(createIdbPersister().restoreClient()).resolves.toBeUndefined();
    expect(fakeDb.close).toHaveBeenCalled();
  });

  it("removeClient() no propaga si db.delete() rechaza, y cierra la conexión", async () => {
    const fakeDb = makeFakeDb();
    vi.doMock("idb", () => ({
      openDB: vi.fn(() => Promise.resolve(fakeDb)),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
    const { createIdbPersister } = await import("./query-persister");
    await expect(createIdbPersister().removeClient()).resolves.toBeUndefined();
    expect(fakeDb.close).toHaveBeenCalled();
  });

  it("clearPersistedQueryCache() fuerza deleteDB si db.delete() rechaza (logout en device compartido)", async () => {
    const fakeDb = makeFakeDb();
    vi.doMock("idb", () => ({
      openDB: vi.fn(() => Promise.resolve(fakeDb)),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
    const { clearPersistedQueryCache } = await import("./query-persister");
    const idb = await import("idb");
    await expect(clearPersistedQueryCache()).resolves.toBeUndefined();
    expect(fakeDb.close).toHaveBeenCalled();
    expect(idb.deleteDB).toHaveBeenCalledWith("pasape-rq");
  });
});

describe("query-persister — happy path", () => {
  const makeFakeDb = () => ({
    close: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ timestamp: 1, buster: "b", clientState: { mutations: [], queries: [] } }),
    delete: vi.fn().mockResolvedValue(undefined),
  });

  it("persistClient() escribe en el store y restoreClient() lee lo persistido", async () => {
    const fakeDb = makeFakeDb();
    vi.doMock("idb", () => ({
      openDB: vi.fn(() => Promise.resolve(fakeDb)),
      deleteDB: vi.fn(() => Promise.resolve()),
    }));
    const { createIdbPersister } = await import("./query-persister");
    const persister = createIdbPersister();
    const client = { timestamp: 1, buster: "b", clientState: { mutations: [], queries: [] } };

    await persister.persistClient(client);
    expect(fakeDb.put).toHaveBeenCalledWith("cache", client, "client");

    const restored = await persister.restoreClient();
    expect(fakeDb.get).toHaveBeenCalledWith("cache", "client");
    expect(restored).toEqual(client);
  });
});
