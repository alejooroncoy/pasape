import { describe, expect, it } from "vitest";
import { ClaimCoordinator } from "./ClaimCoordinator";
import { InMemoryBus } from "./protocol";

const FAST = { claimTimeoutMs: 20 };

describe("ClaimCoordinator", () => {
  it("concede si nadie objeta (sin peers)", async () => {
    const bus = new InMemoryBus();
    const a = new ClaimCoordinator("a", bus.endpoint(), FAST);
    expect(await a.claim("t1")).toBe("granted");
    a.dispose();
  });

  it("niega si otra puerta ya hizo COMMIT del ticket", async () => {
    const bus = new InMemoryBus();
    const a = new ClaimCoordinator("a", bus.endpoint(), FAST);
    const b = new ClaimCoordinator("b", bus.endpoint(), FAST);
    expect(await a.claim("t1")).toBe("granted"); // A entra y emite COMMIT
    expect(await b.claim("t1")).toBe("denied"); // B llega tarde
    a.dispose();
    b.dispose();
  });

  it("dos puertas reclaman a la vez → exactamente una gana", async () => {
    const bus = new InMemoryBus();
    const a = new ClaimCoordinator("a", bus.endpoint(), FAST);
    const b = new ClaimCoordinator("b", bus.endpoint(), FAST);
    const [ra, rb] = await Promise.all([a.claim("t1"), b.claim("t1")]);
    const granted = [ra, rb].filter((r) => r === "granted").length;
    const denied = [ra, rb].filter((r) => r === "denied").length;
    expect(granted).toBe(1);
    expect(denied).toBe(1);
    a.dispose();
    b.dispose();
  });

  it("tickets distintos → ambas puertas conceden", async () => {
    const bus = new InMemoryBus();
    const a = new ClaimCoordinator("a", bus.endpoint(), FAST);
    const b = new ClaimCoordinator("b", bus.endpoint(), FAST);
    const [ra, rb] = await Promise.all([a.claim("t1"), b.claim("t2")]);
    expect(ra).toBe("granted");
    expect(rb).toBe("granted");
    a.dispose();
    b.dispose();
  });

  it("el mismo ticket no se puede reclamar dos veces en la misma puerta", async () => {
    const bus = new InMemoryBus();
    const a = new ClaimCoordinator("a", bus.endpoint(), FAST);
    expect(await a.claim("t1")).toBe("granted");
    expect(await a.claim("t1")).toBe("denied");
    a.dispose();
  });
});
