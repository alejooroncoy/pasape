import { BleClient, type ScanResult } from "@capacitor-community/bluetooth-le";
import type { DoorMsg, Transport } from "./protocol";

// Transporte BLE para la coordinación entre puertas (capa intercambiable bajo el
// mismo protocolo). Roles fijos v1: una puerta es PERIPHERAL (anuncia el servicio)
// y las demás son CENTRAL (se conectan). El mensaje DoorMsg viaja como JSON por
// una característica con write + notify.
//
// ⚠️ Requiere validación en dispositivos reales (Android + iPhone). El rol
// CENTRAL está cubierto por el plugin; el rol PERIPHERAL (GATT server / advertise)
// es limitado en el plugin y puede necesitar un plugin nativo adicional —
// especialmente en iOS. La elección consciente del SO (Android-preferido como
// puente) es del Bloque v1.1; aquí los roles se pasan por configuración.

// UUIDs propios del servicio de coordinación Pasape (GATT).
export const PASAPE_COORD_SERVICE = "7041b000-9b3a-4c1d-9f2e-a1b2c3d4e5f6";
export const PASAPE_COORD_CHAR = "7041b001-9b3a-4c1d-9f2e-a1b2c3d4e5f6";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toDataView(s: string): DataView {
  const bytes = enc.encode(s);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Transporte CENTRAL: se conecta al peripheral de la zona y multiplexa DoorMsg.
 * deviceId del peripheral conocido por configuración (roles fijos).
 */
export async function createBleCentralTransport(
  peripheralDeviceId: string,
): Promise<Transport> {
  const subs = new Set<(m: DoorMsg) => void>();

  await BleClient.initialize({ androidNeverForLocation: true });
  await BleClient.connect(peripheralDeviceId, () => {
    // onDisconnect: el caller decide reconectar / re-elegir coordinador.
  });

  await BleClient.startNotifications(
    peripheralDeviceId,
    PASAPE_COORD_SERVICE,
    PASAPE_COORD_CHAR,
    (value) => {
      try {
        const msg = JSON.parse(dec.decode(value)) as DoorMsg;
        for (const cb of subs) cb(msg);
      } catch {
        // frame corrupto: ignorar
      }
    },
  );

  return {
    send(msg) {
      void BleClient.write(
        peripheralDeviceId,
        PASAPE_COORD_SERVICE,
        PASAPE_COORD_CHAR,
        toDataView(JSON.stringify(msg)),
      ).catch(() => {
        // best-effort: si falla el write, el coordinador degrada al timeout
      });
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

/**
 * Descubre puertas Pasape cercanas (para que el operador elija el peripheral, o
 * para la elección automática del coordinador en v1.1).
 */
export async function scanForDoors(
  durationMs = 4000,
): Promise<Array<{ deviceId: string; name: string | null; rssi: number | null }>> {
  await BleClient.initialize({ androidNeverForLocation: true });
  const found = new Map<string, { deviceId: string; name: string | null; rssi: number | null }>();
  await BleClient.requestLEScan({ services: [PASAPE_COORD_SERVICE] }, (r: ScanResult) => {
    found.set(r.device.deviceId, {
      deviceId: r.device.deviceId,
      name: r.device.name ?? null,
      rssi: r.rssi ?? null,
    });
  });
  await new Promise((res) => setTimeout(res, durationMs));
  await BleClient.stopLEScan();
  return [...found.values()];
}
