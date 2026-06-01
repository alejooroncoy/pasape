import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pasape-scan";
const STORE = "tickets";
const META = "meta";
const PENDING = "pending_scans";
const VERSION = 1;

export type CachedTicket = {
  ticketId: string;
  qrCode: string;
  holderName: string | null;
  holderDniLast2: string | null;
  ticketTypeName: string;
  boxLabel: string | null;
  boxHostTicketId: string | null;
  status: "active" | "used" | "void" | "refunded";
};

type ScanCacheResponse = {
  eventId: string;
  fetchedAt: string;
  tickets: CachedTicket[];
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "qrCode" });
        s.createIndex("ticketId", "ticketId", { unique: true });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
      if (!db.objectStoreNames.contains(PENDING)) {
        const s = db.createObjectStore(PENDING, { keyPath: "id", autoIncrement: true });
        s.createIndex("synced", "synced");
        s.createIndex("scannedAt", "scannedAt");
      }
    },
  });
}

export async function refreshScanCache(slug: string): Promise<number> {
  const res = await fetch(`/api/events/${slug}/scan-cache`);
  if (!res.ok) throw new Error("scan_cache_fetch_failed");
  const json: ScanCacheResponse = await res.json();
  const d = await db();
  const tx = d.transaction([STORE, META], "readwrite");
  await tx.objectStore(STORE).clear();
  for (const t of json.tickets) {
    await tx.objectStore(STORE).put(t);
  }
  await tx.objectStore(META).put(json.fetchedAt, "lastSync");
  await tx.objectStore(META).put(json.eventId, "eventId");
  await tx.done;
  return json.tickets.length;
}

export async function lookupTicket(qrCode: string): Promise<CachedTicket | null> {
  const d = await db();
  return (await d.get(STORE, qrCode)) ?? null;
}

export async function markUsedLocal(qrCode: string): Promise<void> {
  const d = await db();
  const t = await d.get(STORE, qrCode);
  if (t) await d.put(STORE, { ...t, status: "used" });
}

export async function lastSyncAt(): Promise<string | null> {
  const d = await db();
  return (await d.get(META, "lastSync")) ?? null;
}

export async function getEventIdFromCache(): Promise<string | null> {
  const d = await db();
  return (await d.get(META, "eventId")) ?? null;
}

export async function clearCache(): Promise<void> {
  const d = await db();
  const tx = d.transaction([STORE, META], "readwrite");
  await tx.objectStore(STORE).clear();
  await tx.objectStore(META).clear();
  await tx.done;
}
