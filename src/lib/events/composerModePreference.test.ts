import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  composerModeHref,
  defaultComposerModeFor,
  getComposerModePreference,
  setComposerModePreference,
} from "./composerModePreference";

// El módulo hace `typeof window === "undefined"` para detectar SSR — bajo
// vitest (entorno "node", sin jsdom) `window` no existe por defecto, así que
// se simula un `window.localStorage` mínimo en memoria (mismo patrón que
// `globalThis.indexedDB` en query-persister.test.ts).
type FakeStorage = Storage;

const makeFakeLocalStorage = (): FakeStorage => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as FakeStorage;
};

describe("defaultComposerModeFor", () => {
  it("independent_host arranca en simple (quick-create)", () => {
    expect(defaultComposerModeFor("independent_host")).toBe("simple");
  });

  it("production_company/venue_owner/null arrancan en full", () => {
    expect(defaultComposerModeFor("production_company")).toBe("full");
    expect(defaultComposerModeFor("venue_owner")).toBe("full");
    expect(defaultComposerModeFor(null)).toBe("full");
  });
});

describe("getComposerModePreference / setComposerModePreference", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = {
      localStorage: makeFakeLocalStorage(),
    };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("sin preferencia guardada, cae al default por tipo", () => {
    expect(getComposerModePreference("independent_host")).toBe("simple");
    expect(getComposerModePreference("production_company")).toBe("full");
  });

  it("con preferencia guardada, gana sobre el default del tipo", () => {
    setComposerModePreference("full");
    expect(getComposerModePreference("independent_host")).toBe("full");
    setComposerModePreference("simple");
    expect(getComposerModePreference("production_company")).toBe("simple");
  });

  it("ignora un valor corrupto en localStorage y cae al default", () => {
    (globalThis as { window: { localStorage: FakeStorage } }).window.localStorage.setItem(
      "pasape:composer_mode",
      "not-a-mode",
    );
    expect(getComposerModePreference("independent_host")).toBe("simple");
  });

  it("localStorage inaccesible (Safari privado, etc.): cae al default sin lanzar", () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): FakeStorage {
        throw new Error("SecurityError");
      },
    };
    expect(getComposerModePreference("independent_host")).toBe("simple");
    expect(() => setComposerModePreference("full")).not.toThrow();
  });
});

describe("sin `window` (SSR)", () => {
  it("cae al default por tipo sin lanzar", () => {
    expect(getComposerModePreference("independent_host")).toBe("simple");
    expect(() => setComposerModePreference("full")).not.toThrow();
  });
});

describe("composerModeHref", () => {
  it("simple → quick-create, full → composer completo", () => {
    expect(composerModeHref("simple")).toBe("/org/events/quick-create");
    expect(composerModeHref("full")).toBe("/org/events/new");
  });
});
