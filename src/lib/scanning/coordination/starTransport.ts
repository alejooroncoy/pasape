import type { DoorMsg, Transport } from "./protocol";
import { TcpCoord } from "./tcpPlugin";

// Transporte de coordinación entre porteros en TOPOLOGÍA ESTRELLA sobre la LAN
// del hotspot, encima del mismo `Transport` que usa `ClaimCoordinator` (el
// arbitraje CLAIM/DENY/COMMIT corre tal cual — solo cambia el cable).
//
//   HOST (el que comparte el hotspot): levanta el servidor TCP y hace de RELAY —
//     un mensaje de un cliente se entrega a su coordinador local Y se reenvía a
//     todos los clientes, así todos "ven" el bus completo (el emisor filtra su
//     propio `from` en ClaimCoordinator.onMessage). Sortea el AP isolation.
//   CLIENTE (iPhone u otro Android): se conecta a la IP de gateway del host y
//     manda/recibe por esa única conexión.
//
// Cada DoorMsg viaja envuelto en `{ ev, id, msg }` (newline-delimited):
//   - `ev` = eventSlug → descarta tráfico de otro evento en la misma LAN.
//   - `id` = "<from>:<seq>" → dedupe de re-entregas del relay.

const DEDUP_TTL_MS = 5_000;

type Envelope = { ev: string; id: string; msg: DoorMsg };

export type StarRole = "host" | "client";

export interface StarTransport extends Transport {
  dispose(): Promise<void>;
}

export interface StarTransportOpts {
  eventSlug: string;
  role: StarRole;
  port: number;
  /** IP de gateway del host. Requerido para role "client". */
  host?: string;
}

export async function createStarTransport(opts: StarTransportOpts): Promise<StarTransport> {
  const { eventSlug, role, port, host } = opts;
  const subs = new Set<(m: DoorMsg) => void>();
  const seen = new Map<string, number>();
  let seq = 0;
  const listeners: Array<{ remove: () => Promise<void> }> = [];

  // Parsea, filtra por evento y deduplica. null = descartar.
  const accept = (raw: string): DoorMsg | null => {
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return null;
    }
    if (!env || env.ev !== eventSlug || !env.msg) return null;
    const now = Date.now();
    for (const [id, exp] of seen) if (exp <= now) seen.delete(id);
    if (env.id) {
      if (seen.has(env.id)) return null;
      seen.set(env.id, now + DEDUP_TTL_MS);
    }
    return env.msg;
  };

  const wrap = (msg: DoorMsg): string => {
    const env: Envelope = { ev: eventSlug, id: `${msg.from}:${++seq}`, msg };
    return JSON.stringify(env) + "\n";
  };

  const deliver = (msg: DoorMsg) => {
    for (const cb of subs) cb(msg);
  };

  if (role === "host") {
    await TcpCoord.startServer({ port });
    // Relay: lo que dice un cliente → coordinador local del host + reenvío a todos
    // los clientes (el origen lo filtra por `from`).
    listeners.push(
      await TcpCoord.addListener("serverMessage", (ev) => {
        const data = ev.data?.trim();
        if (!data) return;
        const msg = accept(data);
        if (!msg) return;
        deliver(msg);
        void TcpCoord.broadcast({ data: data + "\n" }).catch(() => {});
      }),
    );
    return {
      // El coordinador del host emite → a todos los clientes (no se auto-entrega).
      send(msg) {
        void TcpCoord.broadcast({ data: wrap(msg) }).catch(() => {});
      },
      subscribe(cb) {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      async dispose() {
        for (const l of listeners) await l.remove().catch(() => {});
        await TcpCoord.stopServer().catch(() => {});
        subs.clear();
        seen.clear();
      },
    };
  }

  // role === "client"
  if (!host) throw new Error("starTransport: role 'client' requiere host (gateway IP)");
  listeners.push(
    await TcpCoord.addListener("message", (ev) => {
      const data = ev.data?.trim();
      if (!data) return;
      const msg = accept(data);
      if (msg) deliver(msg);
    }),
  );
  await TcpCoord.connect({ host, port });
  return {
    send(msg) {
      void TcpCoord.send({ data: wrap(msg) }).catch(() => {});
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    async dispose() {
      for (const l of listeners) await l.remove().catch(() => {});
      await TcpCoord.close().catch(() => {});
      subs.clear();
      seen.clear();
    },
  };
}
