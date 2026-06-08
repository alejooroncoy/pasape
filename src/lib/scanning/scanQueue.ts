import { openDB, type IDBPDatabase } from "idb";

// IMPORTANTE: misma DB compartida con scanCache.ts — versión y upgrade DEBEN coincidir.
const DB_NAME = "pasape-scan";
const STORE = "tickets";
const META = "meta";
const PENDING = "pending_scans";
const VERSION = 2;

export type PendingScan = {
  id?: number;
  ticketId: string;
  // Para kind "signed": el token firmado (cert~window~sig) que se reenvía al
  // server. Para kind "manual": no se usa (la admisión va por ticketId).
  token: string;
  scannedAt: string;
  // "signed" = QR firmado escaneado por cámara; "manual" = alta desde la lista.
  kind: "signed" | "manual";
  synced: 0 | 1;
  lastAttemptAt?: string;
  lastError?: string;
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    // Upgrade idéntico al de scanCache.ts — crea los 3 stores si faltan.
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        const s = database.createObjectStore(STORE, { keyPath: "qrCode" });
        s.createIndex("ticketId", "ticketId", { unique: true });
      }
      if (!database.objectStoreNames.contains(META)) {
        database.createObjectStore(META);
      }
      if (!database.objectStoreNames.contains(PENDING)) {
        const s = database.createObjectStore(PENDING, { keyPath: "id", autoIncrement: true });
        s.createIndex("synced", "synced");
        s.createIndex("scannedAt", "scannedAt");
      }
    },
  });
}

export async function enqueuePendingScan(
  s: Omit<PendingScan, "synced" | "id">,
): Promise<void> {
  const d = await db();
  await d.add(PENDING, { ...s, synced: 0 });
}

export async function listPending(): Promise<PendingScan[]> {
  const d = await db();
  return d.getAllFromIndex(PENDING, "synced", IDBKeyRange.only(0));
}

export async function countPending(): Promise<number> {
  const d = await db();
  return d.countFromIndex(PENDING, "synced", IDBKeyRange.only(0));
}

export async function markSynced(id: number): Promise<void> {
  const d = await db();
  const row = await d.get(PENDING, id);
  if (row) {
    await d.put(PENDING, { ...row, synced: 1, lastAttemptAt: new Date().toISOString() });
  }
}

export async function recordSyncError(id: number, error: string): Promise<void> {
  const d = await db();
  const row = await d.get(PENDING, id);
  if (row) {
    await d.put(PENDING, { ...row, lastError: error, lastAttemptAt: new Date().toISOString() });
  }
}
