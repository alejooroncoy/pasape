import { describe, expect, it, beforeEach, vi } from "vitest";
import type { DoorMsg } from "./protocol";

// Mock del plugin nativo TCP: captura envíos/broadcasts y expone los callbacks
// para inyectar mensajes "recibidos" sin hardware.
const h = vi.hoisted(() => ({
  serverStarted: 0,
  serverStopped: 0,
  connectCalls: [] as Array<{ host: string; port: number }>,
  closed: 0,
  sent: [] as string[],
  broadcasted: [] as string[],
  cbs: {} as Record<string, ((ev: { data: string }) => void) | undefined>,
  removed: 0,
}));

vi.mock("./tcpPlugin", () => ({
  TcpCoord: {
    connect: async (o: { host: string; port: number }) => { h.connectCalls.push(o); },
    send: async (o: { data: string }) => { h.sent.push(o.data); },
    close: async () => { h.closed += 1; },
    startServer: async () => { h.serverStarted += 1; },
    broadcast: async (o: { data: string }) => { h.broadcasted.push(o.data); },
    stopServer: async () => { h.serverStopped += 1; },
    addListener: async (name: string, cb: (ev: { data: string }) => void) => {
      h.cbs[name] = cb;
      return { remove: async () => { h.removed += 1; h.cbs[name] = undefined; } };
    },
  },
}));

import { createStarTransport } from "./starTransport";

const COMMIT = (from: string, ticketId: string): DoorMsg => ({ t: "COMMIT", from, ticketId });
const env = (ev: string, id: string, msg: DoorMsg) => JSON.stringify({ ev, id, msg });

beforeEach(() => {
  h.serverStarted = 0; h.serverStopped = 0; h.connectCalls.length = 0; h.closed = 0;
  h.sent.length = 0; h.broadcasted.length = 0; h.cbs = {}; h.removed = 0;
});

describe("starTransport - host (relay)", () => {
  it("levanta el servidor y registra serverMessage; dispose lo detiene", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "host", port: 9 });
    expect(h.serverStarted).toBe(1);
    expect(typeof h.cbs.serverMessage).toBe("function");
    await t.dispose();
    expect(h.serverStopped).toBe(1);
  });

  it("send difunde el DoorMsg a los clientes (broadcast)", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "host", port: 9 });
    t.send(COMMIT("host", "t1"));
    expect(h.broadcasted).toHaveLength(1);
    const e = JSON.parse(h.broadcasted[0]);
    expect(e.ev).toBe("ev1");
    expect(e.msg).toEqual({ t: "COMMIT", from: "host", ticketId: "t1" });
    await t.dispose();
  });

  it("relay: mensaje de un cliente → entrega local + reenvío a todos", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "host", port: 9 });
    const got: DoorMsg[] = [];
    t.subscribe((m) => got.push(m));
    h.cbs.serverMessage!({ data: env("ev1", "c1", COMMIT("cliA", "t9")) });
    expect(got).toEqual([{ t: "COMMIT", from: "cliA", ticketId: "t9" }]);
    expect(h.broadcasted).toHaveLength(1); // reenviado a los demás clientes
    await t.dispose();
  });

  it("descarta mensajes de otro evento (namespacing)", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "host", port: 9 });
    const got: DoorMsg[] = [];
    t.subscribe((m) => got.push(m));
    h.cbs.serverMessage!({ data: env("otro", "c2", COMMIT("cliA", "t9")) });
    expect(got).toHaveLength(0);
    expect(h.broadcasted).toHaveLength(0);
    await t.dispose();
  });
});

describe("starTransport - client", () => {
  it("conecta al host y registra message; dispose cierra", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "client", host: "192.168.43.1", port: 9 });
    expect(h.connectCalls).toEqual([{ host: "192.168.43.1", port: 9 }]);
    expect(typeof h.cbs.message).toBe("function");
    await t.dispose();
    expect(h.closed).toBe(1);
  });

  it("send manda el DoorMsg al host", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "client", host: "x", port: 9 });
    t.send(COMMIT("cliA", "t1"));
    expect(h.sent).toHaveLength(1);
    expect(JSON.parse(h.sent[0]).msg.from).toBe("cliA");
    await t.dispose();
  });

  it("recibe del host y entrega; deduplica repetidos", async () => {
    const t = await createStarTransport({ eventSlug: "ev1", role: "client", host: "x", port: 9 });
    const got: DoorMsg[] = [];
    t.subscribe((m) => got.push(m));
    const frame = env("ev1", "dup1", COMMIT("host", "t5"));
    h.cbs.message!({ data: frame });
    h.cbs.message!({ data: frame }); // repetido
    expect(got).toHaveLength(1);
    await t.dispose();
  });

  it("client sin host lanza", async () => {
    await expect(
      createStarTransport({ eventSlug: "ev1", role: "client", port: 9 }),
    ).rejects.toThrow();
  });
});
