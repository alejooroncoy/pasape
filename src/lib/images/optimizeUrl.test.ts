import { describe, expect, it } from "vitest";
import { optimizeImageUrl } from "./optimizeUrl";

const SAMPLE =
  "https://liajgsczxhtrpahqemex.supabase.co/storage/v1/object/public/event-assets/events/demo/cover.png";

describe("optimizeImageUrl", () => {
  it("transforma URLs de Supabase a render/image webp", () => {
    expect(optimizeImageUrl(SAMPLE, "hero-lcp")).toBe(
      "https://liajgsczxhtrpahqemex.supabase.co/storage/v1/render/image/public/event-assets/events/demo/cover.png?width=512&quality=75&format=webp",
    );
  });

  it("deja pasar URLs que no son de Supabase", () => {
    expect(optimizeImageUrl("https://cdn.example.com/a.jpg", "card")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("retorna null para url vacía", () => {
    expect(optimizeImageUrl(null, "card")).toBeNull();
  });
});
