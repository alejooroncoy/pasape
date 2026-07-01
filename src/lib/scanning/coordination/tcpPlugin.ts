import { registerPlugin } from "@capacitor/core";

// Plugin nativo LOCAL (no npm) para la coordinación P2P entre porteros en
// TOPOLOGÍA ESTRELLA sobre la LAN del hotspot:
//   - El celular que comparte el hotspot es el HOST (servidor TCP + relay).
//   - Los demás son CLIENTES (se conectan a la IP de gateway del host).
// Se usa TCP (no UDP/broadcast) porque: (a) el broadcast/multicast en iOS exige
// el entitlement de pago de Apple; (b) los hotspots de celular suelen aislar a
// los clientes entre sí (AP isolation) y solo dejan pasar cliente↔host; (c) la
// validación de tickets es transaccional y el WiFi de un evento es ruidoso → TCP
// garantiza entrega ordenada. El socket se BINDEA a la interfaz WiFi para que la
// coordinación viaje por la LAN aunque el celular tenga datos móviles activos.
//
// Implementaciones nativas:
//   - Android: android/app/src/main/java/lat/pasape/app/TcpCoordPlugin.java (host + cliente)
//   - iOS:     ios/App/App/TcpCoordPlugin.swift (solo cliente; el host es Android)

export interface TcpMessageEvent {
  /** Línea JSON recibida (un DoorMsg envuelto, ver starTransport). */
  data: string;
}

export interface TcpCoordPlugin {
  // ── Rol CLIENTE (iOS + Android) ──────────────────────────────────────────
  /** Conecta al host (IP de gateway). Fuerza el socket por la interfaz WiFi. */
  connect(opts: { host: string; port: number }): Promise<void>;
  /** Envía una línea al host. */
  send(opts: { data: string }): Promise<void>;
  /** Cierra la conexión de cliente. */
  close(): Promise<void>;

  // ── Rol HOST / servidor (solo Android) ───────────────────────────────────
  /** Levanta el servidor TCP en `port`, bindeado a la interfaz WiFi. */
  startServer(opts: { port: number }): Promise<void>;
  /** Reenvía una línea a TODOS los clientes conectados (relay/difusión). */
  broadcast(opts: { data: string }): Promise<void>;
  /** Cierra el servidor y todas las conexiones. */
  stopServer(): Promise<void>;

  // ── Info de red (para decidir rol y a dónde conectar) ────────────────────
  /** Android: IP de gateway (host del hotspot) e IP propia, vía DHCP. */
  getNetworkInfo(): Promise<{ gatewayIp?: string; myIp?: string }>;

  // ── Eventos ──────────────────────────────────────────────────────────────
  // "message"      → cliente: llegó una línea del host.
  // "serverMessage"→ host: llegó una línea de algún cliente.
  // "disconnected" → cliente: se cayó la conexión con el host.
  addListener(
    eventName: "message" | "serverMessage" | "disconnected",
    listenerFunc: (event: TcpMessageEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const TcpCoord = registerPlugin<TcpCoordPlugin>("TcpCoord");
