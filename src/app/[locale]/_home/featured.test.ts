import { describe, expect, it } from "vitest";
import type { EventCard } from "@/server/events/domain/Event";
import { splitFeatured } from "./featured";

const list = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}` }) as EventCard);

const ids = (arr: EventCard[]) => arr.map((e) => e.id);

describe("splitFeatured", () => {
  it("no destaca nada cuando hay un solo evento: el banner sería un eco de la grilla", () => {
    const { featured, rest } = splitFeatured(list(1));
    expect(ids(featured)).toEqual([]);
    expect(ids(rest)).toEqual(["e0"]);
  });

  it("con catálogo chico destaca uno y deja el resto a la grilla", () => {
    expect(ids(splitFeatured(list(2)).featured)).toEqual(["e0"]);
    expect(ids(splitFeatured(list(2)).rest)).toEqual(["e1"]);
    expect(ids(splitFeatured(list(3)).featured)).toEqual(["e0"]);
    expect(ids(splitFeatured(list(3)).rest)).toEqual(["e1", "e2"]);
  });

  it("con catálogo grande rota tres y la grilla sigue desde el cuarto", () => {
    const { featured, rest } = splitFeatured(list(6));
    expect(ids(featured)).toEqual(["e0", "e1", "e2"]);
    expect(ids(rest)).toEqual(["e3", "e4", "e5"]);
  });

  it("nunca muestra el mismo evento en el banner y en la grilla", () => {
    for (const n of [0, 1, 2, 3, 4, 9, 40]) {
      const { featured, rest } = splitFeatured(list(n));
      expect(featured.length + rest.length).toBe(n);
      expect(ids(featured).filter((id) => ids(rest).includes(id))).toEqual([]);
    }
  });

  it("no deja la grilla vacía mientras haya algo que mostrar", () => {
    for (const n of [1, 2, 3, 4, 10]) {
      expect(splitFeatured(list(n)).rest.length).toBeGreaterThan(0);
    }
  });
});
