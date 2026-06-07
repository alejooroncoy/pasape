// Protocolo de coordinación entre validadores (puertas) de una zona.
// La capa de transporte es intercambiable (BLE / Nearby / MPC): este módulo solo
// define los mensajes y la interfaz Transport. El arbitraje vive en
// ClaimCoordinator y es agnóstico del transporte → testeable sin hardware.

export type DoorMsg =
  | { t: "HELLO"; from: string; zoneId: string | null }
  | { t: "HEARTBEAT"; from: string }
  // CLAIM: "quiero validar este ticket". nonce desempata claims concurrentes.
  | { t: "CLAIM"; from: string; ticketId: string; nonce: number }
  | { t: "ACK"; from: string; ticketId: string }
  // DENY: "ese ticket ya entró por mi puerta" o "yo gané el claim concurrente".
  | { t: "DENY"; from: string; ticketId: string }
  // COMMIT: "confirmo que este ticket entró por mí".
  | { t: "COMMIT"; from: string; ticketId: string };

export interface Transport {
  send(msg: DoorMsg): void;
  subscribe(cb: (msg: DoorMsg) => void): () => void;
}

/**
 * Transport en memoria que conecta varios coordinadores en proceso (para tests
 * y para un eventual bus local). Entrega síncrona a todos menos al emisor.
 */
export class InMemoryBus {
  private subs = new Set<(m: DoorMsg) => void>();

  endpoint(): Transport {
    const self = this;
    let mine: ((m: DoorMsg) => void) | null = null;
    return {
      send(msg) {
        for (const s of self.subs) if (s !== mine) s(msg);
      },
      subscribe(cb) {
        mine = cb;
        self.subs.add(cb);
        return () => {
          self.subs.delete(cb);
          if (mine === cb) mine = null;
        };
      },
    };
  }
}
