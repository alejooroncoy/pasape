import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_UNLOCK_EVENT, isPanelFeatureUnlocked, unlockPanelFeature } from "./panelUnlocks";

// Igual que composerModePreference.test.ts: simula `window` (localStorage +
// dispatchEvent) porque vitest corre en entorno "node" sin jsdom.
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

describe("isPanelFeatureUnlocked / unlockPanelFeature", () => {
  let dispatchEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatchEvent = vi.fn();
    (globalThis as { window?: unknown }).window = {
      localStorage: makeFakeLocalStorage(),
      dispatchEvent,
    };
    (globalThis as { CustomEvent?: unknown }).CustomEvent = class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
  });

  it("sin desbloquear, isPanelFeatureUnlocked es false", () => {
    expect(isPanelFeatureUnlocked("promoters")).toBe(false);
  });

  it("unlockPanelFeature persiste el desbloqueo en localStorage", () => {
    unlockPanelFeature("promoters");
    expect(isPanelFeatureUnlocked("promoters")).toBe(true);
  });

  it("unlockPanelFeature dispara PANEL_UNLOCK_EVENT con el key en detail", () => {
    unlockPanelFeature("promoters");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0] as { type: string; detail: unknown };
    expect(event.type).toBe(PANEL_UNLOCK_EVENT);
    expect(event.detail).toBe("promoters");
  });
});

describe("sin `window` (SSR)", () => {
  it("isPanelFeatureUnlocked devuelve false sin lanzar", () => {
    expect(isPanelFeatureUnlocked("promoters")).toBe(false);
  });

  it("unlockPanelFeature no lanza (noop)", () => {
    expect(() => unlockPanelFeature("promoters")).not.toThrow();
  });
});
