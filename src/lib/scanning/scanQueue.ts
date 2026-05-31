import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pasape-scan";
const PENDING = "pending_scans";
const VERSION = 1;

export type PendingScan = {
  id?: number;
  ticketId: string;
  qrCode: string;
  scannedAt: string;
  synced: 0 | 1;
  lastAttemptAt?: string;
  lastError?: string;
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION);
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
