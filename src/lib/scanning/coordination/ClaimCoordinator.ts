import type { DoorMsg, Transport } from "./protocol";

// Arbitraje de doble-ingreso entre puertas offline de una zona.
//
// Cuando una puerta va a validar un ticket, emite CLAIM y espera un instante:
//   - Si otra puerta ya hizo COMMIT de ese ticket → DENY inmediato → "denied".
//   - Si dos puertas reclaman a la vez → desempate determinista (nonce, luego
//     deviceId): exactamente una gana, la otra recibe DENY.
//   - Si nadie objeta dentro del timeout → "granted" + COMMIT.
//
// Degrada limpio: sin transporte (BLE caído), claim() concede de inmediato y el
// doble-ingreso se detecta al sincronizar (flag dup_offline).

type Pending = {
  nonce: number;
  resolve: (r: "granted" | "denied") => void;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

export type CoordinatorOpts = {
  claimTimeoutMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (h: ReturnType<typeof setTimeout>) => void;
};

export class ClaimCoordinator {
  private committed = new Set<string>();
  private pending = new Map<string, Pending>();
  private unsub: () => void;
  private nonceSeq = 0;
  private readonly timeoutMs: number;
  private readonly setT: NonNullable<CoordinatorOpts["setTimeoutFn"]>;
  private readonly clearT: NonNullable<CoordinatorOpts["clearTimeoutFn"]>;

  constructor(
    private readonly deviceId: string,
    private readonly transport: Transport,
    opts: CoordinatorOpts = {},
  ) {
    this.timeoutMs = opts.claimTimeoutMs ?? 400;
    this.setT = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearT = opts.clearTimeoutFn ?? ((h) => clearTimeout(h));
    this.unsub = transport.subscribe((m) => this.onMessage(m));
    this.transport.send({ t: "HELLO", from: deviceId, zoneId: null });
  }

  dispose() {
    this.unsub();
    for (const p of this.pending.values()) if (p.timer) this.clearT(p.timer);
    this.pending.clear();
  }

  /** Marca un ticket como ingresado sin pasar por claim (p. ej. tras COMMIT propio online). */
  markCommitted(ticketId: string) {
    this.committed.add(ticketId);
  }

  async claim(ticketId: string): Promise<"granted" | "denied"> {
    if (this.committed.has(ticketId)) return "denied";
    if (this.pending.has(ticketId)) return "denied";

    const nonce = this.nextNonce();
    return new Promise<"granted" | "denied">((resolve) => {
      const p: Pending = { nonce, resolve, settled: false, timer: null };
      this.pending.set(ticketId, p);
      this.transport.send({ t: "CLAIM", from: this.deviceId, ticketId, nonce });
      p.timer = this.setT(() => this.grant(ticketId), this.timeoutMs);
    });
  }

  private nextNonce(): number {
    // Monótono en el proceso; el desempate final usa también el deviceId.
    this.nonceSeq += 1;
    return this.nonceSeq;
  }

  private grant(ticketId: string) {
    const p = this.pending.get(ticketId);
    if (!p || p.settled) return;
    p.settled = true;
    if (p.timer) this.clearT(p.timer);
    this.pending.delete(ticketId);
    this.committed.add(ticketId);
    this.transport.send({ t: "COMMIT", from: this.deviceId, ticketId });
    p.resolve("granted");
  }

  private deny(ticketId: string) {
    const p = this.pending.get(ticketId);
    if (!p || p.settled) return;
    p.settled = true;
    if (p.timer) this.clearT(p.timer);
    this.pending.delete(ticketId);
    p.resolve("denied");
  }

  // ¿El claim del peer le gana al mío? Menor nonce gana; empate → menor deviceId.
  private peerWins(peerFrom: string, peerNonce: number, myNonce: number): boolean {
    if (peerNonce !== myNonce) return peerNonce < myNonce;
    return peerFrom < this.deviceId;
  }

  private onMessage(m: DoorMsg) {
    if (m.from === this.deviceId) return;
    switch (m.t) {
      case "CLAIM": {
        if (this.committed.has(m.ticketId)) {
          this.transport.send({ t: "DENY", from: this.deviceId, ticketId: m.ticketId });
          return;
        }
        const mine = this.pending.get(m.ticketId);
        if (mine && !mine.settled) {
          if (this.peerWins(m.from, m.nonce, mine.nonce)) {
            // El peer gana: me retiro.
            this.deny(m.ticketId);
          } else {
            // Yo gano: niego al peer.
            this.transport.send({ t: "DENY", from: this.deviceId, ticketId: m.ticketId });
          }
        }
        return;
      }
      case "DENY":
        this.deny(m.ticketId);
        return;
      case "COMMIT":
        this.committed.add(m.ticketId);
        this.deny(m.ticketId);
        return;
      case "HELLO":
      case "HEARTBEAT":
      case "ACK":
        return;
    }
  }
}
